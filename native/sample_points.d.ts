export function initialize(): Promise<void>;

export class Sampler {
    setSize(width: number, height: number): void;
    setLowerBound(lowerBound: number): void;
    sample(): void;
    getBuffer(): Uint8Array;
    getSamples(): Float32Array;
    getSamplesCount(): number;
    destroy(): void;
}