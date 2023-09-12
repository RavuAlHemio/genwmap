"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMetrics = void 0;
const http = require("http");
/**
 * Obtains metric values via HTTP.
 *
 * @param dataSources - A mapping of data source IDs to URLs.
 * @param globalDataSourceName - The name of the data source if not explicitly specified on the
 * metric.
 * @param metrics - The metrics to query.
 * @param lookback_interval - How far to look back when obtaining a range.
 * @returns A promise that eventually resolves to a map of string keys to metric values.
 */
function fetchMetrics(dataSources, globalDataSourceName, metrics, lookback_interval) {
    return __awaiter(this, void 0, void 0, function* () {
        // query
        let agent = new http.Agent();
        let metricValueMap = {};
        for (let metric of metrics) {
            let metricQueryEscaped = encodeURIComponent(metric.expr
                .replace("$lookback_interval", lookback_interval)
                .replace("$__range", lookback_interval));
            let dataSourceName = metric.datasource;
            if (dataSourceName === undefined) {
                dataSourceName = globalDataSourceName;
            }
            if (dataSourceName !== null && typeof dataSourceName === 'object' && !Array.isArray(dataSourceName)) {
                // newer Prometheus versions store datasource as {"type":"prometheus","uid":"000000001"}
                // take the UID because it's more likely to be unique
                dataSourceName = dataSourceName.uid;
            }
            let baseUrl = dataSources[dataSourceName];
            let metricUrl = new URL(`api/v1/query?query=${metricQueryEscaped}`, baseUrl);
            let [response, body] = yield httpGetAsync(metricUrl.protocol, metricUrl.hostname, +metricUrl.port, metricUrl.pathname + metricUrl.search, agent);
            let metricData = JSON.parse(body);
            for (let result of metricData.data.result) {
                let labels = result.metric;
                let value = +result.value[1];
                let key = interpolateLabels(metric.legendFormat, labels);
                metricValueMap[key] = value;
            }
            response.destroy();
        }
        agent.destroy();
        return metricValueMap;
    });
}
exports.fetchMetrics = fetchMetrics;
/**
 * Replaces placeholders in the given string with the given label values.
 *
 * @param template - The string that constitutes the template in which to replace the placeholders.
 * @param labels - Specifies the values for the placeholders.
 * @returns The template string with the placeholders replaced with the label values.
 */
function interpolateLabels(template, labels) {
    let output = template;
    for (;;) {
        let nextBracesIndex = output.indexOf("{{");
        if (nextBracesIndex === -1) {
            return output;
        }
        let endBracesIndex = output.indexOf("}}", nextBracesIndex);
        if (endBracesIndex === -1) {
            return output;
        }
        let variableName = output.substr(nextBracesIndex + 2, endBracesIndex - nextBracesIndex - 2);
        let variableValue = variableName in labels
            ? labels[variableName]
            : "";
        output = output.substr(0, nextBracesIndex) + variableValue + output.substr(endBracesIndex + 2);
    }
}
/**
 * Asynchronously obtains content via HTTP.
 *
 * @param protocol - The protocol to use.
 * @param hostname - The hostname to contact.
 * @param port - The port to contact.
 * @param path - The path to query.
 * @param agent - The user agent to specify.
 * @returns A promise that resolves to an HTTP message.
 */
function httpGetAsync(protocol, hostname, port, path, agent) {
    return new Promise((resolve, reject) => {
        let options = {
            protocol: protocol,
            hostname: hostname,
            port: port,
            path: path,
            agent: agent
        };
        let req = http.request(options, res => {
            let body = "";
            res.on("data", chunk => {
                body += chunk;
            });
            res.on("end", () => {
                resolve([res, body]);
            });
        });
        req.on("error", err => {
            reject(err);
        });
        req.end();
    });
}
