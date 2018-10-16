import * as React from "react";
import * as ReactDOM from "react-dom";
import * as chroma from "chroma-js";
import * as FileSaver from "file-saver";
import { Slider, InputNumber, Select, Row, Col, Dropdown, Button, Icon, Menu } from "antd";

import { BuddhabrotRenderer, BuddhabrotRendererOptions } from "./renderer";
import { Fractal, ParameterMap } from "./fractal";
import { colormaps, Colormap } from "./colormaps";

import { VideoEncoder } from "./video_output";

import { initialize } from "../native/sample_points";

declare let BUDDHABROT_RENDERER_ENVIRONMENT: string;
let appEnvironment = (typeof (BUDDHABROT_RENDERER_ENVIRONMENT) != "undefined") ? BUDDHABROT_RENDERER_ENVIRONMENT : "browser";
let isElectron = appEnvironment == "electron";

function SliderRow(props: { label: string, value: number, min: number, max: number, step: number, disabled?: boolean, onChange: (v: number) => void }) {
    let onChange = (e) => {
        if (typeof (e) == "number") {
            props.onChange(e);
        }
    };
    return (
        <Row gutter={10} align="middle" type="flex">
            <Col span={6}>
                <div className="slider-row-label">{props.label}</div>
            </Col>
            <Col span={12}>
                <Slider
                    disabled={props.disabled}
                    min={props.min}
                    max={props.max}
                    step={props.step}
                    value={props.value}
                    onChange={onChange}
                />
            </Col>
            <Col span={6}>
                <InputNumber
                    disabled={props.disabled}
                    value={props.value}
                    step={props.step}
                    onChange={onChange}
                />
            </Col>
        </Row>
    );
}

function nextAnimationFrame(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        requestAnimationFrame(() => { resolve() });
    });
}

class ColorMapView extends React.PureComponent<{ colormap: number[][] }, {}> {
    refs: {
        canvas: HTMLCanvasElement
    };

    public componentDidMount() {
        this.renderCanvas();
    }

    public componentDidUpdate() {
        this.renderCanvas();
    }

    public renderCanvas() {
        let g = this.refs.canvas.getContext("2d");
        let gradient = g.createLinearGradient(0, 0, this.refs.canvas.width, 0);
        for (let i = 0; i < this.props.colormap.length; i++) {
            gradient.addColorStop(i / (this.props.colormap.length - 1), chroma(this.props.colormap[i]).hex());
        }
        g.fillStyle = gradient;
        g.fillRect(0, 0, this.refs.canvas.width, this.refs.canvas.height);
    }

    public render() {
        return (
            <canvas ref="canvas" width={50} height={12} />
        );
    }
}

class FractalRenderer extends React.Component<{ fractal: Fractal, options: BuddhabrotRendererOptions, exposure: number, spectrumScaler: number, colormap: number[][][] }, { error?: string }> {
    refs: {
        canvas: HTMLCanvasElement;
    };

    state = { error: null };

    public renderer: BuddhabrotRenderer;

    public componentDidMount() {
        this.refs.canvas.width = 2048;
        this.refs.canvas.height = 2048;
        try {
            this.renderer = new BuddhabrotRenderer(this.refs.canvas, this.props.fractal, this.props.options);
            this.renderer.setColormap(this.props.colormap);
            this.renderer.exposure = this.props.exposure;
            this.renderer.spectrumScaler = this.props.spectrumScaler;
        } catch (e) {
            this.setState({
                error: e.message
            });
        }
        this.refresh();
    }

    public componentWillUnmount() {
        if (this.currentTimeout) cancelAnimationFrame(this.currentTimeout);
        this.currentTimeout = null;
        if (this.renderer) {
            this.renderer.destroy();
        }
    }

    currentTimeout: any;
    public refresh() {
        if (this.currentTimeout) cancelAnimationFrame(this.currentTimeout);
        this.currentTimeout = null;
        if (!this.renderer) return;
        let N = 20000;
        let index = 1;
        this.renderer.render(index, 0);
        let renderNext = () => {
            index += 1;
            this.renderer.render(index, 1);
            if (index < N) {
                this.currentTimeout = requestAnimationFrame(renderNext);
            }
        }
        if (index < N) {
            this.currentTimeout = requestAnimationFrame(renderNext);
        }
    }

