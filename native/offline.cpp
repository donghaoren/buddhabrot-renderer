#include <iostream>
#include <math.h>
#include <vector>

#include "opengl.h"
#include "renderer.h"
#include "fractal.h"
#include "colormaps.h"
#include <stdio.h>
#include <string>

GLFWwindow *window;

BuddhabrotRenderer *renderer;
BuddhabrotFractal *fractal;

float parseFloat(const char *str)
{
    return atof(str);
}

int parseInt(const char *str)
{
    return atoi(str);
}

int main(int argc, char *argv[])
{
    glfwInit();

    glfwDefaultWindowHints();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_VISIBLE, GL_FALSE);

    window = glfwCreateWindow(800, 800, "", nullptr, nullptr);

    glfwMakeContextCurrent(window);

    glewInit();

    BuddhabrotRendererOptions options;
    options.samplerSize = 1024;
    options.samplerMipmapLevel = 1;
    options.samplerMaxIterations = 256;
    options.samplerLowerBound = 1000000;
    options.renderWidth = 1920;
    options.renderHeight = 1080;
    options.renderIterations = 64;

    fractal = Fractal::CreateBuddhabrot();
    options.fractal = fractal;

    std::string output_file("output.raw");

    // Setup parameters
    for (int i = 1; i < argc; i++)
    {
        std::string name = argv[i];
        if (name == "-z3_scaler")
            fractal->parameters.z3_scaler = parseFloat(argv[++i]);
        if (name == "-z3_angle")
            fractal->parameters.z3_angle = parseFloat(argv[++i]);
        if (name == "-z3_yscale")
            fractal->parameters.z3_yscale = parseFloat(argv[++i]);
        if (name == "-z2_scaler")
            fractal->parameters.z2_scaler = parseFloat(argv[++i]);
        if (name == "-z2_angle")
            fractal->parameters.z2_angle = parseFloat(argv[++i]);
        if (name == "-z2_yscale")
            fractal->parameters.z2_yscale = parseFloat(argv[++i]);
        if (name == "-z1_scaler")
            fractal->parameters.z1_scaler = parseFloat(argv[++i]);
        if (name == "-z1_angle")
            fractal->parameters.z1_angle = parseFloat(argv[++i]);
        if (name == "-z1_yscale")
            fractal->parameters.z1_yscale = parseFloat(argv[++i]);
        if (name == "-rotation_zxcx")
            fractal->parameters.rotation_zxcx = parseFloat(argv[++i]);
        if (name == "-rotation_zxcy")
            fractal->parameters.rotation_zxcy = parseFloat(argv[++i]);
        if (name == "-rotation_zycx")
            fractal->parameters.rotation_zycx = parseFloat(argv[++i]);
        if (name == "-rotation_zycy")
            fractal->parameters.rotation_zycy = parseFloat(argv[++i]);
        if (name == "-output" || name == "-o")
            output_file = argv[++i];
        if (name == "-width")
            options.renderWidth = parseInt(argv[++i]);
        if (name == "-height")
            options.renderHeight = parseInt(argv[++i]);
        if (name == "-samples")
            options.samplerLowerBound = parseInt(argv[++i]);
    }

    renderer = new BuddhabrotRenderer(options);
    renderer->setColormap(
        Colormaps::Default1__royalblue,
        Colormaps::Default2__lime,
        Colormaps::Default3__red,
        Colormaps::Default1__royalblue_size);

    GLuint framebufferTexture;
    GLuint framebuffer;

    glGenTextures(1, &framebufferTexture);
    glBindTexture(GL_TEXTURE_2D, framebufferTexture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, options.renderWidth, options.renderHeight, 0, GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
    glBindTexture(GL_TEXTURE_2D, 0);

    // Create framebuffer and assign the texture
    glGenFramebuffers(1, &framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, framebufferTexture, 0);

    glClearColor(0, 0, 0, 1);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    renderer->renderWithDenoise(0, 0, options.renderWidth, options.renderHeight, framebuffer);

    std::vector<unsigned char> pixels(options.renderWidth * options.renderHeight * 4);

    glReadPixels(0, 0, options.renderWidth, options.renderHeight, GL_RGBA, GL_UNSIGNED_BYTE, &pixels[0]);

    int stride = options.renderWidth * 4;
    for (int y = 0; y < options.renderHeight / 2; y++)
    {
        unsigned char *p1 = &pixels[y * stride];
        unsigned char *p2 = &pixels[(options.renderHeight - 1 - y) * stride];
        for (int x = 0; x < stride; x++)
        {
            unsigned char tmp = p1[x];
            p1[x] = p2[x];
            p2[x] = tmp;
        }
    }

    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // Write the pixels to output
    FILE *fo = fopen(output_file.c_str(), "wb");
    fwrite(&pixels[0], sizeof(unsigned char), pixels.size(), fo);
    fclose(fo);

    delete renderer;

    return 0;
}