#include "sampler.h"
#include <math.h>
#include <stdlib.h>

struct sampler_t
{
    int width;
    int height;
    int multiplier;
    unsigned char *buffer;
    float *samples;
    int samples_size;
    int samples_count;
};

sampler_t *sampler_create()
{
    sampler_t *r = new sampler_t();
    r->width = 0;
    r->height = 0;
    r->multiplier = 1;
    r->buffer = nullptr;
    r->samples = nullptr;
    r->samples_size = 0;
    r->samples_count = 0;
    return r;
}

void sampler_set_multiplier(sampler_t *sampler, int multiplier)
{
    sampler->multiplier = multiplier;
}

void sampler_set_size(sampler_t *sampler, int width, int height)
{
    sampler->width = width;
    sampler->height = height;
    if (sampler->buffer != nullptr)
        delete[] sampler->buffer;
    sampler->buffer = new unsigned char[width * height];
}

inline float rand01()
{
    return (float)rand() / (float)RAND_MAX;
}

inline float randn_bm()
{
    float v1, v2, s;
    do
    {
        v1 = 2.0f * rand01() - 1.0f;
        v2 = 2.0f * rand01() - 1.0f;
        s = v1 * v1 + v2 * v2;
    } while (s >= 1.0f || s == 0.0f);
    s = sqrt((-2.0f * log(s)) / s) / 2.0f;
    return v1 * s;
}

void sampler_sample(sampler_t *sampler)
{
    unsigned char *array = sampler->buffer;
    int array_length = sampler->width * sampler->height;
    int total_value = 0;
    int multipler = sampler->multiplier;
    for (int i = 0; i < array_length; i++)
    {
        int v = (array[i]) * multipler;
        total_value += v;
    }
    if (sampler->samples == nullptr || sampler->samples_size < total_value)
    {
        sampler->samples_size = total_value * 2;
        sampler->samples = new float[sampler->samples_size * 3];
    }
    float *samples = sampler->samples;
    int i_sample = 0;
    int ix = 0;
    int iy = 0;
    float scale = 1.0f / sampler->width * 4;
    for (int i = 0; i < array_length; i++)
    {
        int v = (array[i]) * multipler;
        float x = ix * scale - 2;
        float y = iy * scale - 2;
        for (int j = 0; j < v; j++)
        {
            float dx = (randn_bm() + 0.5) * scale;
            float dy = (randn_bm() + 0.5) * scale;
            samples[i_sample++] = x + dx;
            samples[i_sample++] = y + dy;
            samples[i_sample++] = 1.0 / v;
        }
        ix++;
        if (ix >= sampler->width)
        {
            ix = 0;
            iy++;
        }
    }
    sampler->samples_count = total_value;
}

float *sampler_get_samples(sampler_t *sampler)
{
    return sampler->samples;
}

int sampler_get_samples_count(sampler_t *sampler)
{
    return sampler->samples_count;
}

unsigned char *sampler_get_buffer(sampler_t *sampler)
{
    return sampler->buffer;
}

void sampler_destroy(sampler_t *sampler)
{
    if (sampler->samples)
    {
        delete[] sampler->samples;
    }
    delete sampler;
}