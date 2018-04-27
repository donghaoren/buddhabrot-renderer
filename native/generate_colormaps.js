let { colormaps } = require("../dist/colormaps");

function generateColormapCode(cm) {
    let items = [];
    for (let stop of cm.colormap_xyz) {
        items.push(stop[0]);
        items.push(stop[1]);
        items.push(stop[2]);
    }
    return `    float ${cm.name.replace(/[^0-9a-zA-Z]/g, "_")}[] = { ${items.join(",")} };\n    int ${cm.name.replace(/[^0-9a-zA-Z]/g, "_")}_size = ${cm.colormap_xyz.length};`;
}

function generateColormapHeader(cm) {
    let items = [];
    for (let stop of cm.colormap_xyz) {
        items.push(stop[0]);
        items.push(stop[1]);
        items.push(stop[2]);
    }
    return `    extern float ${cm.name.replace(/[^0-9a-zA-Z]/g, "_")}[];\n    extern int ${cm.name.replace(/[^0-9a-zA-Z]/g, "_")}_size;`;
}

let code = colormaps.slice(0, 3).map(x => generateColormapCode(x)).join("\n");
let header = colormaps.slice(0, 3).map(x => generateColormapHeader(x)).join("\n");

code = "namespace Colormaps {\n" + code + "\n}\n";
header = "namespace Colormaps {\n" + header + "\n}\n";

let fs = require("fs");
fs.writeFileSync("colormaps.h", header, "utf-8");
fs.writeFileSync("colormaps.cpp", code, "utf-8");