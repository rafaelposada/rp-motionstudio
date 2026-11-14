// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Code layers: a Canvas 2D or WebGL drawing written in JavaScript, rendered
// frame by frame like any other layer. The code runs in its own worker with an
// OffscreenCanvas and without network or storage, and draw() receives the
// layer's own clock, so the preview and the export show the same frames.
import { MEDIA_READY_EVENT } from './shapeFill';

export type CodeEngine = '2d' | 'webgl';
export interface CodeSpec { engine: CodeEngine; width: number; height: number; source: string; params?: Record<string, number | string | boolean> }
type Layer = { id: string; start: number; end: number; visible: boolean; code?: CodeSpec };

export const CODE_LIMITS = { size: [16, 4096] as const, source: 200_000 };

// Default for a new layer: a looping 2D drawing that shows the contract.
export const CODE_EXAMPLE = `// draw() roda a cada quadro. t = segundos desde que a camada aparece.
// ctx (Canvas 2D) ou gl (WebGL2), width, height, duration, progress (0–1),
// params (valores livres) e state (o que setup() devolveu).
function setup({ width, height }) {
  return { dots: Array.from({ length: 48 }, (_, i) => ({ a: i / 48 * Math.PI * 2, r: 0.18 + (i % 6) * 0.05 })) };
}

function draw({ ctx, width, height, t, state }) {
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2, cy = height / 2, s = Math.min(width, height);
  for (const d of state.dots) {
    const a = d.a + t * (0.6 + d.r);
    const x = cx + Math.cos(a) * s * d.r, y = cy + Math.sin(a * 1.3) * s * d.r * 0.7;
    ctx.fillStyle = \`hsla(\${(d.a * 57 + t * 40) % 360}, 80%, 60%, 0.9)\`;
    ctx.beginPath(); ctx.arc(x, y, s * 0.012, 0, Math.PI * 2); ctx.fill();
  }
}
`;

export const CODE_EXAMPLE_WEBGL = `// WebGL2: setup() compila os shaders uma vez; draw() desenha cada quadro.
function setup({ gl }) {
  const vs = \`#version 300 es
  in vec2 p; out vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0, 1); }\`;
  const fs = \`#version 300 es
  precision highp float; in vec2 uv; out vec4 o; uniform float t; uniform vec2 res;
  void main(){
    vec2 p = (uv - 0.5) * vec2(res.x / res.y, 1.0);
    float r = length(p), a = atan(p.y, p.x);
    float w = sin(10.0 * r - t * 2.0 + sin(a * 3.0 + t) * 1.5);
    vec3 c = mix(vec3(0.05, 0.07, 0.12), vec3(0.2, 0.45, 1.0), smoothstep(-0.2, 1.0, w));
    o = vec4(c, 1.0);
  }\`;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  return { program, t: gl.getUniformLocation(program, 't'), res: gl.getUniformLocation(program, 'res'), p: gl.getAttribLocation(program, 'p') };
}

function draw({ gl, width, height, t, state }) {
  gl.viewport(0, 0, width, height); gl.useProgram(state.program);
  gl.enableVertexAttribArray(state.p); gl.vertexAttribPointer(state.p, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1f(state.t, t); gl.uniform2f(state.res, width, height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
`;

export function normalizeCode(code: Partial<CodeSpec>): CodeSpec {
  const size = (v: unknown, fallback: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(CODE_LIMITS.size[1], Math.max(CODE_LIMITS.size[0], n)) : fallback; };
  const source = typeof code.source === 'string' ? code.source.slice(0, CODE_LIMITS.source) : CODE_EXAMPLE;
  const params = code.params && typeof code.params === 'object' ? Object.fromEntries(Object.entries(code.params).filter(([, v]) => ['number', 'string', 'boolean'].includes(typeof v)).slice(0, 64)) as CodeSpec['params'] : {};
  return { engine: code.engine === 'webgl' ? 'webgl' : '2d', width: size(code.width, 1080), height: size(code.height, 1080), source, params };
}

