#include "fractal.h"
#include <math.h>
#include "opengl.h"

#define DEG2RAD (0.01745329252f)

BuddhabrotFractal::BuddhabrotFractal()
{
}

std::string BuddhabrotFractal::getShaderFunction()
{
    return R"_CODE_(
            uniform mat2 fractal_z3_scaler;
            uniform mat2 fractal_z2_scaler;
            uniform mat2 fractal_z1_scaler;
            uniform vec4 fractal_rotation_e1;
            uniform vec4 fractal_rotation_e2;

            vec2 fractal(vec2 z, vec2 c) {
                float xx = z.x * z.x;
                float yy = z.y * z.y;
                vec2 z2 = vec2(xx - yy, z.x * z.y * 2.0);
                vec2 z3 = vec2(xx * z.x - 3.0 * z.x * yy, 3.0 * xx * z.y - yy * z.y);
                return fractal_z3_scaler * z3 + fractal_z2_scaler * z2 + fractal_z1_scaler * z + c;
            }

            vec2 fractal_projection(vec2 z, vec2 c) {
                // return c;
                return vec2(dot(fractal_rotation_e1, vec4(z, c)), dot(fractal_rotation_e2, vec4(z, c)));
            }
        )_CODE_";
}

void shader_uniform_matrix(GLuint shader, const char *name, float theta, float scaler, float yscale)
{
    float matrix[] = {
        cos(theta * DEG2RAD) * scaler, sin(theta * DEG2RAD) * scaler * yscale,
        -sin(theta * DEG2RAD) * scaler, cos(theta * DEG2RAD) * scaler * yscale};
    glUniformMatrix2fv(glGetUniformLocation(shader, name), 1, GL_FALSE, matrix);
}

void rotation4d(float angle, int i1, int i2, float *input, float *output)
{
    float theta = angle * DEG2RAD;
    float r[] = {0, 0, 0, 0};
    for (int i = 0; i < 4; i++)
    {
        if (i == i1)
            r[i] = cos(theta) * input[i1] + sin(theta) * input[i2];
        else if (i == i2)
            r[i] = -sin(theta) * input[i1] + cos(theta) * input[i2];
        else
            r[i] = input[i];
    }
    for (int i = 0; i < 4; i++)
    {
        output[i] = r[i];
    }
}

void BuddhabrotFractal::setShaderUniforms(GLuint shader)
{
    shader_uniform_matrix(shader, "fractal_z1_scaler", parameters.z1_angle, parameters.z1_scaler, parameters.z1_yscale);
    shader_uniform_matrix(shader, "fractal_z2_scaler", parameters.z2_angle, parameters.z2_scaler, parameters.z2_yscale);
    shader_uniform_matrix(shader, "fractal_z3_scaler", parameters.z3_angle, parameters.z3_scaler, parameters.z3_yscale);
    float e1[] = {1, 0, 0, 0};
    float e2[] = {0, 1, 0, 0};

    rotation4d(parameters.rotation_zxcx, 0, 2, e1, e1);
    rotation4d(parameters.rotation_zxcx, 0, 2, e2, e2);
    rotation4d(parameters.rotation_zxcy, 0, 3, e1, e1);
    rotation4d(parameters.rotation_zxcy, 0, 3, e2, e2);
    rotation4d(parameters.rotation_zycx, 1, 2, e1, e1);
    rotation4d(parameters.rotation_zycx, 1, 2, e2, e2);
    rotation4d(parameters.rotation_zycy, 1, 3, e1, e1);
    rotation4d(parameters.rotation_zycy, 1, 3, e2, e2);

    glUniform4fv(glGetUniformLocation(shader, "fractal_rotation_e1"), 1, e1);
    glUniform4fv(glGetUniformLocation(shader, "fractal_rotation_e2"), 1, e2);
}

BuddhabrotFractal *Fractal::CreateBuddhabrot()
{
    return new BuddhabrotFractal();
}