var osc = require('node-osc');

var client = new osc.Client('127.0.0.1', 8001);
var server = new osc.Server(6449, '127.0.0.1');

hand_state = {
    L: {
        x: 0, y: 0, z: 0,
        nx: 0, ny: 0, nz: 0
    },
    R: {
        x: 0, y: 0, z: 0,
        nx: 0, ny: 0, nz: 0
    }
};

var gesture_fractals = {
    "1": {
        z3_scaler: 0,
        z3_angle: 0,
        z3_yscale: 1,
        z2_scaler: 1,
        z2_angle: 0,
        z2_yscale: 1,
        z1_scaler: 0,
        z1_angle: 0,
        z1_yscale: 1,
    },
    "2": {
        z3_scaler: 0,
        z3_angle: 0,
        z3_yscale: 1,
        z2_scaler: 1,
        z2_angle: 0,
        z2_yscale: -1,
        z1_scaler: 0,
        z1_angle: 0,
        z1_yscale: 1,
    },
    "3": {
        z3_scaler: 1,
        z3_angle: 180,
        z3_yscale: 1,
        z2_scaler: 0,
        z2_angle: 0,
        z2_yscale: 1,
        z1_scaler: 0,
        z1_angle: 0,
        z1_yscale: 1,
    },
    "4": {
        z3_scaler: 1,
        z3_angle: 0,
        z3_yscale: -1,
        z2_scaler: 0,
        z2_angle: 0,
        z2_yscale: 1,
        z1_scaler: 0.95,
        z1_angle: 170,
        z1_yscale: 1,
    },
    "5": {
        z3_scaler: 1,
        z3_angle: 180,
        z3_yscale: 1,
        z2_scaler: 0,
        z2_angle: 0,
        z2_yscale: 1,
        z1_scaler: 0.5,
        z1_angle: 0,
        z1_yscale: 1,
    },
    "6": {
        z3_scaler: 0.58,
        z3_angle: 180,
        z3_yscale: 1,
        z2_scaler: 0,
        z2_angle: 0,
        z2_yscale: 1,
        z1_scaler: 1.68,
        z1_angle: 180,
        z1_yscale: 1,
    },
    "7": {
        z3_scaler: 0,
        z3_angle: 0,
        z3_yscale: 1,
        z2_scaler: 1,
        z2_angle: -180,
        z2_yscale: 0.926,
        z1_scaler: 1.933,
        z1_angle: 180,
        z1_yscale: 0,
    }
};

let tLastGesture = 0;
let tLastChange = 0;
let lastMessageSig = "";

server.on("message", (args) => {
    if (args[0] == "/leap") {
        let index = 1;
        let lx = args[index++];
        let ly = args[index++];
        let lz = args[index++];
        let lnx = args[index++];
        let lny = args[index++];
        let lnz = args[index++];
        let rx = args[index++];
        let ry = args[index++];
        let rz = args[index++];
        let rnx = args[index++];
        let rny = args[index++];
        let rnz = args[index++];
        hand_state.L = { x: lx, y: ly, z: lz, nx: lnx, ny: lny, nz: lnz };
        hand_state.R = { x: rx, y: ry, z: rz, nx: rnx, ny: rny, nz: rnz };
        let gesture = args[args.length - 1];
        let t = new Date().getTime();
        if (gesture_fractals[gesture] && t - tLastGesture > 1000) {
            tLastGesture = t;
            console.log("Gesture " + gesture + " recognized");
            target_params = gesture_fractals[gesture];
        }
        tLastMessage = t;

        let sig = args.join(",");
        if (sig != lastMessageSig) {
            tLastChange = t;
        }
        if (t - tLastChange > 5000) {
            target_params = gesture_fractals[1];
        }
        lastMessageSig = sig;
    }
});

var params = {
    z3_scaler: 0,
    z3_angle: 0,
    z3_yscale: 1,
    z2_scaler: 1,
    z2_angle: 0,
    z2_yscale: 1,
    z1_scaler: 0,
    z1_angle: 0,
    z1_yscale: 1,
    rotation_zxcx: 0,
    rotation_zxcy: 0,
    rotation_zycx: 0,
    rotation_zycy: 0,
    scale: 0
};

let target_params = params;

var animation = require("./animation-1.json");
var colormaps = require("./data/colormaps_generated.json");

let shape_parameters = [
    "z3_scaler",
    "z3_angle",
    "z3_yscale",
    "z2_scaler",
    "z2_angle",
    "z2_yscale",
    "z1_scaler",
    "z1_angle",
    "z1_yscale"
];

