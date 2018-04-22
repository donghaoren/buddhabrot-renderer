import * as chroma from "chroma-js";

let colormaps_data = require("../data/colormaps.json");

export interface Colormap {
    name: string;
    colormap: number[][];
}

export let colormaps: Colormap[] = [];

for(let cm of colormaps_data) {
    colormaps.push(cm);
    let cm_rev = JSON.parse(JSON.stringify(cm));
    cm_rev.name += "/inv";
    cm_rev.colormap.reverse();
    colormaps.push(cm_rev);
}

function colormap_Cubehelix(start: number = 300, rotations: number = -1.5) {
    let colorScale = chroma.cubehelix()
        .rotations(rotations)
        .start(start)
        .lightness([0, 1])
        .scale() // convert to chroma.scale
        .correctLightness()
        .domain([0, 99]);
    let colormap: number[][] = [];
    for (let i = 0; i < 100; i++) {
        colormap.push(colorScale(i).rgb().concat([1]));
    }
    colormaps.push({ name: `Cubehelix/${start}/${rotations}`, colormap: colormap });
    colormap = [];
    for (let i = 0; i < 100; i++) {
        colormap.push(colorScale(99 - i).rgb().concat([1]));
    }
    colormaps.push({ name: `Cubehelix/${start}/${rotations}/inv`, colormap: colormap });
}

function colormap_Cubehelix_3(start: number) {
    colormap_Cubehelix(start, -1.5);
    colormap_Cubehelix(start, -1);
    colormap_Cubehelix(start, -0.5);
    colormap_Cubehelix(start, 0.5);
    colormap_Cubehelix(start, 1);
    colormap_Cubehelix(start, 1.5);
}

colormap_Cubehelix_3(300);
colormap_Cubehelix_3(240);
colormap_Cubehelix_3(180);
colormap_Cubehelix_3(60);
colormap_Cubehelix_3(0);