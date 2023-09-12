import * as WeathermapPlacer from "svg-weathermap-placer";
import { DOMImplementation, XMLSerializer } from "@xmldom/xmldom";
import { PrometheusMetric, fetchMetrics } from "./fetcher";
import * as fs from "fs";

let options = {
    configFile: "genwmap.json",
    outputFile: "weathermap.svg",
    debug: false,
};

/**
 * Outputs usage information.
 */
function printUsage(): void {
    console.error("Usage: genwmap [-d] [-c CONFIG.json] [-o OUTPUT.svg]");
}

/**
 * Processes command-line arguments, filling the {@link options} variable.
 *
 * @returns Whether processing options was successful. (If not, this function also outputs usage
 * information.)
 */
function processOptions(): boolean {
    let awaiting: string|null = null;

    for (let i: number = 2; i < process.argv.length; ++i) {
        let arg: string = process.argv[i];

        if (awaiting === null) {
            if (arg === "-c" || arg === "-o") {
                awaiting = arg;
            } else if (arg === "-d") {
                options.debug = true;
            } else {
                console.error(`Unknown option '${arg}'`);
                printUsage();
                return false;
            }
        } else {
            if (awaiting === "-c") {
                options.configFile = arg;
            } else if (awaiting === "-o") {
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
export async function main(): Promise<void> {
    if (!processOptions()) {
        process.exitCode = 1;
        return;
    }

    let configString: string = await readFileAsync(options.configFile);
    let config: any = JSON.parse(configString);

    let weathermap: WeathermapPlacer.WeathermapConfig = config.weathermap;
    let metrics: PrometheusMetric[] = config.weathermap.targets;
    let dataSources: { [index: string]: string; } = config.dataSources;
    let lookbackInterval: string = config.lookbackInterval;
    let styleDefinition: string|null = config.styleDefinition;

    let globalDataSourceName = config.weathermap.datasource;
    let metricValues: any = await fetchMetrics(dataSources, globalDataSourceName, metrics, lookbackInterval);
    let impl = new DOMImplementation();
    let doc: Document = impl.createDocument(null, null, null);

    const nullLinkResolver: null = null;
    const addViewBox: boolean = true;
    let svg: SVGSVGElement = WeathermapPlacer.renderWeathermapInto(doc, doc, weathermap, metricValues, nullLinkResolver, addViewBox);
    if (styleDefinition) {
        let svgStyle = <SVGStyleElement><unknown>doc.createElementNS(WeathermapPlacer.constants.svgNamespace, "style");
        svg.insertBefore(svgStyle, svg.firstElementChild);
        svgStyle.setAttribute("type", "text/css");
        svgStyle.textContent = styleDefinition;
    }

    let outputter = new XMLSerializer();
    let outputString: string = outputter.serializeToString(doc);
    await writeFileAsync(options.outputFile, outputString, {});
}

/**
 * Asynchronously reads the contents of a file.
 *
 * @param path - The path of the file to read.
 * @returns A promise that resolves with the content of the file.
 */
function readFileAsync(path: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(path, { encoding: "utf8" }, (err, data) => {
            if (err) {
                reject(err);
            } else {
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
function writeFileAsync(path: string, data: string, options: {}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(path, data, options, err => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
