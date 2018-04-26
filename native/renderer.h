#ifndef BUDDHABROT_RENDERER_RENDERER_H
#define BUDDHABROT_RENDERER_RENDERER_H

#include "opengl.h"
#include "fractal.h"
#include "sampler.h"

struct BuddhabrotRendererOptions
{
    int samplerSize;
    int samplerMipmapLevel;
    int samplerMaxIterations;
    int samplerLowerBound;
    int renderSize;
    int renderIterations;

    Fractal *fractal;
};

class BuddhabrotSampler
{
  public:
    BuddhabrotSampler(const BuddhabrotRendererOptions &options);

    void render();
    void sample();

    GLuint getBuffer() { return samplesBuffer; }
    int getSamplesCount() { return samplesCount; }

    ~BuddhabrotSampler();

  private:
    BuddhabrotRendererOptions options;

    GLuint framebuffer;
    GLuint framebufferTexture;
    GLuint quadVertices;
    GLuint vertexArray;
    GLuint program;
    GLuint samplesBuffer;
    int samplesCount;

    int mipmapSize;
    unsigned char *pixels;
    sampler_t *sampler;
};

class BuddhabrotRenderer
{
  public:
    BuddhabrotRenderer(const BuddhabrotRendererOptions &options);

    void render(int x, int y, int width, int height);

    void setScaler(float scaler);
    void setColormap(float *cm1, float *cm2, float *cm3, int length);

    ~BuddhabrotRenderer();

  private:
    BuddhabrotRendererOptions options;
    BuddhabrotSampler sampler;
    GLuint framebuffer;
    GLuint framebufferTexture;
    GLuint vertexArray;
    GLuint program;
    GLuint programDisplay;
    GLuint quadVertices;
    GLuint vertexArrayQuad;

    float scaler;
    int colormapLength;

    GLuint colormapTexture;
};

#endif