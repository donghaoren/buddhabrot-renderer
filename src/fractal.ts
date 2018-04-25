export interface FractalParameter {
    name: string;
    type: "number" | "integer";
    range: number[];
    step?: number;
    disabled?: boolean;
}

export interface FractalParameterPreset {
    name: string;
    parameters: { [name: string]: number };
}

export interface ParameterMap {
    [name: string]: number;
}

function rotation4d(angle: number, i1: number, i2: number, input: number[]) {
    let theta = angle / 180 * Math.PI;
    return input.map((v, i) => {
        if (i == i1) return Math.cos(theta) * input[i1] + Math.sin(theta) * input[i2];
        if (i == i2) return -Math.sin(theta) * input[i1] + Math.cos(theta) * input[i2];
        return v;
    });
}

let default_rotations = {
    rotation_zxcx: 0,
    rotation_zxcy: 0,
    rotation_zycx: 0,
    rotation_zycy: 0,
    translate_x: 0,
    translate_y: 0,
    scale: 0
};

export class Fractal {
    constructor() {
        this.parameters = {
            z3_scaler: 0, z3_angle: 0, z3_yscale: 1,
            z2_scaler: 1, z2_angle: 0, z2_yscale: 1,
            z1_scaler: 0, z1_angle: 0, z1_yscale: 1,
            ...default_rotations
        };
    }

    public parameters: ParameterMap;

    getPresets(): FractalParameterPreset[] {
        return [
            {
                name: "Buddhabrot: z^2 + c", parameters: {
                    z3_scaler: 0, z3_angle: 0, z3_yscale: 1,
                    z2_scaler: 1, z2_angle: 0, z2_yscale: 1,
                    z1_scaler: 0, z1_angle: 0, z1_yscale: 1,
                    ...default_rotations
                }
            },
            {
                name: "Tricorn: conj(z)^2 + c", parameters: {
                    z3_scaler: 0, z3_angle: 0, z3_yscale: 1,
                    z2_scaler: 1, z2_angle: 0, z2_yscale: -1,
                    z1_scaler: 0, z1_angle: 0, z1_yscale: 1,
                    ...default_rotations
                }
            },
            {
                name: "z^3 Buddhabrot: z^3 + c", parameters: {
                    z3_scaler: 1, z3_angle: 0, z3_yscale: 1,
                    z2_scaler: 0, z2_angle: 0, z2_yscale: 1,
                    z1_scaler: 0, z1_angle: 0, z1_yscale: 1,
                    ...default_rotations
                }
            },
            {
                name: "Quadcorn: conj(z)^3 + c", parameters: {
                    z3_scaler: 1, z3_angle: 0, z3_yscale: -1,
                    z2_scaler: 0, z2_angle: 0, z2_yscale: 1,
                    z1_scaler: 0, z1_angle: 0, z1_yscale: 1,
                    ...default_rotations
                }
            },
            {
                name: "Quad-spiral: conj(z)^3 + r * z + c", parameters: {
                    z3_scaler: 1, z3_angle: 0, z3_yscale: -1,
                    z2_scaler: 0, z2_angle: 0, z2_yscale: 1,
                    z1_scaler: 0.95, z1_angle: 170, z1_yscale: 1,
                    ...default_rotations
                }
            },
            {
                name: "Double Buddha: r * z^3 + 0.5z + c", parameters: {
                    z3_scaler: 1, z3_angle: 180, z3_yscale: 1,
                    z2_scaler: 0, z2_angle: 0, z2_yscale: 1,
                    z1_scaler: 0.5, z1_angle: 0, z1_yscale: 1,
                    ...default_rotations
                }
            },
            {
                name: "Chain: r * z^3 + r * 0.97z + c", parameters: {
                    z3_scaler: 0.58, z3_angle: 180, z3_yscale: 1,
                    z2_scaler: 0, z2_angle: 0, z2_yscale: 1,
                    z1_scaler: 1.68, z1_angle: 180, z1_yscale: 1,
                    ...default_rotations
                }
            },
            {
                name: "Pyramid: r * z^2 + 2 * r * z + c", parameters: {
                    z3_scaler: 0, z3_angle: 0, z3_yscale: 1,
                    z2_scaler: 1, z2_angle: -180, z2_yscale: 1,
                    z1_scaler: 1.7, z1_angle: 180, z1_yscale: 0,
                    ...default_rotations
                }
            }
        ];
    }

    loadPreset(preset: FractalParameterPreset) {
        for (let key in preset.parameters) {
            this.parameters[key] = preset.parameters[key];
        }
    }

    saveParameters(): ParameterMap {
        return JSON.parse(JSON.stringify(this.parameters));
    }

    loadParameters(params: ParameterMap) {
        for (let key in params) {
            this.parameters[key] = params[key];
        }
    }

    interpolateParameters(param1: ParameterMap, param2: ParameterMap, t: number): ParameterMap {
        let r: ParameterMap = {};
        for (let key in param1) {
            r[key] = param1[key] * (1 - t) + param2[key] * t;
        }
        return r;
    }

