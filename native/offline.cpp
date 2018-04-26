#include <iostream>
#include <math.h>
#include <vector>

#include "opengl.h"
#include "renderer.h"
#include "fractal.h"
#include <stdio.h>

GLFWwindow *window;

BuddhabrotRenderer *renderer;
BuddhabrotFractal *fractal;

int main(int argc, char *argv[])
{
    glfwInit();

    glfwDefaultWindowHints();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_VISIBLE, GLFW_FALSE);

    window = glfwCreateWindow(800, 800, "", nullptr, nullptr);

    glfwMakeContextCurrent(window);

    glewInit();

    BuddhabrotRendererOptions options;
    options.samplerSize = 1024;
    options.samplerMipmapLevel = 1;
    options.samplerMaxIterations = 256;
    options.samplerLowerBound = 5000000 / 4;
    options.renderSize = 1024;
    options.renderIterations = 64;

    fractal = Fractal::CreateBuddhabrot();
    options.fractal = fractal;

    renderer = new BuddhabrotRenderer(options);

    GLuint framebufferTexture;
    GLuint framebuffer;

    glGenTextures(1, &framebufferTexture);
    glBindTexture(GL_TEXTURE_2D, framebufferTexture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, options.renderSize, options.renderSize, 0, GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
    glBindTexture(GL_TEXTURE_2D, 0);

    // Create framebuffer and assign the texture
    glGenFramebuffers(1, &framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, framebufferTexture, 0);

    glClearColor(0, 0, 0, 1);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    renderer->renderWithDenoise(0, 0, options.renderSize, options.renderSize, framebuffer);

    std::vector<unsigned char> pixels(options.renderSize * options.renderSize * 4);

    glReadPixels(0, 0, options.renderSize, options.renderSize, GL_RGBA, GL_UNSIGNED_BYTE, &pixels[0]);

    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // Write the pixels to output
    FILE *fo = fopen("output.raw", "wb");
    fwrite(&pixels[0], sizeof(unsigned char), pixels.size(), fo);
    fclose(fo);

    delete renderer;

    return 0;
}