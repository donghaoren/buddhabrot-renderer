#ifndef BUDDHABROT_RENDERER_SAMPLER_H
#define BUDDHABROT_RENDERER_SAMPLER_H

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define EXPORT
#endif

struct sampler_t;

extern "C" {
EXPORT sampler_t *sampler_create();
EXPORT void sampler_set_size(sampler_t *sampler, int width, int height);
EXPORT void sampler_set_multiplier(sampler_t *sampler, int multiplier);
EXPORT void sampler_sample(sampler_t *sampler);
EXPORT unsigned char *sampler_get_buffer(sampler_t *sampler);
EXPORT float *sampler_get_samples(sampler_t *sampler);
EXPORT int sampler_get_samples_count(sampler_t *sampler);
EXPORT void sampler_destroy(sampler_t *sampler);
}

#endif