// Worker source: the guard runs first and removes every way out of the
// sandbox (network, storage, nested workers), then the user's code is
// declared, then the frame loop. Nothing here relies on eval.
const PRELUDE = `"use strict";
(() => {
  const blocked = ['fetch','XMLHttpRequest','WebSocket','WebTransport','EventSource','importScripts','indexedDB','caches','Worker','SharedWorker','BroadcastChannel','navigator','Request','Response'];
  for (let o = self; o; o = Object.getPrototypeOf(o)) for (const k of blocked) { try { Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); } catch {} }
})();
`;
const EPILOGUE = `
;(() => {
  const user = { setup: typeof setup === 'function' ? setup : null, draw: typeof draw === 'function' ? draw : null };
  const reply = self.postMessage.bind(self);
  let canvas = null, ctx = null, gl = null, state = undefined, spec = null;
  self.onmessage = (event) => {
    const m = event.data || {};
    try {
      if (m.type === 'init') {
        spec = m; canvas = new OffscreenCanvas(m.width, m.height);
        if (m.engine === 'webgl') { gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true }); if (!gl) throw new Error('WebGL2 indisponível neste computador.'); }
        else ctx = canvas.getContext('2d');
        if (!user.draw) throw new Error('Defina uma função draw({ ctx, gl, width, height, t }).');
        state = user.setup ? user.setup({ ctx, gl, canvas, width: m.width, height: m.height, params: m.params || {} }) : undefined;
        reply({ type: 'ready' });
      } else if (m.type === 'frame') {
        if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        user.draw({ ctx, gl, canvas, width: spec.width, height: spec.height, t: m.t, duration: m.duration, progress: m.duration > 0 ? Math.min(1, Math.max(0, m.t / m.duration)) : 0, frame: m.frame, fps: m.fps, params: spec.params || {}, state });
        if (gl) gl.flush();
        const bitmap = canvas.transferToImageBitmap();
        reply({ type: 'frame', id: m.id, t: m.t, bitmap }, [bitmap]);
      }
    } catch (error) {
      reply({ type: 'error', id: m.id, message: String(error && error.message || error).slice(0, 600), stack: String(error && error.stack || '').slice(0, 1200) });
    }
  };
})();
`;
const USER_LINE_OFFSET = PRELUDE.split('\n').length - 1;

export function codeErrorLine(stack: string) {
  const match = /:(\d+):\d+\)?\s*$/m.exec(stack.split('\n').find((line) => /blob:/.test(line)) ?? '');
  const line = match ? Number(match[1]) - USER_LINE_OFFSET : NaN;
  return Number.isFinite(line) && line > 0 ? line : undefined;
}

const FRAME_TIMEOUT = 4000;
const announce = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(MEDIA_READY_EVENT)); };
const signatureOf = (code: CodeSpec) => JSON.stringify([code.engine, code.width, code.height, code.source, code.params]);

interface Waiter { resolve: (bitmap: ImageBitmap | null) => void; t: number; timer: ReturnType<typeof setTimeout> }
class CodeRunner {
  private worker: Worker | null = null;
  private url = '';
  private next = 1;
  private waiting = new Map<number, Waiter>();
  private inflight: number | null = null;
  signature = '';
  bitmap: ImageBitmap | null = null;
  bitmapTime = NaN;
  error = '';
  errorLine: number | undefined;

  constructor(private readonly code: CodeSpec) { this.signature = signatureOf(code); this.start(); }

  private start() {
    try {
      this.url = URL.createObjectURL(new Blob([PRELUDE, this.code.source, EPILOGUE], { type: 'text/javascript' }));
      this.worker = new Worker(this.url);
      this.worker.onmessage = (event) => this.receive(event.data);
      this.worker.onerror = (event) => { event.preventDefault(); this.fail(event.message || 'Erro no código.', `blob:x:${event.lineno}:${event.colno}`); };
      this.worker.postMessage({ type: 'init', engine: this.code.engine, width: this.code.width, height: this.code.height, params: this.code.params ?? {} });
    } catch (error) { this.fail(error instanceof Error ? error.message : String(error), ''); }
  }

  private receive(message: { type?: string; id?: number; t?: number; bitmap?: ImageBitmap; message?: string; stack?: string }) {
    if (message?.type === 'ready') { if (this.error) { this.error = ''; this.errorLine = undefined; announce(); } return; }
    if (message?.type === 'frame' && message.bitmap instanceof ImageBitmap && typeof message.id === 'number') {
      if (this.error) { this.error = ''; this.errorLine = undefined; }
      this.bitmap?.close(); this.bitmap = message.bitmap; this.bitmapTime = Number(message.t);
      const waiter = this.waiting.get(message.id);
      if (waiter) { clearTimeout(waiter.timer); this.waiting.delete(message.id); waiter.resolve(this.bitmap); }
      if (this.inflight === message.id) this.inflight = null;
      announce(); return;
    }
    if (message?.type === 'error') {
      this.fail(String(message.message ?? 'Erro no código.'), String(message.stack ?? ''));
      const waiter = typeof message.id === 'number' ? this.waiting.get(message.id) : undefined;
      if (waiter) { clearTimeout(waiter.timer); this.waiting.delete(message.id!); waiter.resolve(null); }
      if (this.inflight === message.id) this.inflight = null;
    }
  }

