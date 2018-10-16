import { Fractal } from "./fractal";
import { Sampler } from "../native/sample_points";

export interface BuddhabrotRendererOptions {
    samplerSize?: number;
    samplerMipmapLevel?: number;
    samplerMaxIterations?: number;
    samplerLowerBound?: number;
    renderSize?: number;
    renderIterations?: number;
}

export interface BuddhabrotRendererProfile {
    name: string;
    options: BuddhabrotRendererOptions;
}

function makeProfile(name: string, lowerBound: number, size: number) {
    return {
        name: name, options: {
            samplerSize: size,
            samplerMipmapLevel: 1,
            samplerMaxIterations: 512,
            samplerLowerBound: lowerBound,
            renderSize: 2048,
            renderIterations: 256
        }
    };
}
const profiles: BuddhabrotRendererProfile[] = [
    makeProfile("512/10k", 10000, 512),
    makeProfile("512/20k", 20000, 512),
    makeProfile("512/50k", 50000, 512),
    makeProfile("512/100k", 100000, 512),
    makeProfile("512/200k", 200000, 512),
    makeProfile("1024/10k", 10000, 1024),
    makeProfile("1024/20k", 20000, 1024),
    makeProfile("1024/50k", 50000, 1024),
    makeProfile("1024/100k", 100000, 1024),
    makeProfile("1024/200k", 200000, 1024),
    makeProfile("2048/10k", 10000, 2048),
    makeProfile("2048/20k", 20000, 2048),
    makeProfile("2048/50k", 50000, 2048),
    makeProfile("2048/100k", 100000, 2048),
    makeProfile("2048/200k", 200000, 2048),
];