    public getFrameSize() {
        if (this.refs.canvas) {
            return [this.refs.canvas.width, this.refs.canvas.height];
        } else {
            return [100, 100];
        }
    }

    public saveImage(size: number) {
        let canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        let ctx = canvas.getContext("2d");
        if (this.renderer && this.refs.canvas) {
            this.renderer.render();
            ctx.drawImage(this.refs.canvas, 0, 0, this.refs.canvas.width, this.refs.canvas.height, 0, 0, size, size);
        }
        return canvas.toDataURL("image/jpeg");
    }

    public async highQualityFrame(N: number = 20, buffer: Uint8Array) {
        if (!this.renderer) return;
        if (this.currentTimeout) cancelAnimationFrame(this.currentTimeout);
        this.currentTimeout = null;
        for (let i = 0; i < N; i++) {
            await nextAnimationFrame();
            this.renderer.render(i + 1, i > 0 ? 1 : 0);
        }
        this.renderer.readPixels(buffer);
    }

    public setExposure(value: number) {
        if (!this.renderer) return;
        this.renderer.exposure = value;
    }

    public setSpectrumScaler(value: number) {
        if (!this.renderer) return;
        this.renderer.spectrumScaler = value;
    }

    public setColormap(colormap: number[][][]) {
        if (!this.renderer) return;
        this.renderer.setColormap(colormap);
    }

    public render() {
        if (this.state.error) {
            return (
                <div className="el-error">
                    Unable to initialize WebGL 2 for rendering.
                    <div className="el-reason">Reason: {this.state.error}</div>
                </div>
            );
        } else {
            return (
                <canvas ref="canvas" />
            );
        }
    }
}

interface AnimationKeyFrame {
    image: string;
    parameters: ParameterMap;
}

interface FractalApplicationState {
    fractal: Fractal;
    colormap1: string;
    colormap2: string;
    colormap3: string;
    backColor: string;
    rendererProfile: string;
    rendererExposure: number;
    rendererSpectrumScaler: number;

    animation: AnimationKeyFrame[];
    isPlaying: boolean;
}

class FractalApplication extends React.Component<{}, FractalApplicationState> {
    refs: {
        canvas: HTMLCanvasElement;
        renderer: FractalRenderer;
    };

    public state: FractalApplicationState = this.getDefaultState();

    public getDefaultState(): FractalApplicationState {
        let defaultProfile = BuddhabrotRenderer.GetDefaultProfile();
        return {
            fractal: new Fractal(),
            colormap1: colormaps[0].name,
            colormap2: colormaps[1].name,
            colormap3: colormaps[2].name,
            backColor: "#000000",
            rendererProfile: defaultProfile,
            rendererExposure: 0,
            rendererSpectrumScaler: 1,
            animation: require("../data/animations.json"),
            isPlaying: false
        };
    }

    playTimer: any;
    public togglePlay() {
        if (this.playTimer == null) {
            this.setState({
                isPlaying: true
            });
            let t0 = new Date().getTime();
            let animation = this.state.animation.slice();
            let f_render = () => {
                this.playTimer = null;
                let tNow = new Date().getTime();
                let speed = 3;
                let s = ((tNow - t0) / 1000 / speed) % (animation.length - 1);

                let i1 = Math.min(animation.length - 1, Math.floor(s));
                let i2 = Math.min(animation.length - 1, i1 + 1);
                let interp = s - i1;
                let parameters = this.state.fractal.interpolateParameters(animation[i1].parameters, animation[i2].parameters, interp);
                this.state.fractal.loadParameters(parameters);
                this.refs.renderer.refresh();
                this.forceUpdate();
                this.playTimer = requestAnimationFrame(f_render);
            };
            this.playTimer = requestAnimationFrame(f_render);
        } else {
            this.setState({
                isPlaying: false
            });
            cancelAnimationFrame(this.playTimer);
            this.playTimer = null;
        }
    }

