var child_process = require("child_process");

var animation = require("./animation-1.json");
var speed = 5;
var fps = 60;
var width = 3840;
var height = 2160;
var samples = 4000000;
var total_frames = Math.round((animation.length - 1) * speed * fps);

function interp_paramters(a, b, t) {
    let r = {};
    for (let n in a) {
        r[n] = a[n] * (1 - t) + b[n] * t;
    }
    return r;
}

for (let frame = 0; frame <= total_frames; frame++) {
    let t0 = new Date().getTime();

    let timestamp = frame / fps;
    let s = timestamp / speed;
    let i1 = Math.floor(s);
    let i2 = i1 + 1;
    i1 = Math.min(animation.length - 1, i1);
    i2 = Math.min(animation.length - 1, i2);
    let t = s - i1;
    let parameters = interp_paramters(animation[i1].parameters, animation[i2].parameters, t);
    let parameter_array = [];
    for (let name in parameters) {
        parameter_array.push("-" + name);
        parameter_array.push(parameters[name]);
    }
    let f = frame.toString();
    while (f.length < 5) {
        f = "0" + f;
    }
    child_process.spawnSync("./offline", [...parameter_array, "-output", "animation/frame-" + f + ".raw", "-width", width, "-height", height, "-samples", samples]);
    child_process.spawnSync("python", ["convert_image.py", "animation/frame-" + f + ".raw", "animation/frame-" + f + ".png", width, height]);

    let t1 = new Date().getTime();
    let tFrame = (t1 - t0) / 1000;
    console.log(`${tFrame.toFixed(1)}s per frame. Estimated time left: ${(((total_frames - frame) * tFrame) / 3600).toFixed(1)} hours`);
}
