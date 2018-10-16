let io = require("socket.io");
let express = require("express");
let http = require("http");
let osc = require("node-osc");

app = express();

let httpServer = http.createServer(app);
let socket = io(httpServer);

app.use(express.static("."));

let sockets = new Set();

socket.on("connection", (socket) => {
    console.log("Client connected: " + socket.id);
    sockets.add(socket);
    socket.on("disconnect", () => {
        console.log("Client disconnected: " + socket.id);
        sockets.delete(socket);
    });
});

function broadcast(data) {
    for (let s of sockets) {
        s.send(data)
    }
}

let oscServer = new osc.Server(8001, "0.0.0.0");

oscServer.on("buddhabrot_parameters", (pm) => {

    broadcast({
        type: "parameters",
        parameters: {
            z3_scaler: pm[1],
            z3_angle: pm[2],
            z3_yscale: pm[3],
            z2_scaler: pm[4],
            z2_angle: pm[5],
            z2_yscale: pm[6],
            z1_scaler: pm[7],
            z1_angle: pm[8],
            z1_yscale: pm[9],
            rotation_zxcx: pm[10],
            rotation_zxcy: pm[11],
            rotation_zycx: pm[12],
            rotation_zycy: pm[13],
            scale: pm[14]
        }
    });
});

httpServer.listen(8000, "0.0.0.0");