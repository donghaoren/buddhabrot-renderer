import { ChildProcess } from "child_process";

export class VideoEncoder {
    process: ChildProcess;
    width: number;
    height: number;

    constructor(output: string, width: number, height: number, fps: number, filters: string[] = []) {
        this.width = width;
        this.height = height;
        let child_process = require("child_process");
        this.process = child_process.spawn("ffmpeg", [
            "-f", "rawvideo",
            "-pixel_format", "rgba",
            "-video_size", `${width}x${height}`,
            "-r", fps,
            "-i", "-",
            ...filters,
            "-vcodec", "libx264",
            "-pix_fmt", "yuv444p",
            "-preset", "fast",
            "-crf", "16",
            "-an",
            "-r", fps,
            "-y",
            output
        ], { stdio: ["pipe", "inherit", "inherit"] });
    }

    addFrame(frame: Buffer): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (frame.byteLength != this.width * this.height * 4) {
                throw new Error("frame length mismatch");
            }
            this.process.stdin.write(frame, () => {
                resolve();
            });
        });
    }

    complete(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.process.stdin.end();
            this.process.on("close", () => {
                resolve();
            });
        });
    }
}