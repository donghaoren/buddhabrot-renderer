let internals = require("./sampler_wasm")();
var isInitialized = false;
var initializedHooks = [];
internals.onRuntimeInitialized = function () {
    isInitialized = true;
    for (let i = 0; i < initializedHooks.length; i++) {
        initializedHooks[i]();
    }
};
function initialize() {
    return new Promise(function (resolve, reject) {
        if (isInitialized) {
            resolve();
        } else {
            initializedHooks.push(function () {
                resolve();
            });
        }
    });
}

/*
sampler_t *sampler_create();
void sampler_set_size(sampler_t *sampler, int width, int height);
void sampler_sample(sampler_t *sampler, unsigned char *array);
float *sampler_get_samples(sampler_t *sampler);
int sampler_get_samples_count(sampler_t *sampler);
void sampler_destroy(sampler_t *sampler);
*/
var sampler_create = internals.cwrap("sampler_create", "number", []);
var sampler_set_size = internals.cwrap("sampler_set_size", null, ["number", "number", "number"]);
var sampler_set_lower_bound = internals.cwrap("sampler_set_lower_bound", null, ["number", "number"]);
var sampler_sample = internals.cwrap("sampler_sample", null, ["number"]);
var sampler_get_buffer = internals.cwrap("sampler_get_buffer", "number", ["number"]);
var sampler_get_samples = internals.cwrap("sampler_get_samples", "number", ["number"]);
var sampler_get_samples_count = internals.cwrap("sampler_get_samples_count", "number", ["number"]);
var sampler_destroy = internals.cwrap("sampler_destroy", null, ["number"]);

function Sampler() {
    this.sampler = sampler_create();
    this.width = 0;
    this.height = 0;
}
Sampler.prototype.setSize = function (w, h) {
    sampler_set_size(this.sampler, w, h);
    this.width = w;
    this.height = h;
};
Sampler.prototype.setLowerBound = function (m) {
    sampler_set_lower_bound(this.sampler, m);
};
Sampler.prototype.sample = function () {
    sampler_sample(this.sampler);
};
Sampler.prototype.getBuffer = function () {
    var pointer = sampler_get_buffer(this.sampler);
    return new Uint8Array(internals.HEAPU8.buffer, pointer, this.width * this.height);
};
Sampler.prototype.getSamples = function () {
    var pointer = sampler_get_samples(this.sampler);
    return new Float32Array(internals.HEAPF32.buffer, pointer, this.getSamplesCount() * 3);
};
Sampler.prototype.getSamplesCount = function () {
    return sampler_get_samples_count(this.sampler);
};
Sampler.prototype.destroy = function () {
    sampler_destroy(this.sampler);
};

exports.initialize = initialize;
exports.Sampler = Sampler;