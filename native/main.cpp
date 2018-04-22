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
#include "colormaps.h"

GLFWwindow *window;

BuddhabrotRenderer *renderer;
BuddhabrotFractal *fractal;

BuddhabrotFractal::BuddhabrotFractalParameters fractal_parameters;
std::vector<unsigned char> colormap;
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
        renderer->setColormap(&colormap[0], colormap.size() / 4);
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
    options.samplerSize = 1024;
    options.samplerMipmapLevel = 1;
    options.samplerMaxIterations = 512;
    options.samplerMultiplier = 1;
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
    st.add_method("buddhabrot_colormap", "", [](lo_arg **argv, int) {
        mutex.lock();
        should_set_colormap = true;
        unsigned char *ptr = reinterpret_cast<unsigned char *>(argv[0]->blob.data);
        colormap.assign(ptr, ptr + argv[0]->blob.size);
        mutex.unlock();
    });
    st.start();

    renderer->setColormap(Colormaps::Cubehelix_0_75, Colormaps::Cubehelix_0_75_size);

    while (!glfwWindowShouldClose(window))
    {
        render();
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    delete renderer;

    return 0;
}