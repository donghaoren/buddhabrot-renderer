let { colormaps } = require("../dist/colormaps");

function generateColormapCode(cm) {
    let items = [];
    for (let stop of cm.colormap) {
        items.push(stop[0]);
        items.push(stop[1]);
        items.push(stop[2]);
        items.push(255);
    }
    return `    unsigned char ${cm.name.replace(/[^0-9a-zA-Z]/g, "_")}[] = { ${items.join(",")} };\n    int ${cm.name.replace(/[^0-9a-zA-Z]/g, "_")}_size = ${cm.colormap.length};`;
}

let code = colormaps.slice(0, 1).map(x => generateColormapCode(x)).join("\n");

code = "namespace Colormaps {\n" + code + "\n}\n";

console.log(code);
