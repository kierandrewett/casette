import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ------------------------------------------------------------------
// Progress parsing
// ------------------------------------------------------------------

// ffmpeg reports progress to stderr with lines like:
//   out_time_ms=12345678
//   progress=continue   (or "end")
//
// We parse these to derive a 0–1 fraction of `totalDurationMs`.

export type ProgressCallback = (fraction: number) => void;

const parseOutTimeMs = (line: string): number | null => {
    const match = /^out_time_ms=(\d+)/.exec(line.trim());
    if (!match || !match[1]) return null;
    return parseInt(match[1], 10);
};

// ------------------------------------------------------------------
// Encoder detection
// ------------------------------------------------------------------

let nvencAvailable: boolean | null = null;

export const isNvencAvailable = async (): Promise<boolean> => {
    if (nvencAvailable !== null) return nvencAvailable;
    try {
        const { stdout } = await execFileAsync("ffmpeg", ["-hide_banner", "-encoders"]);
        nvencAvailable = stdout.includes("h264_nvenc");
    } catch {
        nvencAvailable = false;
    }
    return nvencAvailable;
};

// ------------------------------------------------------------------
// Main spawn helper
// ------------------------------------------------------------------

export type SpawnFfmpegOptions = {
    args: string[];
    /** Total duration in seconds for progress fraction calculation. */
    durationSec?: number;
    onProgress?: ProgressCallback;
};

// Spawn ffmpeg with the given args, stream progress events via `onProgress`,
// collect stderr for error reporting, and resolve/reject on exit.
export const spawnFfmpeg = (options: SpawnFfmpegOptions): Promise<void> =>
    new Promise((resolve, reject) => {
        const { args, durationSec, onProgress } = options;
        const totalMs = (durationSec ?? 0) * 1000;

        // `-progress pipe:2` writes progress key=value pairs to stderr.
        // We also pass `-stats_period 2` to throttle output.
        const finalArgs = ["-progress", "pipe:2", "-stats_period", "2", ...args];

        const child = spawn("ffmpeg", finalArgs, { stdio: ["ignore", "ignore", "pipe"] });

        const stderrLines: string[] = [];
        let stderrBuf = "";

        child.stderr?.on("data", (chunk: Buffer) => {
            stderrBuf += chunk.toString("utf8");
            const lines = stderrBuf.split("\n");
            // Keep incomplete last line in the buffer.
            stderrBuf = lines.pop() ?? "";

            for (const line of lines) {
                stderrLines.push(line);
                // Keep only the last 4 KB worth of lines.
                while (stderrLines.join("\n").length > 4096) {
                    stderrLines.shift();
                }

                if (onProgress && totalMs > 0) {
                    const outTimeMs = parseOutTimeMs(line);
                    if (outTimeMs !== null) {
                        const fraction = Math.min(1, outTimeMs / totalMs);
                        onProgress(fraction);
                    }
                }
            }
        });

        child.on("error", reject);

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                const stderr = [...stderrLines, stderrBuf].join("\n").slice(-4096);
                reject(new FfmpegError(`ffmpeg exited with code ${code}`, stderr));
            }
        });
    });

export class FfmpegError extends Error {
    readonly stderr: string;
    constructor(message: string, stderr: string) {
        super(message);
        this.name = "FfmpegError";
        this.stderr = stderr;
    }
}

// ------------------------------------------------------------------
// Simple one-shot wrapper for thumbnail / sprite / caption extraction
// (no progress needed, short operations).
// ------------------------------------------------------------------

export const runFfmpeg = async (args: string[]): Promise<{ stderr: string }> => {
    return new Promise((resolve, reject) => {
        const child = spawn("ffmpeg", ["-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
        let stderr = "";
        child.stderr?.on("data", (chunk: Buffer) => {
            stderr += chunk.toString("utf8");
        });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve({ stderr });
            } else {
                reject(new FfmpegError(`ffmpeg exited with code ${code}`, stderr.slice(-4096)));
            }
        });
    });
};
