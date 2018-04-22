#include <string>
#include <iostream>
#include <exception>

#include "renderer.h"

void assertGLError()
{
    GLenum error = glGetError();
    if (error != 0)
    {
        std::cerr << "OpenGL Error: " << error << std::endl;
    }
}

class ShaderCompileError : public std::exception
{
};

void shader_source_and_compile(GLuint shader, std::string code)
{
    const char *code_buf[] = {code.c_str()};
    GLint code_length[] = {(GLint)code.size()};
    glShaderSource(shader, 1, code_buf, code_length);
    glCompileShader(shader);
    GLint v[1];
    glGetShaderiv(shader, GL_COMPILE_STATUS, v);
    if (v[0] != GL_TRUE)
    {
        char buffer[4096] = {0};
        GLsizei length;
        glGetShaderInfoLog(shader, 4095, &length, buffer);
        std::cerr << "shader compilation error - code:" << std::endl;
        std::cerr << code << std::endl;
        std::cerr << "message:" << std::endl;
        std::cerr << buffer << std::endl;
        throw ShaderCompileError();
    }
}

GLuint compile_shader_program(std::string vs_code, std::string fs_code)
{
    GLuint vs = glCreateShader(GL_VERTEX_SHADER);
    GLuint fs = glCreateShader(GL_FRAGMENT_SHADER);
    shader_source_and_compile(vs, vs_code);
    shader_source_and_compile(fs, fs_code);
    GLuint program = glCreateProgram();
    glAttachShader(program, vs);
    glAttachShader(program, fs);
    glLinkProgram(program);
    GLint v[1];
    glGetProgramiv(program, GL_LINK_STATUS, v);
    if (v[0] != GL_TRUE)
    {
        std::cerr << "program link error!" << std::endl;
        throw ShaderCompileError();
    }
    return program;
}

GLuint compile_shader_program(std::string vs_code, std::string gs_code, std::string fs_code)
{
    GLuint vs = glCreateShader(GL_VERTEX_SHADER);
    GLuint gs = glCreateShader(GL_GEOMETRY_SHADER);
    GLuint fs = glCreateShader(GL_FRAGMENT_SHADER);
    shader_source_and_compile(vs, vs_code);
    shader_source_and_compile(gs, gs_code);
    shader_source_and_compile(fs, fs_code);
    GLuint program = glCreateProgram();
    glAttachShader(program, vs);
    glAttachShader(program, gs);
    glAttachShader(program, fs);
    glLinkProgram(program);
    GLint v[1];
    glGetProgramiv(program, GL_LINK_STATUS, v);
    if (v[0] != GL_TRUE)
    {
        std::cerr << "program link error!" << std::endl;
        throw ShaderCompileError();
    }
    return program;
}

BuddhabrotSampler::BuddhabrotSampler(const BuddhabrotRendererOptions &_options) : options(_options)
{
    int size = options.samplerSize;

    glGenTextures(1, &framebufferTexture);
    glBindTexture(GL_TEXTURE_2D, framebufferTexture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_R8, size, size, 0, GL_RED, GL_UNSIGNED_BYTE, nullptr);
    glBindTexture(GL_TEXTURE_2D, 0);

    // Create framebuffer and assign the texture
    glGenFramebuffers(1, &framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, framebufferTexture, 0);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    program = compile_shader_program(
        R"__CODE__(#version 330
            layout(location = 0) in vec2 a_position;
            void main () {
                gl_Position = vec4(a_position, 0, 1);
            }
        )__CODE__",
        std::string(R"__CODE__(#version 330
            uniform vec2 u_resolution;
            uniform int u_maxIterations;
            layout(location = 0) out vec4 frag_color;

        )__CODE__") +
            options.fractal->getShaderFunction() + std::string(R"__CODE__(

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution;
                vec2 c = uv * 4.0 - vec2(2.0);
                vec2 z = vec2(0.0);
                vec2 z1;
                bool escaped = false;
                int i;
                for (i = 0; i <= u_maxIterations; i++) {
                    z1 = fractal(z, c);
                    if(z.x == z1.x && z.y == z1.y) {
                        i = u_maxIterations;
                        break;
                    }
                    z = z1;
                    if (z.x * z.x + z.y * z.y > 16.0) {
                        escaped = true;
                        break;
                    }
                }
                float v = float(i >= 16 ? i : 0) / 255.0;
                frag_color = escaped ? vec4(vec3(v), 1.0) : vec4(0, 0, 0, 1);
            }
        )__CODE__"));

    // Build full screen quad vertices
    glGenBuffers(1, &quadVertices);
    glBindBuffer(GL_ARRAY_BUFFER, quadVertices);
    float data[] = {-1, -1, -1, 1, 1, -1, 1, 1};
    glBufferData(GL_ARRAY_BUFFER, sizeof(float) * 8, data, GL_STATIC_DRAW);

    glGenVertexArrays(1, &vertexArray);
    glBindVertexArray(vertexArray);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 8, 0);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);

    // Initial uniforms
    glUseProgram(program);
    glUniform2f(glGetUniformLocation(program, "u_resolution"), size, size);
    glUniform1i(glGetUniformLocation(program, "u_maxIterations"), options.samplerMaxIterations);

    glUseProgram(0);

    mipmapSize = size >> options.samplerMipmapLevel;
    sampler = sampler_create();
    sampler_set_size(sampler, mipmapSize, mipmapSize);
    sampler_set_multiplier(sampler, options.samplerMultiplier);

    glGenBuffers(1, &samplesBuffer);

    assertGLError();
}

