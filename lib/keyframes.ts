// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Per-property keyframes for text and absolute-image layers. A property with
// keyframes ignores its base value and follows the curve; editing it at the
// playhead updates (or creates) the key there, like a stopwatch in After Effects.
export const KEY_PROPS = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity', 'tiltX', 'tiltY'] as const;
export type KeyProp = (typeof KEY_PROPS)[number];
export type KeyEase = 'linear' | 'ease' | 'in' | 'out' | 'hold';
export interface Keyframe { t: number; v: number; ease?: KeyEase }
export type Keyframes = Partial<Record<KeyProp, Keyframe[]>>;
interface Keyed { keyframes?: Keyframes }

export const KEY_EPSILON = 1 / 240; // keys closer than this are the same key
const curve = (ease: KeyEase | undefined, u: number) => ease === 'hold' ? 0 : ease === 'linear' ? u : ease === 'in' ? u * u * u : ease === 'out' ? 1 - (1 - u) ** 3 : u < .5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
export const isKeyProp = (key: string): key is KeyProp => (KEY_PROPS as readonly string[]).includes(key);
export const hasKeys = (layer: Keyed, prop?: KeyProp) => prop ? !!layer.keyframes?.[prop]?.length : KEY_PROPS.some((p) => !!layer.keyframes?.[p]?.length);

export function valueAt(list: Keyframe[] | undefined, t: number, fallback: number): number {
  if (!list?.length) return fallback;
  if (t <= list[0].t) return list[0].v;
  const last = list[list.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    if (t >= a.t && t <= b.t) { const span = b.t - a.t; return span <= 0 ? b.v : a.v + (b.v - a.v) * curve(a.ease, (t - a.t) / span); }
  }
  return last.v;
}

// The layer as it looks at `seconds`, with keyed properties resolved.
export function animatedLayer<T extends Keyed>(layer: T, seconds: number): T {
  if (!layer.keyframes || !hasKeys(layer)) return layer;
  const out = { ...layer } as T & Record<KeyProp, number>;
  for (const prop of KEY_PROPS) { const list = layer.keyframes[prop]; if (list?.length) out[prop] = valueAt(list, seconds, (layer as unknown as Record<string, number>)[prop] ?? (prop === 'opacity' || prop.startsWith('scale') ? 1 : 0)); }
  return out;
}

export function setKey(list: Keyframe[] = [], t: number, v: number, ease?: KeyEase): Keyframe[] {
  const index = list.findIndex((k) => Math.abs(k.t - t) < KEY_EPSILON);
  const key: Keyframe = { t: Math.max(0, Math.round(t * 1000) / 1000), v, ...(ease ?? list[index]?.ease ? { ease: ease ?? list[index]?.ease } : {}) };
  const next = index >= 0 ? list.map((k, i) => i === index ? key : k) : [...list, key];
  return next.sort((a, b) => a.t - b.t);
}
export const removeKey = (list: Keyframe[] = [], t: number) => list.filter((k) => Math.abs(k.t - t) >= KEY_EPSILON);
export const keyAt = (list: Keyframe[] | undefined, t: number) => list?.find((k) => Math.abs(k.t - t) < KEY_EPSILON);
export function neighbourKey(layer: Keyed, t: number, direction: 1 | -1, props: readonly KeyProp[] = KEY_PROPS): number | null {
  const times = props.flatMap((p) => layer.keyframes?.[p]?.map((k) => k.t) ?? []);
  const candidates = times.filter((k) => direction > 0 ? k > t + KEY_EPSILON : k < t - KEY_EPSILON);
  return candidates.length ? (direction > 0 ? Math.min(...candidates) : Math.max(...candidates)) : null;
}
export const keyTimes = (layer: Keyed) => [...new Set(KEY_PROPS.flatMap((p) => layer.keyframes?.[p]?.map((k) => k.t) ?? []))].sort((a, b) => a - b);

// Route an edit: keyed properties write a key at `seconds`, others the base value.
export function keyedPatch<T extends Keyed>(layer: T, change: Record<string, unknown>, seconds: number): Partial<T> {
  if (!layer.keyframes || !hasKeys(layer)) return change as Partial<T>;
  const keyframes: Keyframes = { ...layer.keyframes }, rest: Record<string, unknown> = {};
  let keyed = false;
  for (const [prop, value] of Object.entries(change)) {
    if (isKeyProp(prop) && typeof value === 'number' && keyframes[prop]?.length) { keyframes[prop] = setKey(keyframes[prop], seconds, value); keyed = true; }
    else rest[prop] = value;
  }
  return (keyed ? { ...rest, keyframes } : rest) as Partial<T>;
}
// Turn keying on for a property (first key at the playhead) or off (drop all keys, keep the value seen now).
export function toggleKeying<T extends Keyed>(layer: T, prop: KeyProp, seconds: number): Partial<T> {
  const current = animatedLayer(layer, seconds) as unknown as Record<string, number>;
  const base = current[prop] ?? (prop === 'opacity' || prop.startsWith('scale') ? 1 : 0);
  const keyframes: Keyframes = { ...(layer.keyframes ?? {}) };
  if (keyframes[prop]?.length) { delete keyframes[prop]; return { keyframes, [prop]: base } as Partial<T>; }
  keyframes[prop] = [{ t: Math.round(seconds * 1000) / 1000, v: base }];
  return { keyframes } as Partial<T>;
}
