#include <iostream>
#include <math.h>
#include <mutex>
#include <vector>

#ifndef WIN32
#include <unistd.h>
#endif

#include <lo/lo.h>
#include <lo/lo_cpp.h>

#include "opengl.h"
#include "renderer.h"
#include "fractal.h"

GLFWwindow *window;

BuddhabrotRenderer *renderer;
BuddhabrotFractal *fractal;

BuddhabrotFractal::BuddhabrotFractalParameters fractal_parameters;
std::vector<float> colormap1;
std::vector<float> colormap2;
std::vector<float> colormap3;
bool should_set_colormap = false;

std::mutex mutex;

class FPSCounter
{
  public:
    FPSCounter()
    {
        tLastFrame = glfwGetTime();
        dts.resize(10);
        total = 0;
        ptr = 0;
    }

    void frame()
    {
        double t = glfwGetTime();
        double dt = t - tLastFrame;
        tLastFrame = t;

        total -= dts[ptr];
        dts[ptr] = dt;
        total += dt;
        ptr = (ptr + 1) % dts.size();

        if (ptr == 0)
        {
            std::cerr << "FPS: " << 1.0 / (total / dts.size()) << std::endl;
        }
    }

  private:
    std::vector<double> dts;
    int ptr;
    double total = 0;
    double tLastFrame = 0;
};

FPSCounter fps;

void render()
{
    fps.frame();

    int width, height;
    glfwGetFramebufferSize(window, &width, &height);

    glClearColor(0, 0, 0, 1);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    mutex.lock();
    fractal->parameters = fractal_parameters;
    if (should_set_colormap)
    {
        renderer->setColormap(&colormap1[0], &colormap2[0], &colormap3[0], colormap1.size() / 3);
        should_set_colormap = false;
    }
    mutex.unlock();

    if (width < height)
    {
        renderer->render(0, (height - width) >> 1, width, width);
    }
    else
    {
        renderer->render((width - height) >> 1, 0, height, height);
    }
}

int main(int argc, char *argv[])
{
    glfwInit();

    glfwDefaultWindowHints();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

    window = glfwCreateWindow(800, 800, "Buddhabrot Renderer", nullptr, nullptr);

    glfwMakeContextCurrent(window);

    glewInit();

    BuddhabrotRendererOptions options;
    options.samplerSize = 512;
    options.samplerMipmapLevel = 1;
    options.samplerMaxIterations = 256;
    options.samplerLowerBound = 100000;
    options.renderSize = 2048;
    options.renderIterations = 64;

    fractal = Fractal::CreateBuddhabrot();
    options.fractal = fractal;

    renderer = new BuddhabrotRenderer(options);

    lo::ServerThread st(9000);
    st.add_method("buddhabrot_parameters", "fffffffffffff", [](lo_arg **argv, int) {
        int i = 0;
        mutex.lock();
        fractal_parameters.z3_scaler = argv[i++]->f;
        fractal_parameters.z3_angle = argv[i++]->f;
        fractal_parameters.z3_yscale = argv[i++]->f;
        fractal_parameters.z2_scaler = argv[i++]->f;
        fractal_parameters.z2_angle = argv[i++]->f;
        fractal_parameters.z2_yscale = argv[i++]->f;
        fractal_parameters.z1_scaler = argv[i++]->f;
        fractal_parameters.z1_angle = argv[i++]->f;
        fractal_parameters.z1_yscale = argv[i++]->f;
        fractal_parameters.rotation_zxcx = argv[i++]->f;
        fractal_parameters.rotation_zxcy = argv[i++]->f;
        fractal_parameters.rotation_zycx = argv[i++]->f;
        fractal_parameters.rotation_zycy = argv[i++]->f;
        mutex.unlock();
    });
    st.add_method("buddhabrot_colormap", "bbb", [](lo_arg **argv, int argc) {
        mutex.lock();
        should_set_colormap = true;
        float *ptr1 = reinterpret_cast<float *>(&argv[0]->blob.data);
        float *ptr2 = reinterpret_cast<float *>(&argv[1]->blob.data);
        float *ptr3 = reinterpret_cast<float *>(&argv[2]->blob.data);
        colormap1.assign(ptr1, ptr1 + argv[0]->blob.size / 4);
        colormap2.assign(ptr2, ptr2 + argv[1]->blob.size / 4);
        colormap3.assign(ptr3, ptr3 + argv[2]->blob.size / 4);
        mutex.unlock();
    });
    st.start();

    while (!glfwWindowShouldClose(window))
    {
        render();
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    delete renderer;

    return 0;
}