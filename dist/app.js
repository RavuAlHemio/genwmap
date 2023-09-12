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
exports.main = void 0;
const WeathermapPlacer = require("svg-weathermap-placer");
const xmldom_1 = require("@xmldom/xmldom");
const fetcher_1 = require("./fetcher");
const fs = require("fs");
let options = {
    configFile: "genwmap.json",
    outputFile: "weathermap.svg",
    debug: false,
};
/**
 * Outputs usage information.
 */
function printUsage() {
    console.error("Usage: genwmap [-d] [-c CONFIG.json] [-o OUTPUT.svg]");
}
/**
 * Processes command-line arguments, filling the {@link options} variable.
 *
 * @returns Whether processing options was successful. (If not, this function also outputs usage
 * information.)
 */
function processOptions() {
    let awaiting = null;
    for (let i = 2; i < process.argv.length; ++i) {
        let arg = process.argv[i];
        if (awaiting === null) {
            if (arg === "-c" || arg === "-o") {
                awaiting = arg;
            }
            else if (arg === "-d") {
                options.debug = true;
            }
            else {
                console.error(`Unknown option '${arg}'`);
                printUsage();
                return false;
            }
        }
        else {
            if (awaiting === "-c") {
                options.configFile = arg;
            }
            else if (awaiting === "-o") {
                options.outputFile = arg;
            }
            awaiting = null;
        }
    }
    if (awaiting !== null) {
        console.error(`No value specified for option '${awaiting}'`);
        printUsage();
        return false;
    }
    return true;
}
/**
 * The main function.
 *
 * @returns A promise that resolves when the program finishes executing.
 */
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!processOptions()) {
            process.exitCode = 1;
            return;
        }
        let configString = yield readFileAsync(options.configFile);
        let config = JSON.parse(configString);
        let weathermap = config.weathermap;
        let metrics = config.weathermap.targets;
        let dataSources = config.dataSources;
        let lookbackInterval = config.lookbackInterval;
        let styleDefinition = config.styleDefinition;
        let globalDataSourceName = config.weathermap.datasource;
        let metricValues = yield (0, fetcher_1.fetchMetrics)(dataSources, globalDataSourceName, metrics, lookbackInterval);
        let impl = new xmldom_1.DOMImplementation();
        let doc = impl.createDocument(null, null, null);
        const nullLinkResolver = null;
        const addViewBox = true;
        let svg = WeathermapPlacer.renderWeathermapInto(doc, doc, weathermap, metricValues, nullLinkResolver, addViewBox);
        if (styleDefinition) {
            let svgStyle = doc.createElementNS(WeathermapPlacer.constants.svgNamespace, "style");
            svg.insertBefore(svgStyle, svg.firstElementChild);
            svgStyle.setAttribute("type", "text/css");
            svgStyle.textContent = styleDefinition;
        }
        let outputter = new xmldom_1.XMLSerializer();
        let outputString = outputter.serializeToString(doc);
        yield writeFileAsync(options.outputFile, outputString, {});
    });
}
exports.main = main;
/**
 * Asynchronously reads the contents of a file.
 *
 * @param path - The path of the file to read.
 * @returns A promise that resolves with the content of the file.
 */
function readFileAsync(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, { encoding: "utf8" }, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}
/**
 * Asynchronously writes data to a file.
 *
 * @param path - The path of the file into which to write the data.
 * @param data - The data to write.
 * @param options - Additional options related to writing the file.
 * @returns A promise that resolves once the file is written.
 */
function writeFileAsync(path, data, options) {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, data, options, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}
