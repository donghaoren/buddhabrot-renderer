var osc = require('node-osc');

var client = new osc.Client('127.0.0.1', 9000);

var z3_scaler = 0;
var z3_angle = 0;
var z3_yscale = 1;
var z2_scaler = 1;
var z2_angle = 0;
var z2_yscale = 1;
var z1_scaler = 0;
var z1_angle = 0;
var z1_yscale = 1;
var rotation_zxcx = 0;
var rotation_zxcy = 0;
var rotation_zycx = 0;
var rotation_zycy = 0;

var animation = require("../data/animations.json");

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
    params.rotation_zycy
  );
}

function interp_paramters(a, b, t) {
  let r = {};
  for (let n in a) {
    r[n] = a[n] * (1 - t) + b[n] * t;
  }
  return r;
}

let t0 = new Date().getTime();
setInterval(() => {
  let t1 = new Date().getTime();
  let time = (t1 - t0) / 1000;
  let s = (time) % (animation.length - 1)
  let i1 = Math.floor(s);
  let i2 = i1 + 1;
  i1 = Math.min(animation.length - 1, i1);
  i2 = Math.min(animation.length - 1, i2);
  let t = s - i1;
  post_parameters(interp_paramters(animation[i1].parameters, animation[i2].parameters, t));
}, 10);