function post_parameters(params) {
    client.send('buddhabrot_parameters',
        params.z3_scaler,
        params.z3_angle,
        params.z3_yscale,
        params.z2_scaler,
        params.z2_angle,
        params.z2_yscale,
        params.z1_scaler,
        params.z1_angle,
        params.z1_yscale,
        params.rotation_zxcx,
        params.rotation_zxcy,
        params.rotation_zycx,
        params.rotation_zycy,
        params.scale
    );
}

function interp_paramters(a, b, t) {
    let r = {};
    for (let n in a) {
        r[n] = a[n] * (1 - t) + b[n] * t;
    }
    return r;
}

function setColormap(v1, v2, v3) {
    let buf1 = new Buffer(v1.length * 12);
    for (let i = 0; i < v1.length; i++) {
        buf1.writeFloatLE(v1[i][0], 12 * i);
        buf1.writeFloatLE(v1[i][1], 12 * i + 4);
        buf1.writeFloatLE(v1[i][2], 12 * i + 8);
    }
    let buf2 = new Buffer(v2.length * 12);
    for (let i = 0; i < v2.length; i++) {
        buf2.writeFloatLE(v2[i][0], 12 * i);
        buf2.writeFloatLE(v2[i][1], 12 * i + 4);
        buf2.writeFloatLE(v2[i][2], 12 * i + 8);
    }
    let buf3 = new Buffer(v3.length * 12);
    for (let i = 0; i < v3.length; i++) {
        buf3.writeFloatLE(v3[i][0], 12 * i);
        buf3.writeFloatLE(v3[i][1], 12 * i + 4);
        buf3.writeFloatLE(v3[i][2], 12 * i + 8);
    }
    client.send({
        address: "buddhabrot_colormap",
        args: [
            buf1, buf2, buf3
        ]
    });
}

function findColormap(name) {
    for (let x of colormaps) {
        if (x.name == name) {
            return x;
        }
    }
}

class TemporalAverager {
    constructor() {
        this.values = {};
        this.rate = 0.99;
    }

    smooth(name, value, dt) {
        if (this.values.hasOwnProperty(name)) {
            let rv = this.values[name] * this.rate + value * (1 - this.rate);
            this.values[name] = rv;
            return rv;
        } else {
            this.values[name] = value;
            return value;
        }
    }

    velocity(name, value, dt) {
        if (this.values.hasOwnProperty(name)) {
            let r = (value - this.values[name]) / dt;
            this.values[name] = value;
            return r;
        } else {
            this.values[name] = value;
            return 0;
        }
    }

    omega(name, x, y, dt) {
        if (this.values.hasOwnProperty(name)) {
            let px = this.values[name][0];
            let py = this.values[name][1];
            let r = x * py - y * px;
            let dist1 = Math.sqrt(x * x + y * y);
            let dist2 = Math.sqrt(px * px + py * py);
            this.values[name] = [x, y];
            return r / (1e-8 + dist1 * dist2) / dt;
        } else {
            this.values[name] = [x, y];
            return 0;
        }
    }
}

let avg = new TemporalAverager();

setColormap(colormaps[0].colormap_xyz, colormaps[1].colormap_xyz, colormaps[2].colormap_xyz);

let t0 = new Date().getTime();
let time0 = 0;

setInterval(() => {
    let time = (new Date().getTime() - t0) / 1000;
    let dt = time - time0;
    time0 = time;

    post_parameters(params);

    let dx = hand_state.L.x - hand_state.R.x;
    let dy = hand_state.L.y - hand_state.R.y;
    let dz = hand_state.L.z - hand_state.R.z;

    let omega = avg.omega("omega", dz, dx, dt);
    omega *= 50;
    omega = avg.smooth("omega_s", omega, dt);

    let omegaY = avg.omega("omegaY", dy, dx, dt);
    omegaY *= 50;
    omegaY = avg.smooth("omegaY_s", omegaY, dt);

    let dLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
    let ddLength = avg.velocity("dlength", dLength, dt);
    ddLength = avg.smooth("dlength_s", ddLength, dt);

    let vZ = avg.smooth("vZ_s", avg.velocity("vZ", (hand_state.L.z + hand_state.R.z) / 2, dt), dt);

    let vy = avg.velocity("vy", (hand_state.L.y + hand_state.R.y) / 2, dt);
    vy = avg.smooth("vy_s", vy, dt);

    let k = 0.01;
    params.rotation_zycx += dt * (-omega - params.rotation_zycx) / k;
    params.rotation_zxcx += dt * (-vy / 10 - params.rotation_zxcx) / k;
    params.rotation_zxcy += dt * (omegaY - params.rotation_zxcy) / k;
    params.scale += dt * (ddLength / 300 - params.scale) / k;

    let target_frame = { parameters: target_params };
    for (let shape_p of shape_parameters) {
        params[shape_p] += dt * (target_frame.parameters[shape_p] - params[shape_p]) / 1;
    }
}, 10);