const default_profile = "512/50k";

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
                vec2 pw;
                vec2 z1;
                bool escaped = false;
                int number_iterations = 0;
                int num_contain = 0;
                for (int i = 0; i < 256; i++) {
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
                    pw = f_projection(z, c);
                    if(pw.x >= -2.0 && pw.x <= 2.0 && pw.y >= -2.0 && pw.y <= 2.0) {
                        num_contain++;
                    }
                    if (length(z) > 4.0) {
                        escaped = true;
                        number_iterations = i;
                        break;
                    }
                }
                float v = float(number_iterations >= 16 ? num_contain : 0) / 255.0;
                gl_FragColor = escaped && num_contain > 0 ? vec4(vec3(v), 1.0) : vec4(0, 0, 0, 1);
            }
        `;
        return this.compile(vs_code, fs_code);
    }

    buildBuddhabrotEscape() {
        let vs_code = `#version 300 es
            precision highp float;
            in vec3 a_position;
            out vec3 o_position;
            out vec3 vo_accum;

            uniform float u_spectrum_scaler;

            ${this.fractal.getShaderFunction("f")}

            void main () {
                vec2 z = vec2(0);
                o_position = vec3(100.0, 100.0, 100.0);
                for(int i = 0; i < 256; i++) {
                    z = f(z, a_position.xy);
                    if(z.x * z.x + z.y * z.y > 16.0) {
                        o_position = vec3(0, 0, float(i) / 160.0 * u_spectrum_scaler);
                        break;
                    }
                }
            }
        `;
        let fs_code = `#version 300 es
            precision highp float;
            in vec3 vo_accum;
            out vec4 v_color;
            void main() {
                v_color = vec4(vec3(vo_accum), 1);
            }
        `;
        return this.compile(vs_code, fs_code, (p) => {
            this.gl.transformFeedbackVaryings(p, ["o_position"], this.gl.SEPARATE_ATTRIBS);
        });
    }
    buildBuddhabrot() {
        let vs_code = `#version 300 es
            precision highp float;
            in vec3 a_position;
            in vec3 i_position;
            out vec3 o_position;
            out vec3 vo_accum;

            ${this.fractal.getShaderFunction("f")}

            void main () {
                o_position = vec3(f(i_position.xy, a_position.xy), i_position.z);
                gl_Position = vec4(f_projection(o_position.xy, a_position.xy) / 2.0, 0, 1);
                if(i_position.z < 0.3333) {
                    vo_accum = vec3(a_position.z) * vec3(1, 0, 0);
                } else if(i_position.z < 0.6666) {
                    vo_accum = vec3(a_position.z) * vec3(0, 1, 0);
                } else {
                    vo_accum = vec3(a_position.z) * vec3(0, 0, 1);
                }
            }
        `;
        let fs_code = `#version 300 es
            precision highp float;
            in vec3 vo_accum;
            out vec4 v_color;
            void main() {
                v_color = vec4(vec3(vo_accum), 1);
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

            float xyz_rgb_curve(float r) {
                if(r <= 0.00304) {
                    return 12.92 * r;
                } else {
                    return 1.055 * pow(r, 1.0 / 2.4) - 0.055;
                }
            }

            vec3 xyz2rgb(vec3 xyz) {
                return vec3(
                    xyz_rgb_curve(3.2404542 * xyz.x - 1.5371385 * xyz.y - 0.4985314 * xyz.z),
                    xyz_rgb_curve(-0.9692660 * xyz.x + 1.8760108 * xyz.y + 0.0415560 * xyz.z),
                    xyz_rgb_curve(0.0556434 * xyz.x - 0.2040259 * xyz.y + 1.0572252 * xyz.z)
                );
            }

            void main() {
                float scale = colormapScaler * 4.0;
                vec4 color = texture2D(texture, vo_position);
                vec3 v = min(vec3(1.0), (color.rgb / scale));
                vec3 cx = texture2D(textureColor, vec2((v.x * (colormapSize - 0.5) + 0.5) / colormapSize, 1.0 / 6.0)).xyz;
                vec3 cy = texture2D(textureColor, vec2((v.y * (colormapSize - 0.5) + 0.5) / colormapSize, 0.5)).xyz;
                vec3 cz = texture2D(textureColor, vec2((v.z * (colormapSize - 0.5) + 0.5) / colormapSize, 5.0 / 6.0)).xyz;
                vec3 xyz = cx + cy + cz;
                gl_FragColor = vec4(xyz2rgb(xyz), 1.0);
            }
        `;
        return this.compile(vs_code, fs_code);
    }
    buildCompose() {
        let vs_code = `
            precision highp float;
            attribute vec2 a_position;
            varying vec2 vo_position;
            void main () {
                vo_position = (a_position + 1.0) / 2.0;
                gl_Position = vec4(a_position, 0, 1);
            }
        `;
        let fs_code = `
            precision highp float;
            uniform sampler2D texture;
            uniform float scaler;
            varying vec2 vo_position;

            void main() {
                vec4 color = texture2D(texture, vo_position);
                gl_FragColor = vec4(color.xyz * scaler, 1.0);
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
        this.sampler.setLowerBound(options.samplerLowerBound);

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
    private programRenderEscape: WebGLProgram;
    private programRender: WebGLProgram;
    private programColor: WebGLProgram;
    private programCompose: WebGLProgram;

    private feedbackBuffer1: WebGLBuffer;
    private feedbackBuffer2: WebGLBuffer;
    private transformFeedback: WebGLTransformFeedback;
    private framebuffer: WebGLFramebuffer;
    private framebufferTexture: WebGLTexture;
    private framebufferTextureBack: WebGLTexture;

    private textureColor: WebGLTexture;
    private colormapSize: number;

    private renderSize: number;
    private renderIterations: number;
    private vbo: WebGLBuffer;

    public exposure = 1;
    public spectrumScaler = 1;

    public static GetProfileOptions(name: string): BuddhabrotRendererOptions {
        for (let p of profiles) {
            if (p.name == name) return p.options;
        }
        return profiles[0].options;
    }
    public static GetProfiles(): BuddhabrotRendererProfile[] {
        return profiles;
    }
    public static GetDefaultProfile(): string {
        return default_profile;
    }

    constructor(canvas: HTMLCanvasElement, fractal: Fractal, options: BuddhabrotRendererOptions) {
        // Fill in default options
        let default_options = BuddhabrotRenderer.GetProfileOptions(BuddhabrotRenderer.GetDefaultProfile());
        for (let key in default_options) {
            if (default_options.hasOwnProperty(key)) {
                if (options[key] === undefined) options[key] = default_options[key];
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
        this.programRenderEscape = p.buildBuddhabrotEscape();
        this.programRender = p.buildBuddhabrot();
        this.programColor = p.buildQuad();
        this.programCompose = p.buildCompose();

        this.transformFeedback = gl.createTransformFeedback();

        this.framebufferTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.framebufferTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.renderSize, this.renderSize, 0, gl.RGBA, gl.FLOAT, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.framebufferTextureBack = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.framebufferTextureBack);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.renderSize, this.renderSize, 0, gl.RGBA, gl.FLOAT, null);
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

        this.vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.setColormap([
            [[0, 0, 0, 1], [0, 0, 255, 1]],
            [[0, 0, 0, 1], [0, 255, 0, 1]],
            [[0, 0, 0, 1], [255, 0, 0, 1]]
        ]);
    }

    public setColormap(colormap: number[][][]) {
        let gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.textureColor);
        let textureData = new Float32Array(colormap[0].length * 4 * 6);
        let p = 0;
        for (let k = 0; k < 3; k++) {
            for (let m = 0; m < 2; m++) {
                for (let i = 0; i < colormap[0].length; i++) {
                    textureData[p++] = colormap[k][i][0];
                    textureData[p++] = colormap[k][i][1];
                    textureData[p++] = colormap[k][i][2];
                    textureData[p++] = colormap[k][i][3];
                }
            }
        }
        this.colormapSize = colormap[0].length;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, colormap[0].length, 6, 0, gl.RGBA, gl.FLOAT, textureData);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    public render(accumulateScaler: number = 1, decayFactor: number = 1) {
        let gl = this.gl;
        gl.disable(gl.DEPTH_TEST);

        // Sample the mandelbrot to get a set of "c" points for buddhabrot.
        let { buffer: cBuffer, count: samplesCount } = this.sampler.sample();

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.renderSize, this.renderSize);
        gl.clearColor(0, 0, 0, 1);

        // Copy the texture to back texture
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.framebufferTextureBack, 0);
        gl.viewport(0, 0, this.renderSize, this.renderSize);
        gl.useProgram(this.programCompose);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.enableVertexAttribArray(gl.getAttribLocation(this.programCompose, "a_position"));
        gl.vertexAttribPointer(gl.getAttribLocation(this.programCompose, "a_position"), 2, gl.FLOAT, false, 8, 0);
        gl.uniform1i(gl.getUniformLocation(this.programCompose, "texture"), 0);
        gl.uniform1f(gl.getUniformLocation(this.programCompose, "scaler"), decayFactor);
        gl.bindTexture(gl.TEXTURE_2D, this.framebufferTexture);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindTexture(gl.TEXTURE_2D, null);

        // Swap textures
        let tmp = this.framebufferTexture;
        this.framebufferTexture = this.framebufferTextureBack;
        this.framebufferTextureBack = tmp;


        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.framebufferTexture, 0);
        gl.viewport(0, 0, this.renderSize, this.renderSize);
        gl.clearColor(0, 0, 0, 1);
        // if (!accumulate) {
        //     gl.clear(gl.COLOR_BUFFER_BIT);
        // }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);

        // Initialize the feedback buffer to zero
        gl.bindBuffer(gl.ARRAY_BUFFER, this.feedbackBuffer1);
        gl.bufferData(gl.ARRAY_BUFFER, 12 * samplesCount, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.feedbackBuffer2);
        gl.bufferData(gl.ARRAY_BUFFER, 12 * samplesCount, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Determine the number of iterations and coloring of the samples
        gl.useProgram(this.programRenderEscape);
        this.fractal.setShaderUniforms(gl, this.programRenderEscape);

        gl.uniform1f(gl.getUniformLocation(this.programRenderEscape, "u_spectrum_scaler"), this.spectrumScaler);

        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
        gl.enableVertexAttribArray(gl.getAttribLocation(this.programRenderEscape, "a_position"));
        gl.vertexAttribPointer(gl.getAttribLocation(this.programRenderEscape, "a_position"), 3, gl.FLOAT, false, 12, 0);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedback);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.feedbackBuffer1);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.feedbackBuffer2);
        gl.beginTransformFeedback(gl.POINTS);
        gl.enable(gl.RASTERIZER_DISCARD);
        gl.drawArrays(gl.POINTS, 0, samplesCount);
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.endTransformFeedback();
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        // Iteratively render using transform feedback
        gl.useProgram(this.programRender);
        this.fractal.setShaderUniforms(gl, this.programRender);

        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
        gl.enableVertexAttribArray(gl.getAttribLocation(this.programRender, "a_position"));
        gl.vertexAttribPointer(gl.getAttribLocation(this.programRender, "a_position"), 3, gl.FLOAT, false, 12, 0);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedback);
        for (let i = 0; i < this.renderIterations; i++) {
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.feedbackBuffer2);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.feedbackBuffer1);
            gl.enableVertexAttribArray(gl.getAttribLocation(this.programRender, "i_position"));
            gl.vertexAttribPointer(gl.getAttribLocation(this.programRender, "i_position"), 3, gl.FLOAT, false, 12, 0);

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


        gl.bindFramebuffer(gl.FRAMEBUFFER, null);


        // Generate the colored fractal
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.BLEND);

        gl.useProgram(this.programColor);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.enableVertexAttribArray(gl.getAttribLocation(this.programColor, "a_position"));
        gl.vertexAttribPointer(gl.getAttribLocation(this.programColor, "a_position"), 2, gl.FLOAT, false, 8, 0);
        gl.uniform1i(gl.getUniformLocation(this.programColor, "texture"), 0);
        gl.uniform1i(gl.getUniformLocation(this.programColor, "textureColor"), 1);
        gl.uniform1f(gl.getUniformLocation(this.programColor, "colormapSize"), this.colormapSize);
        gl.uniform1f(gl.getUniformLocation(this.programColor, "colormapScaler"), Math.pow(2, -this.exposure) * (this.options.renderIterations - 4) / 20000 * accumulateScaler / this.sampler.getScaler() / Math.pow(2, 2 * this.fractal.parameters.scale));

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.textureColor);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.framebufferTextureBack);
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