    getParameters(): FractalParameter[] {
        return [
            { name: "z3_scaler", type: "number", range: [0, 2] },
            { name: "z3_angle", type: "number", range: [-180, 180], step: 1, disabled: this.parameters.z3_scaler == 0 },
            { name: "z3_yscale", type: "number", range: [-1, 1], disabled: this.parameters.z3_scaler == 0 },
            { name: "z2_scaler", type: "number", range: [0, 2] },
            { name: "z2_angle", type: "number", range: [-180, 180], step: 1, disabled: this.parameters.z2_scaler == 0 },
            { name: "z2_yscale", type: "number", range: [-1, 1], disabled: this.parameters.z2_scaler == 0 },
            { name: "z1_scaler", type: "number", range: [0, 2] },
            { name: "z1_angle", type: "number", range: [-180, 180], step: 1, disabled: this.parameters.z1_scaler == 0 },
            { name: "z1_yscale", type: "number", range: [-1, 1], disabled: this.parameters.z1_scaler == 0 },
            { name: "rotation_zxcx", type: "number", range: [-180, 180], step: 1 },
            { name: "rotation_zxcy", type: "number", range: [-180, 180], step: 1 },
            { name: "rotation_zycx", type: "number", range: [-180, 180], step: 1 },
            { name: "rotation_zycy", type: "number", range: [-180, 180], step: 1 },
            { name: "translate_x", type: "number", range: [-3, 3] },
            { name: "translate_y", type: "number", range: [-3, 3] },
            { name: "scale", type: "number", range: [-8, 8] }
        ];
    }

    getShaderFunction(name: string) {
        return `
            uniform mat2 fractal_z3_scaler;
            uniform mat2 fractal_z2_scaler;
            uniform mat2 fractal_z1_scaler;
            uniform vec3 fractal_translate_scale;
            uniform vec4 fractal_rotation_e1;
            uniform vec4 fractal_rotation_e2;

            vec2 ${name}(vec2 z, vec2 c) {
                float xx = z.x * z.x;
                float yy = z.y * z.y;
                vec2 z2 = vec2(xx - yy, z.x * z.y * 2.0);
                vec2 z3 = vec2(xx * z.x - 3.0 * z.x * yy, 3.0 * xx * z.y - yy * z.y);
                return fractal_z3_scaler * z3 + fractal_z2_scaler * z2 + fractal_z1_scaler * z + c;
            }

            vec2 ${name}_projection(vec2 z, vec2 c) {
                vec4 w = vec4(z, c);
                vec2 m = vec2(dot(fractal_rotation_e1, w), dot(fractal_rotation_e2, w));
                return (m + fractal_translate_scale.yx) * fractal_translate_scale.z;
            }
        `
    }

    buildMatrix(theta: number, scaler: number, yscale: number): number[] {
        return [
            Math.cos(theta / 180 * Math.PI) * scaler, Math.sin(theta / 180 * Math.PI) * scaler * yscale,
            -Math.sin(theta / 180 * Math.PI) * scaler, Math.cos(theta / 180 * Math.PI) * scaler * yscale
        ];
    }

    setShaderUniforms(gl: WebGL2RenderingContext, shader: WebGLProgram) {
        gl.uniformMatrix2fv(gl.getUniformLocation(shader, "fractal_z1_scaler"), false,
            this.buildMatrix(this.parameters.z1_angle, this.parameters.z1_scaler, this.parameters.z1_yscale)
        );
        gl.uniformMatrix2fv(gl.getUniformLocation(shader, "fractal_z2_scaler"), false,
            this.buildMatrix(this.parameters.z2_angle, this.parameters.z2_scaler, this.parameters.z2_yscale)
        );
        gl.uniformMatrix2fv(gl.getUniformLocation(shader, "fractal_z3_scaler"), false,
            this.buildMatrix(this.parameters.z3_angle, this.parameters.z3_scaler, this.parameters.z3_yscale)
        );
        let e1 = [1, 0, 0, 0];
        let e2 = [0, 1, 0, 0];
        e1 = rotation4d(this.parameters.rotation_zxcx, 0, 2, e1); e2 = rotation4d(this.parameters.rotation_zxcx, 0, 2, e2);
        e1 = rotation4d(this.parameters.rotation_zxcy, 0, 3, e1); e2 = rotation4d(this.parameters.rotation_zxcy, 0, 3, e2);
        e1 = rotation4d(this.parameters.rotation_zycx, 1, 2, e1); e2 = rotation4d(this.parameters.rotation_zycx, 1, 2, e2);
        e1 = rotation4d(this.parameters.rotation_zycy, 1, 3, e1); e2 = rotation4d(this.parameters.rotation_zycy, 1, 3, e2);

        gl.uniform4fv(gl.getUniformLocation(shader, "fractal_rotation_e1"), e1);
        gl.uniform4fv(gl.getUniformLocation(shader, "fractal_rotation_e2"), e2);
        gl.uniform3f(gl.getUniformLocation(shader, "fractal_translate_scale"), this.parameters.translate_x, this.parameters.translate_y, Math.pow(2, this.parameters.scale));
    }

    setParameter(name: string, value: number) {
        this.parameters[name] = value;
    }
}