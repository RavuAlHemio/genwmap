import * as WeathermapPlacer from "svg-weathermap-placer";
import * as http from "http";

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
export async function fetchMetrics(dataSources: { [index: string]: string; }, globalDataSourceName: string|GrafanaDataSource, metrics: PrometheusMetric[], lookback_interval: string): Promise<WeathermapPlacer.MetricValueMap> {
    // query
    let agent = new http.Agent();

    let metricValueMap: WeathermapPlacer.MetricValueMap = {};

    for (let metric of metrics) {
        let metricQueryEscaped: string = encodeURIComponent(
            metric.expr
                .replace("$lookback_interval", lookback_interval)
                .replace("$__range", lookback_interval)
        );
        let dataSourceName = metric.datasource;
        if (dataSourceName === undefined) {
            dataSourceName = globalDataSourceName;
        }
        if (dataSourceName !== null && typeof dataSourceName === 'object' && !Array.isArray(dataSourceName)) {
            // newer Prometheus versions store datasource as {"type":"prometheus","uid":"000000001"}
            // take the UID because it's more likely to be unique
            dataSourceName = dataSourceName.uid;
        }
        let baseUrl = dataSources[<string>dataSourceName];
        let metricUrl = new URL(`api/v1/query?query=${metricQueryEscaped}`, baseUrl);

        let [response, body] = await httpGetAsync(
            metricUrl.protocol, metricUrl.hostname, +metricUrl.port, metricUrl.pathname + metricUrl.search, agent
        );
        let metricData: any = JSON.parse(body);

        for (let result of metricData.data.result) {
            let labels: any = result.metric;
            let value: number = +result.value[1];

            let key: string = interpolateLabels(metric.legendFormat, labels);
            metricValueMap[key] = value;
        }

        response.destroy();
    }

    agent.destroy();

    return metricValueMap;
}

/**
 * Replaces placeholders in the given string with the given label values.
 *
 * @param template - The string that constitutes the template in which to replace the placeholders.
 * @param labels - Specifies the values for the placeholders.
 * @returns The template string with the placeholders replaced with the label values.
 */
function interpolateLabels(template: string, labels: { [key: string]: string }): string {
    let output: string = template;
    for (;;) {
        let nextBracesIndex: number = output.indexOf("{{");
        if (nextBracesIndex === -1) {
            return output;
        }

        let endBracesIndex: number = output.indexOf("}}", nextBracesIndex);
        if (endBracesIndex === -1) {
            return output;
        }

        let variableName: string = output.substr(nextBracesIndex + 2, endBracesIndex - nextBracesIndex - 2);
        let variableValue: string = variableName in labels
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
function httpGetAsync(
    protocol: string, hostname: string, port: number, path: string, agent: http.Agent
): Promise<[http.IncomingMessage, string]> {
    return new Promise<[http.IncomingMessage, string]>((resolve, reject) => {
        let options: object = {
            protocol: protocol,
            hostname: hostname,
            port: port,
            path: path,
            agent: agent
        };
        let req: http.ClientRequest = http.request(options, res => {
            let body: string = "";
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

/**
 * The configuration of a Prometheus-querying Grafana metric.
 */
export interface PrometheusMetric {
    datasource: string|GrafanaDataSource;
    expr: string;
    legendFormat: string;
}

/**
 * A Grafana data source.
 */
export interface GrafanaDataSource {
    type: string;
    uid: string;
}
