#ifndef BUDDHABROT_RENDERER_FRACTAL_H
#define BUDDHABROT_RENDERER_FRACTAL_H

#include <string>
#include "opengl.h"

class Fractal
{
  public:
    virtual std::string getShaderFunction() = 0;
    virtual void setShaderUniforms(GLuint shader) = 0;
    virtual ~Fractal() {}

    static class BuddhabrotFractal *CreateBuddhabrot();
};

class BuddhabrotFractal : public Fractal
{
  public:
    struct BuddhabrotFractalParameters
    {
        float z3_scaler, z3_angle, z3_yscale;
        float z2_scaler, z2_angle, z2_yscale;
        float z1_scaler, z1_angle, z1_yscale;
        float rotation_zxcx;
        float rotation_zxcy;
        float rotation_zycx;
        float rotation_zycy;

        BuddhabrotFractalParameters()
        {
            z3_scaler = 0;
            z3_angle = 0;
            z3_yscale = 1;
            z2_scaler = 1;
            z2_angle = 0;
            z2_yscale = 1;
            z1_scaler = 0;
            z1_angle = 0;
            z1_yscale = 1;
            rotation_zxcx = 0;
            rotation_zxcy = 0;
            rotation_zycx = 0;
            rotation_zycy = 0;
        }
    };

    BuddhabrotFractalParameters parameters;

    BuddhabrotFractal();
    virtual std::string getShaderFunction();
    virtual void setShaderUniforms(GLuint shader);
};

#endif