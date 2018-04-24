import * as chroma from "chroma-js";

let colormaps_data = require("../data/colormaps.json");

export interface Colormap {
    name: string;
    colormap_rgb: number[][];
    colormap_xyz: number[][];
}

export let colormaps: Colormap[] = [];

// Conversion functions from chroma.js
let LAB_CONSTANTS = {
    Kn: 18,
    Xn: 0.950470,
    Yn: 1,
    Zn: 1.088830,
    t0: 0.137931034,
    t1: 0.206896552,
    t2: 0.12841855,
    t3: 0.008856452
};

function lab_xyzf(t: number) {
    if (t > LAB_CONSTANTS.t1) {
        return t * t * t
    } else {
        return LAB_CONSTANTS.t2 * (t - LAB_CONSTANTS.t0)
    }
}

function lab2xyz(l: number, a: number, b: number) {
    let y = (l + 16) / 116
    let x = y + a / 500;
    let z = y - b / 200;
    y = LAB_CONSTANTS.Yn * lab_xyzf(y);
    x = LAB_CONSTANTS.Xn * lab_xyzf(x);
    z = LAB_CONSTANTS.Zn * lab_xyzf(z);
    return [parseFloat(x.toFixed(4)), parseFloat(y.toFixed(4)), parseFloat(z.toFixed(4))];
}

function addGradient(name: string, scale: chroma.Scale) {
    scale.domain([0, 49]);
    let colormap_rgb: number[][] = [];
    let colormap_xyz: number[][] = [];
    for (let i = 0; i < 50; i++) {
        let lab = scale(i).lab();
        colormap_rgb.push(scale(i).rgb().concat([1]));
        colormap_xyz.push(lab2xyz(lab[0], lab[1], lab[2]).concat([1]));
    }
    colormaps.push({ name: name, colormap_rgb: colormap_rgb, colormap_xyz: colormap_xyz });
}

addGradient("Default1: royalblue", chroma.scale(["#000000", chroma("royalblue")]).correctLightness());
addGradient("Default2: lime", chroma.scale(["#000000", chroma("lime")]).correctLightness());
addGradient("Default3: red", chroma.scale(["#000000", chroma("red")]).correctLightness());

let names = ["aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black", "blanchedalmond",
    "blue", "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflower",
    "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray", "darkgreen",
    "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen", "darkorange", "darkorchid", "darkred", "darksalmon",
    "darkseagreen", "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise", "darkviolet", "deeppink",
    "deepskyblue", "dimgray", "dimgrey", "dodgerblue", "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro",
    "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow", "grey", "honeydew", "hotpink", "indianred",
    "indigo", "ivory", "khaki", "laserlemon", "lavender", "lavenderblush", "lawngreen", "lemonchiffon", "lightblue",
    "lightcoral", "lightcyan", "lightgoldenrod", "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey",
    "lightpink", "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray", "lightslategrey", "lightsteelblue",
    "lightyellow", "lime", "limegreen", "linen", "magenta", "maroon", "maroon2", "maroon3", "mediumaquamarine",
    "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen",
    "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin", "navajowhite", "navy",
    "oldlace", "olive", "olivedrab", "orange", "orangered", "orchid", "palegoldenrod", "palegreen", "paleturquoise",
    "palevioletred", "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue", "purple", "purple2", "purple3",
    "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell",
    "sienna", "silver", "skyblue", "slateblue", "slategray", "slategrey", "snow", "springgreen", "steelblue", "tan",
    "teal", "thistle", "tomato", "turquoise", "violet", "wheat", "white", "whitesmoke", "yellow", "yellowgreen"];

names = names.sort((a, b) => {
    return chroma(a).hcl()[0] - chroma(b).hcl()[0];
});
for (let name of names) {
    addGradient("css: " + name, chroma.scale(["#000000", chroma(name)]).correctLightness());
}

for (let colormap of colormaps_data) {
    addGradient(colormap.name, chroma.scale(colormap.colormap.map(x => chroma(x))));
}

addGradient("(null)", chroma.scale(["#000000", "#000000"]).correctLightness());

require("fs").writeFileSync("data/colormaps_generated.json", JSON.stringify(colormaps));