    public async exportAnimation() {
        let animation = this.state.animation.slice();
        let fps = 60;
        let totalFrames = fps * 3 * (animation.length - 1);

        let [width, height] = this.refs.renderer.getFrameSize();

        let videoWriter = new VideoEncoder("video.mp4", width, height, fps, ["-vf", "vflip"]);

        for (let frame = 0; frame <= totalFrames; frame++) {
            await nextAnimationFrame();

            let s = frame / totalFrames * (animation.length - 1);
            let i1 = Math.min(animation.length - 1, Math.floor(s));
            let i2 = Math.min(animation.length - 1, i1 + 1);
            let interp = s - i1;
            let parameters = this.state.fractal.interpolateParameters(animation[i1].parameters, animation[i2].parameters, interp);
            this.state.fractal.loadParameters(parameters);

            let pixels = new Uint8Array(4 * width * height);

            await this.refs.renderer.highQualityFrame(10, pixels);

            let buffer: Buffer = new (window as any).Buffer(pixels);

            await videoWriter.addFrame(buffer);

            await new Promise<void>((resolve, reject) => this.forceUpdate(() => { resolve() }));
        }
        await videoWriter.complete();
    }

    public getColormapByName(name: string) {
        for (let cm of colormaps) {
            if (cm.name == name) {
                return cm;
            }
        }
        return colormaps[0];
    }

    public getCurrentColormap(): number[][][] {
        return [
            this.getColormapByName(this.state.colormap1).colormap_xyz,
            this.getColormapByName(this.state.colormap2).colormap_xyz,
            this.getColormapByName(this.state.colormap3).colormap_xyz
        ];
    }