  private fail(message: string, stack: string) { this.error = message; this.errorLine = codeErrorLine(stack); announce(); }

  request(t: number, duration: number, fps: number): Promise<ImageBitmap | null> {
    if (!this.worker) return Promise.resolve(null);
    const id = this.next++;
    return new Promise((resolve) => {
      // A drawing that never returns (an endless loop) is stopped and reported.
      // It stays stopped until the code changes, instead of hanging again.
      const timer = setTimeout(() => { this.waiting.delete(id); this.stop(false); this.fail('O código demorou mais de 4 s para desenhar um quadro e foi interrompido. Corrija e aplique de novo.', ''); resolve(null); }, FRAME_TIMEOUT);
      this.waiting.set(id, { resolve, t, timer });
      this.inflight = id;
      this.worker!.postMessage({ type: 'frame', id, t, duration, frame: Math.round(t * fps), fps });
    });
  }

  // Preview: ask for the frame at t without waiting; keep showing the last one.
  want(t: number, duration: number, fps: number) {
    if (this.inflight !== null || Math.abs(this.bitmapTime - t) < 1e-6) return;
    void this.request(t, duration, fps);
  }

  stop(clearBitmap = true) {
    this.worker?.terminate(); this.worker = null;
    if (this.url) URL.revokeObjectURL(this.url); this.url = '';
    for (const waiter of this.waiting.values()) { clearTimeout(waiter.timer); waiter.resolve(null); }
    this.waiting.clear(); this.inflight = null;
    if (clearBitmap) { this.bitmap?.close(); this.bitmap = null; this.bitmapTime = NaN; }
  }
}

const runners = new Map<string, CodeRunner>();
function runnerFor(layer: Layer & { code: CodeSpec }) {
  let runner = runners.get(layer.id);
  if (runner && runner.signature !== signatureOf(layer.code)) { runner.stop(); runner = undefined; }
  if (!runner) { runner = new CodeRunner(layer.code); runners.set(layer.id, runner); }
  return runner;
}

const localTime = (layer: Layer, seconds: number) => Math.max(0, seconds - layer.start);
const codeLayers = (layers: Layer[]) => layers.filter((l): l is Layer & { code: CodeSpec } => !!l.code);

// Preview: the latest bitmap for this layer (requesting the exact frame).
let sceneFps = 30;
export function setCodeFps(fps: number) { if (Number.isFinite(fps) && fps > 0) sceneFps = fps; }
export function codeFrame(layer: Layer & { code: CodeSpec }, seconds: number) {
  const runner = runnerFor(layer);
  runner.want(localTime(layer, seconds), layer.end - layer.start, sceneFps);
  return runner.bitmap;
}

export function codeFrameState(layer: Layer) {
  if (!layer.code) return null;
  const runner = runners.get(layer.id);
  return runner ? [runner.bitmapTime, runner.error] : 'starting';
}

export function codeLayerError(id: string) { const runner = runners.get(id); return runner?.error ? { message: runner.error, line: runner.errorLine } : null; }

// Export: decode the exact frame for this instant before it is captured.
export async function prepareCodeFrames(layers: Layer[], seconds: number, fps: number) {
  await Promise.all(codeLayers(layers).filter((l) => l.visible && seconds >= l.start && seconds < l.end).map((layer) => {
    const runner = runnerFor(layer), t = localTime(layer, seconds);
    return Math.abs(runner.bitmapTime - t) < 1e-6 ? undefined : runner.request(t, layer.end - layer.start, fps);
  }));
}

// Release workers of layers that no longer exist.
export function releaseCodeRunners(layers: Layer[]) {
  const alive = new Set(codeLayers(layers).map((l) => l.id));
  for (const [id, runner] of runners) if (!alive.has(id)) { runner.stop(); runners.delete(id); }
}