void BuddhabrotSampler::sample()
{
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    glViewport(0, 0, options.samplerSize, options.samplerSize);
    glUseProgram(program);
    options.fractal->setShaderUniforms(program);
    glBindVertexArray(vertexArray);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    glBindVertexArray(0);
    glUseProgram(0);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    glBindTexture(GL_TEXTURE_2D, framebufferTexture);
    glGenerateMipmap(GL_TEXTURE_2D);
    glGetTexImage(GL_TEXTURE_2D, options.samplerMipmapLevel, GL_RED, GL_UNSIGNED_BYTE, sampler_get_buffer(sampler));
    glBindTexture(GL_TEXTURE_2D, 0);

    sampler_sample(sampler);

    float *samples = sampler_get_samples(sampler);
    samplesCount = sampler_get_samples_count(sampler);

    glBindBuffer(GL_ARRAY_BUFFER, samplesBuffer);
    glBufferData(GL_ARRAY_BUFFER, sizeof(float) * 3 * samplesCount, samples, GL_STATIC_DRAW);
    glBindBuffer(GL_ARRAY_BUFFER, 0);

    assertGLError();
}

BuddhabrotSampler::~BuddhabrotSampler()
{
    glDeleteProgram(program);
    glDeleteBuffers(1, &quadVertices);
    glDeleteFramebuffers(1, &framebuffer);
    glDeleteTextures(1, &framebufferTexture);
    sampler_destroy(sampler);
}

