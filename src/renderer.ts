import { Fractal } from "./fractal";
import { Sampler } from "../native/sample_points";

export interface BuddhabrotRendererOptions {
    samplerSize?: number;
    samplerMipmapLevel?: number;
    samplerMaxIterations?: number;
    samplerMultiplier?: number;
    renderSize?: number;
    renderIterations?: number;
}

export interface BuddhabrotRendererProfile {
    name: string;
    options: BuddhabrotRendererOptions;
}

const BuddhabrotRendererOptions_Default: BuddhabrotRendererOptions = {
    samplerSize: 512,
    samplerMipmapLevel: 1,
    samplerMaxIterations: 512,
    samplerMultiplier: 8,
    renderSize: 2048,
    renderIterations: 64
};

const BuddhabrotRendererOptions_Low: BuddhabrotRendererOptions = {
    samplerSize: 512,
    samplerMipmapLevel: 1,
    samplerMaxIterations: 512,
    samplerMultiplier: 4,
    renderSize: 2048,
    renderIterations: 64
};

const BuddhabrotRendererOptions_High: BuddhabrotRendererOptions = {
    samplerSize: 1024,
    samplerMipmapLevel: 1,
    samplerMaxIterations: 512,
    samplerMultiplier: 1,
    renderSize: 2048,
    renderIterations: 128
};


const profiles: BuddhabrotRendererProfile[] = [
    { name: "Low (Fast) 512/1/4", options: BuddhabrotRendererOptions_Low },
    { name: "Medium 512/1/8", options: BuddhabrotRendererOptions_Default },
    { name: "High (Accurate) 1024/1/1", options: BuddhabrotRendererOptions_High }
];

export class ShaderBuilder {
    private gl: WebGL2RenderingContext;
    private fractal: Fractal;

    constructor(gl: WebGL2RenderingContext, fractal: Fractal) {
        this.gl = gl;
        this.fractal = fractal;
    }

    compile(vs_code, fs_code, options?: (p: WebGLProgram) => void): WebGLProgram {
        let gl = this.gl;
        let vs = gl.createShader(gl.VERTEX_SHADER);
        let fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(vs, vs_code);
        gl.compileShader(vs);
        let isValid = gl.getShaderParameter(vs, gl.COMPILE_STATUS);
        if (!isValid) {
            console.info("vertex shader error: " + gl.getShaderInfoLog(vs));
            throw new Error("vertex shader compilation failure");
        }
        gl.shaderSource(fs, fs_code);
        gl.compileShader(fs);
        isValid = gl.getShaderParameter(fs, gl.COMPILE_STATUS);
        if (!isValid) {
            console.info("fragment shader error: " + gl.getShaderInfoLog(fs));
            throw new Error("fragment shader compilation failure");
        }
        let p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        if (options) {
            options(p);
        }
        gl.linkProgram(p);
        isValid = gl.getProgramParameter(p, gl.LINK_STATUS);
        if (!isValid) {
            console.info("program link error: " + gl.getProgramInfoLog(p));
            throw new Error("program link failure");
        }
        return p;
    }

    buildMandelbrot() {
        let vs_code = `
            precision highp float;
            attribute vec2 a_position;
            void main () {
                gl_Position = vec4(a_position, 0, 1);
            }
        `;
        let fs_code = `
            precision highp float;
            uniform vec2 u_resolution;
            uniform int u_maxIterations;

            ${this.fractal.getShaderFunction("f")}

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution;
                vec2 c = uv * 4.0 - vec2(2.0);
                vec2 z = vec2(0.0);
                vec2 z1;
                bool escaped = false;
                int number_iterations = 0;
                for (int i = 0; i < 10000; i++) {
                    if (i >= u_maxIterations) {
                        number_iterations = i;
                        break;
                    }
                    z1 = f(z, c);
                    if(z.x == z1.x && z.y == z1.y) {
                        number_iterations = u_maxIterations;
                        break;
                    }
                    z = z1;
                    if (length(z) > 4.0) {
                        escaped = true;
                        number_iterations = i;
                        break;
                    }
                }
                float v = float(number_iterations >= 16 ? number_iterations : 0) / 255.0;
                gl_FragColor = escaped ? vec4(vec3(v), 1.0) : vec4(0, 0, 0, 1);
            }
        `;
        return this.compile(vs_code, fs_code);
    }

