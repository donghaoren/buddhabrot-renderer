import * as chroma from "chroma-js";

export interface Colormap {
    name: string;
    colormap_rgb: number[][];
    colormap_xyz: number[][];
}

export let colormaps: Colormap[] = require("../data/colormaps_generated.json");