BuddhabrotRenderer::BuddhabrotRenderer(const BuddhabrotRendererOptions &_options) : options(_options), sampler(_options)
{
    glGenTextures(1, &framebufferTexture);
    glBindTexture(GL_TEXTURE_2D, framebufferTexture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_R32F, options.renderSize, options.renderSize, 0, GL_RED, GL_FLOAT, nullptr);
    glBindTexture(GL_TEXTURE_2D, 0);

    // Create framebuffer and assign the texture
    glGenFramebuffers(1, &framebuffer);
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, framebufferTexture, 0);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    glGenVertexArrays(1, &vertexArray);
    glBindVertexArray(vertexArray);
    glBindBuffer(GL_ARRAY_BUFFER, sampler.getBuffer());
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 12, 0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindVertexArray(0);

    program = compile_shader_program(
        R"__CODE__(#version 330
            layout(location = 0) in vec3 vi_sample;
            out vec3 vo_sample;
            void main () {
                vo_sample = vi_sample;
            }
        )__CODE__",
        std::string(R"__CODE__(#version 330
            layout(points) in;
            layout(points, max_vertices = 64) out;
            in vec3 vo_sample[1];
            out float a_multiplier;

        )__CODE__") +
            options.fractal->getShaderFunction() + std::string(R"__CODE__(

            void main () {
                vec2 c = vo_sample[0].xy;
                vec2 z = vec2(0);
                a_multiplier = vo_sample[0].z;
                // int diverge = 0;
                // for(int i = 0; i < 256; i++) {
                //     z = fractal(z, c);
                //     if(z.x * z.x + z.y * z.y >= 16.0) {
                //         diverge = i;
                //         break;
                //     }
                // }
                // z = vec2(0);
                // if(diverge != 0) {
                //     for(int i = 0; i < diverge; i++) {
                //         z = fractal(z, c);
                //         if(i >= 4) {
                //             gl_Position = vec4(fractal_projection(z, c) / 2.0, 0, 1);
                //             EmitVertex();
                //         }
                //     }
                // }

                for(int i = 0; i < 64; i++) {
                    z = fractal(z, c);
                    if(i >= 4) {
                        gl_Position = vec4(fractal_projection(z, c) / 2.0, 0, 1);
                        EmitVertex();
                    }
                    if(z.x * z.x + z.y * z.y >= 16.0) {
                        break;
                    }
                }
            }
        )__CODE__"),
        R"__CODE__(#version 330
            in float a_multiplier;
            layout(location = 0) out vec4 v_color;
            void main() {
                v_color = vec4(vec3(a_multiplier), 1);
            }
        )__CODE__");

    programDisplay = compile_shader_program(
        R"__CODE__(#version 330
            layout(location = 0) in vec2 a_position;
            out vec2 vo_position;
            void main () {
                vo_position = (vec2(-a_position.y, a_position.x) + 1.0) / 2.0;
                gl_Position = vec4(a_position, 0, 1);
            }
        )__CODE__",
        std::string(R"__CODE__(#version 330
            uniform sampler2D texInput;
            uniform sampler2D texColor;
            uniform float colormapSize;
            uniform float colormapScaler;
            in vec2 vo_position;
            layout(location = 0) out vec4 frag_color;
            void main() {
                float scale = colormapScaler * 4.0;
                vec4 color = texture(texInput, vo_position);
                float v = min(1.0, sqrt(color.r / scale));
                float pos = (v * (colormapSize - 0.5) + 0.5) / colormapSize;
                frag_color = texture(texColor, vec2(pos, 0.5));
            }
        )__CODE__"));

    // Build full screen quad vertices
    glGenBuffers(1, &quadVertices);
    glBindBuffer(GL_ARRAY_BUFFER, quadVertices);
    float data[] = {-1, -1, -1, 1, 1, -1, 1, 1};
    glBufferData(GL_ARRAY_BUFFER, sizeof(float) * 8, data, GL_STATIC_DRAW);

    glGenVertexArrays(1, &vertexArrayQuad);
    glBindVertexArray(vertexArrayQuad);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 8, 0);
    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);

    glGenTextures(1, &colormapTexture);
    glBindTexture(GL_TEXTURE_2D, colormapTexture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glBindTexture(GL_TEXTURE_2D, 0);

    unsigned char default_colormap[] = {0, 0, 0, 255, 255, 255, 255, 255};
    setColormap(default_colormap, 2);

    scaler = 1;

    assertGLError();
}

void BuddhabrotRenderer::setScaler(float _scaler)
{
    scaler = _scaler;
}
void BuddhabrotRenderer::setColormap(unsigned char *colormap, int length)
{
    glBindTexture(GL_TEXTURE_2D, colormapTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, length, 1, 0, GL_RGBA, GL_UNSIGNED_BYTE, colormap);
    glBindTexture(GL_TEXTURE_2D, 0);
    colormapLength = length;
}

void BuddhabrotRenderer::render(int x, int y, int width, int height)
{
    glViewport(x, y, width, height);
    glDisable(GL_DEPTH_TEST);
    sampler.sample();
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    glViewport(0, 0, options.renderSize, options.renderSize);
    glEnable(GL_BLEND);
    glBlendFunc(GL_ONE, GL_ONE);
    glClearColor(0, 0, 0, 0);
    glClear(GL_COLOR_BUFFER_BIT);
    glUseProgram(program);
    options.fractal->setShaderUniforms(program);
    glBindVertexArray(vertexArray);
    glDrawArrays(GL_POINTS, 0, sampler.getSamplesCount());
    glBindVertexArray(0);
    glUseProgram(0);

    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    glViewport(x, y, width, height);

    glDisable(GL_BLEND);
    glUseProgram(programDisplay);
    glUniform1i(glGetUniformLocation(programDisplay, "texInput"), 0);
    glUniform1i(glGetUniformLocation(programDisplay, "texColor"), 1);
    glUniform1f(glGetUniformLocation(programDisplay, "colormapSize"), colormapLength);
    int accumulateScaler = 1;
    float colormapScaler = scaler * (options.renderIterations - 4) / 800.0 * accumulateScaler;
    colormapScaler /= 256.0 * 256.0 / (options.samplerSize >> options.samplerMipmapLevel) / (options.samplerSize >> options.samplerMipmapLevel);
    glUniform1f(glGetUniformLocation(programDisplay, "colormapScaler"), colormapScaler);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, framebufferTexture);
    glGenerateMipmap(GL_TEXTURE_2D);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, colormapTexture);
    glBindVertexArray(vertexArrayQuad);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    glBindVertexArray(0);
    glUseProgram(0);
    glBindTexture(GL_TEXTURE_2D, 0);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, 0);
}

BuddhabrotRenderer::~BuddhabrotRenderer()
{
}