    public render() {
        return (
            <div className="fractal-application">
                <div className="el-canvas" style={{ background: this.state.backColor }}>
                    <FractalRenderer
                        ref="renderer"
                        key={this.state.rendererProfile}
                        fractal={this.state.fractal}
                        options={BuddhabrotRenderer.GetProfileOptions(this.state.rendererProfile)}
                        exposure={this.state.rendererExposure}
                        spectrumScaler={this.state.rendererSpectrumScaler}
                        colormap={this.getCurrentColormap()}
                    />
                </div>
                <div className="el-controls">
                    <h3>Renderer Parameters</h3>
                    <div className="el-widget">
                        <Row gutter={10} align="middle" type="flex">
                            <Col span={6}>
                                <div className="slider-row-label">Profile</div>
                            </Col>
                            <Col span={18}>
                                <Select value={this.state.rendererProfile}
                                    onChange={(e: string) => {
                                        this.setState({
                                            rendererProfile: e
                                        });
                                    }}>
                                    {BuddhabrotRenderer.GetProfiles().map(profile => (<Select.Option value={profile.name} key={profile.name}>{profile.name}</Select.Option>))}
                                </Select>
                            </Col>
                        </Row>

                    </div>
                    <div className="el-widget">
                        <Row gutter={10} align="top" type="flex">
                            <Col span={6}>
                                <div className="slider-row-label" style={{ paddingTop: "5px" }}>Colormap</div>
                            </Col>
                            <Col span={18}>
                                <div className="el-widget">
                                    <Select value={this.state.colormap1}
                                        onChange={(e: string) => {
                                            this.setState({
                                                colormap1: e
                                            }, () => {
                                                this.refs.renderer.setColormap(this.getCurrentColormap());
                                                this.refs.renderer.refresh();
                                            });
                                        }}>
                                        {colormaps.map(cm => (<Select.Option value={cm.name} key={cm.name}><ColorMapView colormap={cm.colormap_rgb} /> {cm.name}</Select.Option>))}
                                    </Select>
                                </div>
                                <div className="el-widget">
                                    <Select value={this.state.colormap2}
                                        onChange={(e: string) => {
                                            this.setState({
                                                colormap2: e
                                            }, () => {
                                                this.refs.renderer.setColormap(this.getCurrentColormap());
                                                this.refs.renderer.refresh();
                                            });
                                        }}>
                                        {colormaps.map(cm => (<Select.Option value={cm.name} key={cm.name}><ColorMapView colormap={cm.colormap_rgb} /> {cm.name}</Select.Option>))}
                                    </Select>
                                </div>
                                <div className="el-widget">
                                    <Select value={this.state.colormap3}
                                        onChange={(e: string) => {
                                            this.setState({
                                                colormap3: e
                                            }, () => {
                                                this.refs.renderer.setColormap(this.getCurrentColormap());
                                                this.refs.renderer.refresh();
                                            });
                                        }}>
                                        {colormaps.map(cm => (<Select.Option value={cm.name} key={cm.name}><ColorMapView colormap={cm.colormap_rgb} /> {cm.name}</Select.Option>))}
                                    </Select>
                                </div>
                            </Col>
                        </Row>
                    </div>
                    <div className="el-widget">
                        <SliderRow
                            label="Exposure"
                            min={-3}
                            max={3}
                            step={0.01}
                            value={this.state.rendererExposure}
                            onChange={(e: number) => {
                                this.setState({
                                    rendererExposure: e
                                });
                                this.refs.renderer.setExposure(e);
                                this.refs.renderer.refresh();
                            }}
                        />
                    </div>
                    <div className="el-widget">
                        <SliderRow
                            label="Spectrum"
                            min={0}
                            max={5}
                            step={0.01}
                            value={this.state.rendererSpectrumScaler}
                            onChange={(e: number) => {
                                this.setState({
                                    rendererSpectrumScaler: e
                                });
                                this.refs.renderer.setSpectrumScaler(e);
                                this.refs.renderer.refresh();
                            }}
                        />
                    </div>
                    <h3>Fractal Parameters</h3>
                    <div className="el-widget">
                        <Row gutter={10} align="middle" type="flex">
                            <Col span={6}>
                                <div className="slider-row-label"><strong>Preset</strong></div>
                            </Col>
                            <Col span={18}>
                                <Select value="Load Preset..."
                                    onChange={(e: string) => {
                                        for (let cm of this.state.fractal.getPresets()) {
                                            if (cm.name == e) {
                                                this.state.fractal.loadPreset(cm);
                                                this.forceUpdate();
                                                this.refs.renderer.refresh();
                                            }
                                        }
                                    }}>
                                    {this.state.fractal.getPresets().map(p => (<Select.Option value={p.name} key={p.name}>{p.name}</Select.Option>))}
                                </Select>
                            </Col>
                        </Row>
                    </div>
                    {this.state.fractal.getParameters().map((p) => {
                        if (p.type == "number") {
                            return (
                                <div className="el-widget" key={p.name}>
                                    <SliderRow value={this.state.fractal.parameters[p.name]}
                                        label={p.name}
                                        min={p.range ? p.range[0] : -10}
                                        max={p.range ? p.range[1] : +10}
                                        step={p.step !== undefined ? p.step : 0.001}
                                        disabled={p.disabled || this.state.isPlaying}
                                        onChange={(e) => {
                                            this.state.fractal.setParameter(p.name, e);
                                            this.forceUpdate();
                                            this.refs.renderer.refresh();
                                        }}
                                    />
                                </div>
                            );
                        }
                    })}
                    <h3>Animation</h3>
                    <div className="el-widget">
                        <Button shape="circle" onClick={() => {
                            this.togglePlay();
                        }}>{this.state.isPlaying ? <Icon type="pause-circle" /> : <Icon type="play-circle" />}</Button>{" "}
                        <Button shape="circle" onClick={() => {
                            var blob = new Blob([JSON.stringify(this.state.animation)], { type: "text/plain;charset=utf-8" });
                            FileSaver.saveAs(blob, "animation.json");
                        }}><Icon type="download" /></Button>{" "}
                        <Button shape="circle" onClick={() => {
                            let input = document.createElement("input");
                            input.type = "file";
                            input.onchange = () => {
                                if (input.files.length == 1) {
                                    let file = input.files[0];
                                    let reader = new FileReader();
                                    reader.onload = (e) => {
                                        let animation = JSON.parse(reader.result);
                                        this.setState({
                                            animation: animation
                                        });
                                    };
                                    reader.readAsText(file);
                                }
                            };
                            input.click();
                        }}><Icon type="folder-open" /></Button>
                        <span style={{ width: "10px", display: "inline-block" }} />
                        <Button onClick={() => {
                            let map = this.state.fractal.saveParameters();
                            this.state.animation.push({
                                parameters: map,
                                image: this.refs.renderer.saveImage(100)
                            });
                            this.setState({
                                animation: this.state.animation
                            });
                        }}>Add Keyframe</Button>{" "}
                        <Button shape="circle" onClick={() => {
                            this.setState({
                                animation: []
                            });
                        }}><Icon type="delete" /></Button>{" "}
                    </div>
                    {isElectron ? (
                        <div className="el-widget">
                            <Button onClick={() => {
                                this.exportAnimation();
                            }}>Export Video</Button>
                        </div>
                    ) : null}
                    <div className="el-widget">
                        {this.state.animation.map((a, index) => {
                            return (
                                <div className="el-animation-item" key={index} onClick={() => {
                                    if (this.state.isPlaying) return;
                                    this.state.fractal.loadParameters(a.parameters);
                                    this.refs.renderer.refresh();
                                    this.forceUpdate();
                                }}>
                                    <img src={a.image} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }
}

function MainView(props: {}) {
    return (
        <div className="main-view">
            <div className="main-header">
                <div className="el-left"><strong>Realtime Buddhabrot Renderer</strong></div>
                <div className="el-right">Copyright 2018, Donghao Ren. <a href="https://github.com/donghaoren/buddhabrot-renderer">Source Code</a></div>
            </div>
            <FractalApplication />
        </div>
    );
}

export class PerformanceView extends React.Component<{}, {}> {
    refs: {
        mainCanvas: HTMLCanvasElement;
    };

    renderer: BuddhabrotRenderer;
    options: BuddhabrotRendererOptions;
    fractal: Fractal;
    baseScale: number;

    public componentDidMount() {
        this.refs.mainCanvas.width = 2048;
        this.refs.mainCanvas.height = 2048;
        this.fractal = new Fractal();
        this.options = BuddhabrotRenderer.GetProfileOptions(BuddhabrotRenderer.GetDefaultProfile());
        this.options.renderSize = 2048;
        this.options.samplerLowerBound = 20000;
        this.renderer = new BuddhabrotRenderer(this.refs.mainCanvas, this.fractal, this.options);
        this.renderer.setColormap([colormaps[0].colormap_xyz, colormaps[1].colormap_xyz, colormaps[2].colormap_xyz]);
        this.renderer.exposure = 0;
        this.baseScale = Math.log(9 / 16) / Math.log(2);
        this.fractal.parameters.scale = this.baseScale;

        let io = require("socket.io-client");
        let socket = io();
        socket.on("message", (data) => {
            if (data.type == "parameters") {
                for (let key in data.parameters) {
                    if (key == "scale") {
                        this.fractal.parameters[key] = this.baseScale + data.parameters[key];
                    } else {
                        this.fractal.parameters[key] = data.parameters[key];
                    }
                }
            }
        });
        this.scheduleRender();
    }

    pr: number;
    n = 1;
    public scheduleRender() {
        if (this.pr) {
            cancelAnimationFrame(this.pr);
        }

        let distillParameters = () => {
            return this.fractal.getParameters().map(x => {
                let v = this.fractal.parameters[x.name];
                return v / (x.range[1] - x.range[0]);
            });
        };

        this.pr = requestAnimationFrame(() => {
            this.scheduleRender();

            let previous_weight = 0.9;
            this.n = this.n * previous_weight + 1;
            this.renderer.render(this.n, previous_weight);
        });
    }

    public render() {
        return (
            <div className="performance-view">
                <canvas ref="mainCanvas" style={{ width: "100%" }} />
            </div>
        );
    }
}

if (appEnvironment == "performance") {
    initialize().then(() => {
        ReactDOM.render(<PerformanceView />, document.getElementById("container"));
    });
} else {
    initialize().then(() => {
        ReactDOM.render(<MainView />, document.getElementById("container"));
    });
}