    buildBuddhabrot() {
        let vs_code = `#version 300 es
            precision highp float;
            in vec3 a_position;
            in vec2 i_position;
            out vec2 o_position;
            out float a_multiplier;

            // uniform int determine_escape;

            ${this.fractal.getShaderFunction("f")}

            void main () {
                // if(determine_escape == 1) {
                //     vec2 z = vec2(0);
                //     o_position = vec2(100.0);
                //     for(int i = 0; i < 20000; i++) {
                //         z = f(z, a_position.xy);
                //         if(z.x * z.x + z.y * z.y > 16.0) {
                //             o_position = vec2(0);
                //             break;
                //         }
                //     }
                //     return;
                // }
                o_position = f(i_position, a_position.xy);
                gl_Position = vec4(f_projection(o_position, a_position.xy) / 2.0, 0, 1);
                a_multiplier = a_position.z;
            }
        `;
        let fs_code = `#version 300 es
            precision highp float;
            in float a_multiplier;
            out vec4 v_color;
            void main() {
                v_color = vec4(vec3(a_multiplier), 1);
            }
        `;
        return this.compile(vs_code, fs_code, (p) => {
            this.gl.transformFeedbackVaryings(p, ["o_position"], this.gl.SEPARATE_ATTRIBS);
        });
    }

    buildQuad() {
        let vs_code = `
            precision highp float;
            attribute vec2 a_position;
            varying vec2 vo_position;
            void main () {
                vo_position = (vec2(-a_position.y, a_position.x) + 1.0) / 2.0;
                gl_Position = vec4(a_position, 0, 1);
            }
        `;
        let fs_code = `
            precision highp float;
            uniform sampler2D texture;
            uniform sampler2D textureColor;
            uniform float colormapSize;
            uniform float colormapScaler;
            varying vec2 vo_position;
            void main() {
                float scale = colormapScaler * 4.0;
                vec4 color = texture2D(texture, vo_position);
                float v = min(1.0, sqrt(color.r / scale));
                gl_FragColor = texture2D(textureColor, vec2((v * (colormapSize - 0.5) + 0.5) / colormapSize, 0.5));
            }
        `;
        return this.compile(vs_code, fs_code);
    }
}

function randn_bm() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export class MandelbrotSampler {
    private gl: WebGL2RenderingContext;
    private fractal: Fractal;
    private options: BuddhabrotRendererOptions;
    private size: number;
    private mipmapSize: number;
    private mipmapLevel: number;

    private program: WebGLProgram;
    private framebufferTexture: WebGLTexture;
    private framebuffer: WebGLFramebuffer;

    private quadVertices: WebGLBuffer;
    private sampledBuffer: WebGLBuffer;

    private sampler: Sampler;

    constructor(gl: WebGL2RenderingContext, fractal: Fractal, options: BuddhabrotRendererOptions) {
        this.gl = gl;
        this.sampler = new Sampler();
        this.fractal = fractal;
        this.options = options;

        // Compute size and mipmap size
        this.size = options.samplerSize;
        this.mipmapLevel = options.samplerMipmapLevel;
        this.mipmapSize = this.size >> this.mipmapLevel;

        this.sampler.setSize(this.mipmapSize, this.mipmapSize);
        this.sampler.setMultiplier(this.options.samplerMultiplier);

        // Create framebuffer texture (texture is used for its mipmap)
        this.framebufferTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.framebufferTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this.size, this.size, 0, gl.RED, gl.UNSIGNED_BYTE, null);
        gl.bindTexture(gl.TEXTURE_2D, null);

        // Create framebuffer and assign the texture
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.framebufferTexture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Builder the mandelbrot program
        let builder = new ShaderBuilder(gl, fractal);
        this.program = builder.buildMandelbrot();

        // Build full screen quad vertices
        this.quadVertices = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

        // Initial uniforms
        gl.useProgram(this.program);
        gl.uniform2f(gl.getUniformLocation(this.program, "u_resolution"), this.size, this.size);
        gl.uniform1i(gl.getUniformLocation(this.program, "u_maxIterations"), options.samplerMaxIterations);
        gl.useProgram(null);

        // Create buffer and data
        this.sampledBuffer = gl.createBuffer();
    }

    getScaler() {
        return 256 * 256 / (this.mipmapSize * this.mipmapSize);
    }

    sample() {
        let gl = this.gl;

        // Bind framebuffer with level 0 texture
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.size, this.size);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.framebufferTexture, 0);

        // Render mandelbrot
        gl.useProgram(this.program);
        this.fractal.setShaderUniforms(gl, this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVertices);
        gl.enableVertexAttribArray(gl.getAttribLocation(this.program, "a_position"));
        gl.vertexAttribPointer(gl.getAttribLocation(this.program, "a_position"), 2, gl.FLOAT, false, 8, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Generate mipmap and read pixels at desired level
        gl.bindTexture(gl.TEXTURE_2D, this.framebufferTexture);
        if (this.mipmapLevel != 0) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.framebufferTexture, this.mipmapLevel);
        gl.readPixels(0, 0, this.mipmapSize, this.mipmapSize, gl.RED, gl.UNSIGNED_BYTE, this.sampler.getBuffer());

        // Reset the framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Sample points
        let t0 = new Date().getTime();
        this.sampler.sample();
        // this.sample_points(this.textureData);
        let t1 = new Date().getTime();
        // console.log("sample", t1 - t0);

        let N_samples = this.sampler.getSamplesCount();
        // Upload the samples to the buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sampledBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.sampler.getSamples(), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return { buffer: this.sampledBuffer, count: N_samples };
    }

    destroy() {
        let gl = this.gl;
        this.sampler.destroy();
        gl.deleteProgram(this.program);
        gl.deleteTexture(this.framebufferTexture);
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteBuffer(this.quadVertices)
        gl.deleteBuffer(this.sampledBuffer);
    }
}

export class BuddhabrotRenderer {
    private canvas: HTMLCanvasElement;
    private fractal: Fractal;
    private options: BuddhabrotRendererOptions;
    private gl: WebGL2RenderingContext;
    private sampler: MandelbrotSampler;
    private programRender: WebGLProgram;
    private programColor: WebGLProgram;

    private feedbackBuffer1: WebGLBuffer;
    private feedbackBuffer2: WebGLBuffer;
    private transformFeedback: WebGLTransformFeedback;
    private framebuffer: WebGLFramebuffer;
    private framebufferTexture: WebGLTexture;

    private textureColor: WebGLTexture;
    private colormapSize: number;

    private renderSize: number;
    private renderIterations: number;
    private vbo: WebGLBuffer;

    public scaler = 1;
    public static GetProfileOptions(name: string): BuddhabrotRendererOptions {
        for (let p of profiles) {
            if (p.name == name) return p.options;
        }
        return BuddhabrotRendererOptions_Default;
    }
    public static GetProfiles(): BuddhabrotRendererProfile[] {
        return profiles;
    }

    constructor(canvas: HTMLCanvasElement, fractal: Fractal, options: BuddhabrotRendererOptions) {
        // Fill in default options
        for (let key in BuddhabrotRendererOptions_Default) {
            if (BuddhabrotRendererOptions_Default.hasOwnProperty(key)) {
                if (options[key] === undefined) options[key] = BuddhabrotRendererOptions_Default[key];
            }
        }

        this.canvas = canvas;
        this.fractal = fractal;
        this.options = options;
        this.renderSize = options.renderSize;
        this.renderIterations = options.renderIterations;

        // Load GL extensions
        this.gl = this.canvas.getContext("webgl2") as WebGL2RenderingContext;
        if (this.gl == null) throw new Error("WebGL 2 is not supported");
        this.gl.getExtension('OES_texture_float');
        let ext_texture_float_linear = this.gl.getExtension('OES_texture_float_linear');
        let ext_color_buffer_float = this.gl.getExtension('EXT_color_buffer_float');
        if (ext_texture_float_linear == null) throw new Error("WebGL extension 'OES_texture_float_linear' is not supported");
        if (ext_color_buffer_float == null) throw new Error("WebGL extension 'EXT_color_buffer_float' is not supported");

        this.sampler = new MandelbrotSampler(this.gl, fractal, options);

        let gl = this.gl;

        let p = new ShaderBuilder(gl, this.fractal);

        this.feedbackBuffer1 = gl.createBuffer();
        this.feedbackBuffer2 = gl.createBuffer();
        this.programRender = p.buildBuddhabrot();
        this.programColor = p.buildQuad();

        this.transformFeedback = gl.createTransformFeedback();

        this.framebufferTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.framebufferTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.renderSize, this.renderSize, 0, gl.RED, gl.FLOAT, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.framebufferTexture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        this.textureColor = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.textureColor);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        this.setColormap([[0, 0, 0, 1], [255, 255, 255, 1]]);
    }

    public setColormap(colormap: number[][]) {
        let gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.textureColor);
        let textureData = new Uint8Array(colormap.length * 4);
        let p = 0;
        for (let i = 0; i < colormap.length; i++) {
            textureData[p++] = colormap[i][0];
            textureData[p++] = colormap[i][1];
            textureData[p++] = colormap[i][2];
            textureData[p++] = colormap[i][3] * 255;
        }
        this.colormapSize = colormap.length;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, colormap.length, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, textureData);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    public render(accumulate: boolean = false, accumulateScaler: number = 1) {
        let gl = this.gl;
        gl.disable(gl.DEPTH_TEST);

        // Sample the mandelbrot to get a set of "c" points for buddhabrot.
        let { buffer: cBuffer, count: samplesCount } = this.sampler.sample();

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.renderSize, this.renderSize);
        gl.clearColor(0, 0, 0, 1);
        if (!accumulate) {
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);

        // Initialize the feedback buffer to zero
        gl.bindBuffer(gl.ARRAY_BUFFER, this.feedbackBuffer1);
        gl.bufferData(gl.ARRAY_BUFFER, 8 * samplesCount, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.feedbackBuffer2);
        gl.bufferData(gl.ARRAY_BUFFER, 8 * samplesCount, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Iteratively render using transform feedback
        gl.useProgram(this.programRender);
        this.fractal.setShaderUniforms(gl, this.programRender);

        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
        gl.enableVertexAttribArray(gl.getAttribLocation(this.programRender, "a_position"));
        gl.vertexAttribPointer(gl.getAttribLocation(this.programRender, "a_position"), 3, gl.FLOAT, false, 12, 0);

        // gl.bindBuffer(gl.ARRAY_BUFFER, this.feedbackBuffer1);
        // gl.enableVertexAttribArray(gl.getAttribLocation(this.programRender, "i_position"));
        // gl.vertexAttribPointer(gl.getAttribLocation(this.programRender, "i_position"), 2, gl.FLOAT, false, 8, 0);

        // gl.uniform1i(gl.getUniformLocation(this.programRender, "determine_escape"), 1);
        // gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedback);
        // gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.feedbackBuffer1);
        // gl.bindBuffer(gl.ARRAY_BUFFER, this.feedbackBuffer2);
        // gl.enableVertexAttribArray(gl.getAttribLocation(this.programRender, "i_position"));
        // gl.vertexAttribPointer(gl.getAttribLocation(this.programRender, "i_position"), 2, gl.FLOAT, false, 8, 0);
        // gl.beginTransformFeedback(gl.POINTS);
        // gl.enable(gl.RASTERIZER_DISCARD);
        // gl.drawArrays(gl.POINTS, 0, samplesCount);
        // gl.disable(gl.RASTERIZER_DISCARD);
        // gl.endTransformFeedback();
        // gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        // gl.uniform1i(gl.getUniformLocation(this.programRender, "determine_escape"), 0);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedback);
        for (let i = 0; i < this.renderIterations; i++) {
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.feedbackBuffer2);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.feedbackBuffer1);
            gl.enableVertexAttribArray(gl.getAttribLocation(this.programRender, "i_position"));
            gl.vertexAttribPointer(gl.getAttribLocation(this.programRender, "i_position"), 2, gl.FLOAT, false, 8, 0);

            gl.beginTransformFeedback(gl.POINTS);
            if (i < 4) {
                gl.enable(gl.RASTERIZER_DISCARD);
            }
            gl.drawArrays(gl.POINTS, 0, samplesCount);
            gl.disable(gl.RASTERIZER_DISCARD);
            gl.endTransformFeedback();

            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

            let t = this.feedbackBuffer1;
            this.feedbackBuffer1 = this.feedbackBuffer2;
            this.feedbackBuffer2 = t;
        }

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Generate the colored fractal
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.BLEND);

        this.vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

        gl.useProgram(this.programColor);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.enableVertexAttribArray(gl.getAttribLocation(this.programColor, "a_position"));
        gl.vertexAttribPointer(gl.getAttribLocation(this.programColor, "a_position"), 2, gl.FLOAT, false, 8, 0);
        gl.uniform1i(gl.getUniformLocation(this.programColor, "texture"), 0);
        gl.uniform1i(gl.getUniformLocation(this.programColor, "textureColor"), 1);
        gl.uniform1f(gl.getUniformLocation(this.programColor, "colormapSize"), this.colormapSize);
        gl.uniform1f(gl.getUniformLocation(this.programColor, "colormapScaler"), this.scaler * (this.options.renderIterations - 4) / 800 * accumulateScaler / this.sampler.getScaler());

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.textureColor);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.framebufferTexture);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    public getWebGLInfo() {
        let gl = this.gl;
        var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            var vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            var renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            return vendor + " " + renderer;
        } else {
            return "unknown";
        }

    }

    public readPixels(buffer: Uint8Array) {
        let gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
    }

    public destroy() {
        let gl = this.gl;
        this.sampler.destroy();
        gl.deleteBuffer(this.feedbackBuffer1);
        gl.deleteBuffer(this.feedbackBuffer2);
        gl.deleteTransformFeedback(this.transformFeedback);
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.framebufferTexture);
        gl.deleteTexture(this.textureColor);
    }
}
