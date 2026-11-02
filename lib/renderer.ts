// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import * as PIXI from 'pixi.js';
import { TextCompositor, OverlayRaster } from '@/lib/textLayers';
import { isCanvasEditing } from './canvasEditing';
import { gradientFor, gradientCanvas } from './backgroundGradient';
import { compositionOrder } from '@/lib/composition';
import { loadImage, loadPreviewImage } from '@/lib/textureLoad';
import { PixelateFilter } from 'pixi-filters';
import { getTemplate, layerCountFor } from '@/templates';
import { getEffect } from '@/effects';
import { pixiFiltersFor, applyPixiUniforms, dropPixiFilters } from '@/effects/adapters/pixi';
import { useSceneStore, type SceneState } from '@/store/useSceneStore';
import { resolveEasing } from '@/lib/easing';
import { assetIndexForSlot, clamp } from '@/lib/motion';
import { resolveTrackTime, trackAssetIndices, type MotionTrack } from '@/lib/tracks';
import { cardAspectFor, coverCrop, cropKey } from '@/lib/crop';
import { advanceVideoForExport, createCardVideo, isVideoSource, prepareVideoForSequentialExport, whenVideoReady } from '@/lib/videoTexture';
import { placeholderFill, placeholderLabel } from '@/lib/placeholderPalette';
import { previewResolution } from '@/lib/previewResolution';
import { reelVideoTime, syncReelVideo } from '@/lib/reelVideoClock';
import { renderableTracks, renderableAssetUrls, exportImageUrls } from '@/lib/renderAssets';
import { cardOpacity } from '@/lib/cardOpacity';
import { modelPathOffset } from '@/lib/modelMotionPath';
import { desktopAPI } from '@/lib/desktop';

// Reference base long-edge (px) shared with templates (carousel BASE = 340),
// so control values read directly in on-screen pixels.
const SPRITE_BASE = 340;

interface Slot {
  root: PIXI.Container;
  sprite: PIXI.Sprite;
  mask: PIXI.Graphics;
  label: PIXI.Text;
  texW: number;
  texH: number;
  cornerR: number; // last-applied corner radius fraction, for mask caching
  bindKey: string; // guards async image/video loads from overwriting a newer slot
}

// The GPU-side realization of one motion track. Each track owns its own sprite
// pool and its own container, so tracks composite over each other (container
// order = stacking order) and can carry independent alpha / blend modes.
interface TrackRT {
  container: PIXI.Container;
  slots: Slot[];
  assetSig: string;
  countSig: number;
}

// A single white rounded texture, tinted per placeholder card.
function makePlaceholderTexture(app: PIXI.Application): PIXI.Texture {
  const g = new PIXI.Graphics();
  g.roundRect(0, 0, 480, 600, 8).fill(0xffffff);
  return app.renderer.generateTexture(g);
}

export class SceneRenderer {
  private exportingImages = false;
  private previewImageTextures = new Map<string, PIXI.Texture | undefined>();
  private overlays = new Map<string, { raster: OverlayRaster; texture: PIXI.Texture; sprite: PIXI.Sprite }>();
  private textCompositor = new TextCompositor();
  private outputCanvas: HTMLCanvasElement | null = null;
  app: PIXI.Application;
  onDirty?: () => void;   // preview loop hooks this to redraw once after async loads
  private content = new PIXI.Container();       // bg + motion (effects applied here)
  private bg = new PIXI.Graphics();
  private bgSprite = new PIXI.Sprite();          // image / card-reflected background
  private bgBlur = new PIXI.BlurFilter({ strength: 28, quality: 4 });
  private motion = new PIXI.Container();         // card sprites
  private overlay = new PIXI.Container();        // logo/safe-area (unfiltered)
  private safeGfx = new PIXI.Graphics();
  private logoSprite: PIXI.Sprite | null = null;
  private placeholder!: PIXI.Texture;
  private textureCache = new Map<string, PIXI.Texture>();
  private texturePromises = new Map<string, Promise<PIXI.Texture | null>>();
  private croppedCache = new Map<string, PIXI.Texture>(); // cover-crop views over cached base textures
  private videoEls = new Map<string, HTMLVideoElement>();  // live <video> per url, for playback + cleanup
  private exportVideoFrames = new Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: PIXI.Texture }>();
  private liveVideoTextures = new Map<string, PIXI.Texture>();
  // One runtime per motion track, keyed by track id. `motion` holds their
  // containers; zIndex mirrors the store's track order.
  private trackRTs = new Map<string, TrackRT>();
  private ready = false;

  private lastFxSig = '';
  private readonly fxOwner = `${crypto.randomUUID()}/`;
  private bgImageUrl = '';                        // last-loaded uploaded bg url
  private bgImageTex: PIXI.Texture | null = null;
  private gradientSprite: PIXI.Sprite | null = null;
  private gradientTexture: PIXI.Texture | null = null;
  private gradientSig = '';

  constructor() {
    this.app = new PIXI.Application();
  }

  async init(canvas: HTMLCanvasElement) {
    // Pixi's statically implemented shader/uniform synchronizers avoid runtime
    // code generation. Keep the desktop CSP's eval restriction intact.
    if (desktopAPI()) await import('pixi.js/unsafe-eval');
    const { width, height } = useSceneStore.getState();
    const resolution = previewResolution();
    await this.app.init({
      canvas,
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      autoStart: false,          // we drive rendering ourselves
      preference: 'webgl',
      powerPreference: 'high-performance', // hint the browser to use the discrete GPU
      resolution,
      autoDensity: true,
      preserveDrawingBuffer: true, // so toDataURL reads real pixels during export
    });

    // Keep this explicit as well as in init options: Pixi can reuse the canvas
    // texture during renderer setup, and that path otherwise retains its old
    // density on some WebKit builds.
    this.app.renderer.resolution = resolution;
    this.app.renderer.resize(width, height, resolution);

    this.motion.sortableChildren = true;
    this.bgSprite.anchor.set(0.5);
    this.bgSprite.visible = false;
    this.bgSprite.filters = [this.bgBlur];
    this.gradientSprite = new PIXI.Sprite(); this.gradientSprite.visible = false;
    this.content.addChild(this.bg, this.gradientSprite, this.bgSprite, this.motion);
    this.app.stage.addChild(this.content, this.overlay);
    this.overlay.addChild(this.safeGfx);

    this.placeholder = makePlaceholderTexture(this.app);
    this.ready = true;
    this.resize(width, height);
    this.syncAssets();
  }

  resize(width: number, height: number, resolution = previewResolution()) {
    if (!this.ready) return;
    this.app.renderer.resolution = resolution;
    this.app.renderer.resize(width, height, resolution);
    this.motion.position.set(width / 2, height / 2);
    this.bgSprite.position.set(width / 2, height / 2);
    this.content.filterArea = new PIXI.Rectangle(0, 0, width, height);
    this.overlay.position.set(0, 0);
  }

  // ---- asset / slot management ----
  // Loads via HTMLImageElement instead of PIXI.Assets: uploads are blob: URLs
  // with no file extension, which Assets can't route to a parser (resolves null).
  // Video assets decode into a VideoSource whose texture auto-updates each frame.
  private loadTexture(url: string, kind?: string): Promise<PIXI.Texture | null> {
    const cached = this.textureCache.get(url);
    if (cached) return Promise.resolve(cached);
    const pending = this.texturePromises.get(url);
    if (pending) return pending;
    const promise = this.decodeTexture(url, kind)
      .finally(() => { this.texturePromises.delete(url); });
    this.texturePromises.set(url, promise);
    return promise;
  }

  private async decodeTexture(url: string, kind?: string): Promise<PIXI.Texture | null> {
    const cached = this.textureCache.get(url);
    if (cached) return cached;
    try {
      if (isVideoSource(url, kind)) {
        const video = this.videoEls.get(url) ?? createCardVideo(url);
        this.videoEls.set(url, video);
        await whenVideoReady(video); // videoWidth/height valid past here
        if (!this.ready) return null;
        // updateFPS:0 → re-upload the frame on every render (Ticker-driven).
        const source = new PIXI.VideoSource({ resource: video, autoPlay: true, loop: true, muted: true, updateFPS: 0 });
        const tex = new PIXI.Texture({ source });
        this.textureCache.set(url, tex);
        video.play().catch(() => { /* autoplay blocked — stays on first frame */ });
        return tex;
      }
      const img = await loadPreviewImage(url);
      if (!img) return null;
      if (!this.ready) return null;
      const tex = PIXI.Texture.from(img);
      this.textureCache.set(url, tex);
      return tex;
    } catch {
      return null; // unreadable/revoked URL — caller keeps the placeholder
    }
  }

  // Cover-fit a loaded texture into the template's card shape: a cropped view
  // (no stretch) anchored at the asset's focal point. Cached per url/aspect/focus.
  private croppedView(url: string, base: PIXI.Texture, aspect: number, crop?: { x: number; y: number }): PIXI.Texture {
    const key = cropKey(url, aspect, crop);
    const hit = this.croppedCache.get(key);
    if (hit) return hit;
    const { fx, fy, fw, fh } = coverCrop(base.width, base.height, aspect, crop);
    const tex = new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(fx, fy, fw, fh) });
    this.croppedCache.set(key, tex);
    return tex;
  }

  // Reconcile the GPU track list against the store, then rebuild each track's
  // sprite pool. Container order inside `motion` is the stacking order, so a
  // track later in the array draws over the ones before it.
  syncAssets() {
    if (!this.ready) return;
    const s = useSceneStore.getState();

    const tracks=renderableTracks(s);
    // Hidden motion layers retain project data without live GPU/video pools.
    for (const [id, rt] of this.trackRTs) {
      if (!tracks.some((t) => t.id === id)) {
        rt.container.destroy({ children: true });
        this.trackRTs.delete(id);
      }
    }

    tracks.forEach((track, order) => {
      let rt = this.trackRTs.get(track.id);
      if (!rt) {
        const container = new PIXI.Container();
        container.sortableChildren = true; // per-track depth sorting
        this.motion.addChild(container);
        rt = { container, slots: [], assetSig: '', countSig: -1 };
        this.trackRTs.set(track.id, rt);
      }
      rt.container.zIndex = order;
      this.syncTrackSlots(track, rt, s);
    });
    const used = renderableAssetUrls(s);
    for (const [key, texture] of this.croppedCache) {
      if (!used.has(key.split('|')[0])) { texture.destroy(false); this.croppedCache.delete(key); }
    }
    for (const [url, texture] of this.textureCache) {
      if (!used.has(url) && !this.exportVideoFrames.has(url)) { texture.destroy(true); this.textureCache.delete(url); }
    }
    for (const [url, video] of this.videoEls) {
      if (!used.has(url)) { video.pause(); video.removeAttribute('src'); video.load(); this.videoEls.delete(url); }
    }
    if (this.croppedCache.size > 128) {
      const live = new Set([...this.trackRTs.values()].flatMap((track) => track.slots.map((slot) => slot.sprite.texture)));
      for (const [key, texture] of this.croppedCache) {
        if (this.croppedCache.size <= 128) break;
        if (!live.has(texture)) { texture.destroy(false); this.croppedCache.delete(key); }
      }
    }
  }

  // Rebuild one track's sprite pool to match its count; slot i binds to the
  // i-th asset OF THIS TRACK'S SLICE (positional, 1:1 with the Assets panel
  // when the track takes everything), or to i % length when the template opts
  // into repeatAssets (high-count fields). Slots past the list cycle the
  // available images; numbered placeholders appear only with zero assets.
  private syncTrackSlots(track: MotionTrack, rt: TrackRT, s: SceneState) {
    const count = layerCountFor(track.templateId, track.values, s);
    const template = getTemplate(track.templateId);
    const meta = template.meta;
    const repeat = meta.repeatAssets === true;
    const defaultAspect = cardAspectFor(meta, s.width, s.height, s.cardShape);
    const slotAspects = Array.from({ length: count }, (_, i) =>
      template.slotAspect?.(i, track.values, s.width, s.height) ?? defaultAspect);
    // Which scene assets feed this track, in track order.
    const indices = trackAssetIndices(track, s.assets, repeat);
    const pool = indices.map((i) => s.assets[i]).filter(Boolean);

    const assetSig = pool.map((a) => a.crop?.zoom ?? 1).join(',') + (repeat ? 'R|' : '') + 'A' + slotAspects.map((a) => a.toFixed(4)).join(',') + '|' +
      pool.map((a) => a.id + ':' + a.url + ':' + a.visible + ':' + (a.fit ?? 'fill') + ':' + (a.crop ? a.crop.x + ',' + a.crop.y : 'c')).join('|');

    if (count === rt.countSig && assetSig === rt.assetSig) return;
    rt.countSig = count;
    rt.assetSig = assetSig;

    // grow / shrink pool
    while (rt.slots.length < count) {
      const root = new PIXI.Container();
      const sprite = new PIXI.Sprite(this.placeholder);
      sprite.anchor.set(0.5);
      const mask = new PIXI.Graphics();
      sprite.mask = mask;
      const label = new PIXI.Text({
        text: '',
        style: { fill: placeholderLabel(rt.slots.length), fontSize: 130, fontWeight: '600', fontFamily: 'Inter, system-ui, sans-serif' },
      });
      label.anchor.set(0.5);
      root.addChild(sprite, mask, label);
      rt.container.addChild(root);
      rt.slots.push({ root, sprite, mask, label, texW: 480, texH: 600, cornerR: -1, bindKey: '' });
    }
    while (rt.slots.length > count) {
      const slot = rt.slots.pop()!;
      slot.root.destroy({ children: true });
    }

    // assign textures — slot i ↔ pool asset i (or i % pool.length when
    // repeating); slots past the list cycle the set; hidden → placeholder
    rt.slots.forEach((slot, i) => {
      const aspect = slotAspects[i] ?? defaultAspect;
      const cardW = 600 * Math.min(1, aspect);
      const cardH = 600 * Math.min(1, 1 / aspect);
      let asset = pool[assetIndexForSlot(i, pool.length, repeat)];
      if (!asset && pool.length > 0) asset = pool[i % pool.length];
      const binding = `${asset?.crop?.zoom ?? 1}|` + (asset
        ? `${asset.id}|${asset.url}|${aspect.toFixed(4)}|${asset.fit ?? 'fill'}|${asset.crop?.x ?? 0.5},${asset.crop?.y ?? 0.5}`
        : `placeholder|${i}`);
      const bindingChanged = slot.bindKey !== binding;
      slot.bindKey = binding;
      if (!asset || !asset.visible || asset.origin === 'demo') {
        slot.sprite.texture = this.placeholder;
        slot.sprite.tint = placeholderFill(i);
        slot.label.style.fill = placeholderLabel(i);
        slot.label.text = String(i + 1).padStart(2, '0');
        slot.label.visible = true;
        slot.sprite.width = cardW; slot.sprite.height = cardH;
        slot.texW = cardW; slot.texH = cardH; slot.cornerR = -1;
      } else {
        if (bindingChanged) {
          // Never leave the previous template's image visible while a new crop
          // is decoding. Local/demo files replace this again in the same tick.
          slot.sprite.texture = this.placeholder;
          slot.sprite.tint = placeholderFill(i);
          slot.label.style.fill = placeholderLabel(i);
          slot.label.text = String(i + 1).padStart(2, '0');
          slot.label.visible = true;
        }
        const { url, crop, kind } = asset;
        const fit = asset.fit ?? 'fill';
        this.loadTexture(url, kind).then((base) => {
          // Export teardown can replace a cached original with its preview
          // before this microtask runs. Never rebuild a crop over a retired source.
          if (!base || base !== this.textureCache.get(url) || slot.sprite.destroyed || slot.bindKey !== binding) return;
          const tex = fit === 'fill' ? this.croppedView(url, base, aspect, crop) : base;
          slot.sprite.texture = tex;
          slot.sprite.tint = 0xffffff;
          slot.label.visible = false;
          if (fit === 'fill') {
            slot.sprite.width = tex.width; slot.sprite.height = tex.height;
            slot.texW = tex.width; slot.texH = tex.height;
          } else if (fit === 'stretch') {
            slot.sprite.width = cardW; slot.sprite.height = cardH;
            slot.texW = cardW; slot.texH = cardH;
          } else {
            const scale = Math.min(cardW / Math.max(1, base.width), cardH / Math.max(1, base.height));
            slot.sprite.width = base.width * scale; slot.sprite.height = base.height * scale;
            slot.texW = cardW; slot.texH = cardH;
          }
          slot.cornerR = -1;
          this.onDirty?.(); // texture arrived — an idle preview must redraw
        });
      }
    });
  }

  // Force every track to rebuild its pool on the next syncAssets — used when the
  // texture cache is swapped wholesale (video export begin/end).
  private invalidateTracks() {
    this.trackRTs.forEach((rt) => { rt.assetSig = ''; rt.countSig = -1; });
  }

  private applyMask(slot: Slot, cornerRadiusPct: number) {
    const frac = Math.max(0, Math.min(1, cornerRadiusPct / 100));
    if (slot.cornerR === frac) return; // cached
    slot.cornerR = frac;
    if (frac === 0) {
      // no rounding → drop the stencil mask entirely (matters at high counts)
      slot.sprite.mask = null;
      slot.mask.visible = false;
      slot.mask.clear();
      return;
    }
    slot.sprite.mask = slot.mask;
    slot.mask.visible = true;
    const w = slot.texW, h = slot.texH;
    const r = (Math.min(w, h) / 2) * frac;
    slot.mask.clear();
    slot.mask.roundRect(-w / 2, -h / 2, w, h, r).fill(0xffffff);
  }

  // ---- effects ----
  private syncEffects(frame: number) {
    const s = useSceneStore.getState();
    const active = s.effects.filter((e) => e.enabled);
    const sig = active.map((e) => e.instanceId + ':' + e.effectId + ':' + JSON.stringify(e.values)).join('|');
    const filters: PIXI.Filter[] = [];
    const live = new Set<string>();
    for (const e of active) {
      const def = getEffect(e.effectId);
      if (!def) continue;
      const key = this.fxOwner + e.instanceId; live.add(key);
      const passes = pixiFiltersFor(def, key);
      applyPixiUniforms(passes, def, e.values, { width: s.width, height: s.height, time: frame / s.fps });
      filters.push(...passes);
    }
    dropPixiFilters(live, this.fxOwner);
    this.content.filterArea = new PIXI.Rectangle(0, 0, s.width, s.height);
    if (sig !== this.lastFxSig) { this.content.filters = filters; this.lastFxSig = sig; }
  }

  // ---- overlays ----
  private drawOverlays(s: SceneState) {
    const { width, height } = s;

    // background
    this.bg.clear();
    if (s.background.gradient && s.background.source === 'color') {
      const spec = gradientFor(s.background), sig = JSON.stringify([spec,width,height]);
      if (!this.gradientSprite) return;
      if (sig !== this.gradientSig) {
        const old = this.gradientTexture;
        this.gradientTexture = PIXI.Texture.from(gradientCanvas(spec,width,height)); this.gradientSprite.texture = this.gradientTexture;
        old?.destroy(true); this.gradientSig = sig;
      }
      this.gradientSprite.visible = true; this.gradientSprite.width = width; this.gradientSprite.height = height;
    } else {
      if (this.gradientSprite) this.gradientSprite.visible = false;
      this.bg.rect(0, 0, width, height).fill(s.background.color);
    }

    // safe area guide
    this.safeGfx.clear();
    if (s.safeArea) {
      const mx = width * 0.05, my = height * 0.05;
      this.safeGfx
        .rect(mx, my, width - mx * 2, height - my * 2)
        .stroke({ width: 2, color: 0x00e5ff, alpha: 0.6 });
    }

    // logo
    if (s.logo.url) {
      if (!this.logoSprite) {
        this.logoSprite = new PIXI.Sprite();
        this.logoSprite.anchor.set(0.5);
        this.overlay.addChild(this.logoSprite);
      }
      this.loadTexture(s.logo.url).then((tex) => {
        if (!tex || !this.logoSprite || this.logoSprite.destroyed) return;
        this.logoSprite.texture = tex;
        const scale = s.logo.size / Math.max(tex.width, tex.height);
        this.logoSprite.scale.set(scale);
        this.onDirty?.();
      });
      const pad = 32;
      const half = s.logo.size / 2;
      const px = s.logo.position.includes('r') ? width - pad - half : pad + half;
      const py = s.logo.position.startsWith('t') ? pad + half : height - pad - half;
      this.logoSprite.position.set(px, py);
      this.logoSprite.visible = true;
    } else if (this.logoSprite) {
      this.logoSprite.visible = false;
    }
  }

  // Image / card-reflected background. Called after the motion loop so the
  // 'card' source can follow the featured card's live position.
  private updateBackground(
    s: SceneState,
    featured: { tex: PIXI.Texture; x: number; y: number } | null,
  ) {
    const bg = s.background;
    const { width, height } = s;

    let tex: PIXI.Texture | null = null;
    let follow = false;
    if (bg.source === 'image') {
      if (bg.imageUrl && bg.imageUrl !== this.bgImageUrl) {
        this.bgImageUrl = bg.imageUrl;
        this.bgImageTex = null;
        this.loadTexture(bg.imageUrl).then((t) => { if (t) { this.bgImageTex = t; this.onDirty?.(); } });
      }
      if (!bg.imageUrl) { this.bgImageUrl = ''; this.bgImageTex = null; }
      tex = this.bgImageTex;
    } else if (bg.source === 'card' && featured) {
      tex = featured.tex;
      follow = true;
    }

    if (!tex) { this.bgSprite.visible = false; return; }

    this.bgSprite.visible = true;
    this.bgSprite.texture = tex;
    const cover = Math.max(width / tex.width, height / tex.height) * 1.4; // headroom for drift
    this.bgSprite.scale.set(cover);
    // 'card' bg drifts with the featured card so the background reacts to motion
    const k = follow ? 0.18 : 0;
    this.bgSprite.position.set(width / 2 + (featured?.x ?? 0) * k, height / 2 + (featured?.y ?? 0) * k);
    this.bgBlur.strength = Math.max(0, bg.blur);
  }

  /**
   * THE single clock. Realizes the full scene onto the stage for `frame`.
   * Both live preview and export capture call this — WYSIWYG guarantee.
   * Reads the live store every call (principle 1).
   */
  getFrameState(frame: number) {
    if (!this.ready) return;
    const s = useSceneStore.getState();

    this.syncAssets();
    // live loop/hold behaviour follows the scene setting (non-loop <video>
    // naturally freezes on its last frame when it ends)
    this.videoEls.forEach((v, url) => {
      v.loop = s.videoEnd !== 'hold';
      if (!this.exportVideoFrames.size) syncReelVideo(v, reelVideoTime(s, url, frame), s, this.onDirty);
    });
    this.syncEffects(frame);
    this.drawOverlays(s);

    const totalFrames = Math.max(1, Math.round(s.duration * s.fps));

    // Track the featured (front-most) card so a 'card' background can reflect
    // it. Later tracks draw on top, so their cards win ties — the background
    // reflects what the viewer actually sees in front.
    let featured: { tex: PIXI.Texture; x: number; y: number } | null = null;
    let featuredScore = -Infinity;

    s.tracks.forEach((track, order) => {
      const rt = this.trackRTs.get(track.id);
      if (!rt) return;

      // Visibility is a layer-level contract. Keeping hidden tracks in the GPU
      // pool makes re-enabling instant, but they must leave both composition and
      // featured-card background selection while the eye toggle is off.
      if (!track.visible || (s.compositeMode === 'single' && track.id !== s.activeTrackId)) {
        rt.container.visible = false;
        return;
      }

      // Map the scene frame onto this track's own window. Outside it, the whole
      // container is hidden — no per-slot work at all.
      const time = resolveTrackTime(track, frame, totalFrames);
      if (!time.active) { rt.container.visible = false; return; }

      rt.container.visible = true;
      rt.container.alpha = clamp(track.opacity, 0, 1) * time.envelope;
      rt.container.blendMode = track.blend;
      // Track-level transform, on top of whatever the template poses.
      const path = modelPathOffset(track, frame, s.fps, s.width, s.height);
      rt.container.position.set(track.transform.x + path.x, track.transform.y + path.y);
      rt.container.scale.set(track.transform.scale);
      rt.container.rotation = (track.transform.rotation * Math.PI) / 180;

      const template = getTemplate(track.templateId);
      const count = rt.slots.length;

      // Resolve this track's easing once per frame; shape cyclic phases so each
      // unit step follows the curve while the loop stays seamless (ease(0)=0,
      // ease(1)=1 ⇒ continuous at every integer boundary).
      const ease = resolveEasing(track.easing);
      const easedPhase = (phase: number) => {
        const base = Math.floor(phase);
        return base + ease(phase - base);
      };
      // The track's WINDOW is its clip: templates quantize against
      // ctx.totalFrames, so each track loops seamlessly inside its own window.
      const ctx = {
        fps: s.fps, width: s.width, height: s.height,
        duration: time.localTotal / Math.max(1, s.fps),
        totalFrames: time.localTotal,
        ease, easedPhase,
        // Resolved the same way the sprites themselves are cropped, so a
        // lattice template spaces cards by the shape actually on screen.
        cardAspect: cardAspectFor(template.meta, s.width, s.height, s.cardShape),
      };

      for (let i = 0; i < count; i++) {
        const slot = rt.slots[i];
        const t = template.transform(time.localFrame, i, count, track.values, ctx);
        const norm = SPRITE_BASE / Math.max(slot.texW, slot.texH);
        slot.root.position.set(t.x, t.y);
        slot.root.scale.set(norm * t.scale * (t.scaleX ?? 1), norm * t.scale * (t.scaleY ?? 1));
        slot.root.rotation = t.rotation;
        const alpha=cardOpacity(t.alpha,track.values._autoTransparency===true,t.solidAlpha);
        slot.root.alpha = alpha;
        const brightness = 1 - clamp(t.dim ?? 0, 0, 1);
        const base = slot.sprite.texture === this.placeholder ? placeholderFill(i) & 255 : 255;
        slot.sprite.tint = Math.round(brightness * base) * 0x010101;
        slot.root.skew.set(t.skewX ?? 0, t.skewY ?? 0);
        slot.root.zIndex = t.depth * 1000 + i; // stable tiebreak
        this.applyMask(slot, track.values.cornerRadius ?? 0);

        // Rank across tracks: stacking order dominates, card depth breaks ties.
        const score = order * 1e6 + t.depth;
        if (score > featuredScore && alpha > 0.15) {
          featuredScore = score;
          featured = { tex: slot.sprite.texture, x: t.x, y: t.y };
        }
      }
    });

    this.updateBackground(s, featured);
  }

  // ---- video export sync ----
  async beginImageExport() {
    await Promise.all([...this.texturePromises.values()]);
    this.exportingImages = true;
    const s = useSceneStore.getState();
    const urls = exportImageUrls(s);
    for(let i=0;i<urls.length;i+=2){
      const results=await Promise.allSettled(urls.slice(i,i+2).map(async url=>{
        const image=await loadImage(url);if(!image||!this.ready)throw new Error('Não foi possível carregar a imagem original para exportar.');
        this.previewImageTextures.set(url,this.textureCache.get(url));this.textureCache.set(url,PIXI.Texture.from(image));
      }));
      const error=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');if(error)throw error.reason;
    }
    this.croppedCache.forEach(texture=>texture.destroy(false));this.croppedCache.clear();this.invalidateTracks();this.syncAssets();await Promise.resolve();
  }
  endImageExport() {
    this.exportingImages=false;
    this.croppedCache.forEach(texture=>texture.destroy(false));this.croppedCache.clear();
    this.previewImageTextures.forEach((preview,url)=>{const original=this.textureCache.get(url);if(preview)this.textureCache.set(url,preview);else this.textureCache.delete(url);if(original&&original!==preview)original.destroy(true);});
    this.previewImageTextures.clear();this.invalidateTracks();this.syncAssets();this.onDirty?.();
  }
  async beginVideoExport() {
    if (this.videoEls.size === 0) return;
    await Promise.all([...this.videoEls.values()].map(prepareVideoForSequentialExport));

    // A live VideoSource can upload an older presented frame while repeated
    // seeks are happening. Export through canvas snapshots instead, so every
    // captured scene reads immutable pixels from the completed seek.
    this.videoEls.forEach((video, url) => {
      const live = this.textureCache.get(url);
      if (!live || !video.videoWidth || !video.videoHeight) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const texture = PIXI.Texture.from(canvas);
      this.liveVideoTextures.set(url, live);
      this.exportVideoFrames.set(url, { canvas, ctx, texture });
      this.textureCache.set(url, texture);
    });
    this.croppedCache.forEach((tex) => tex.destroy(false));
    this.croppedCache.clear();
    this.invalidateTracks();
    this.syncAssets();
    await Promise.resolve();
  }

  endVideoExport() {
    this.liveVideoTextures.forEach((texture, url) => this.textureCache.set(url, texture));
    this.liveVideoTextures.clear();
    this.croppedCache.forEach((tex) => tex.destroy(false));
    this.croppedCache.clear();
    this.exportVideoFrames.forEach(({ texture }) => texture.destroy(true));
    this.exportVideoFrames.clear();
    this.invalidateTracks();
    this.syncAssets();
  }

  // Live preview plays videos on wall-clock; export is frame-indexed. Seek every
  // video card to the export time for `frame`, wait for the frame to decode, and
  // mark its GPU texture dirty so the next render uploads exactly that frame.
  async seekVideos(frame: number) {
    if (this.videoEls.size === 0) return;
    const s = useSceneStore.getState();
    const t = frame / Math.max(1, s.fps);
    await Promise.all([...this.videoEls.entries()].map(([url, v]) => {
      const localTime = reelVideoTime(s, url, frame);
      return localTime === null ? Promise.resolve() : advanceVideoForExport(v, localTime ?? t, s.fps, s.videoEnd);
    }));
    // Copy decoded pixels before touching the renderer. This isolates export
    // from the live VideoSource callback queue and makes GPU uploads ordered.
    this.videoEls.forEach((video, url) => {
      const snapshot = this.exportVideoFrames.get(url);
      if (snapshot) {
        snapshot.ctx.drawImage(video, 0, 0);
        snapshot.texture.source.update();
      } else {
        (this.textureCache.get(url)?.source as PIXI.TextureSource | undefined)?.update();
      }
    });
  }

  // Resume live playback (export finished, or preview un-paused).
  resumeVideos() {
    this.videoEls.forEach((v) => { v.play().catch(() => { /* noop */ }); });
  }

  // Freeze video decoding while the preview is paused — no point spending CPU/GPU
  // decoding frames nothing is advancing.
  pauseVideos() {
    this.videoEls.forEach((v) => { try { v.pause(); } catch { /* noop */ } });
  }

  // Timeline wrapped to 0 — restart 'hold' videos together with the clip.
  restartVideos() {
    this.videoEls.forEach((v) => {
      // Looping videos keep their own continuous playback clock. Resetting them
      // at every scene wrap makes longer clips visibly jump backwards inside
      // otherwise smoothly looping cards.
      if (v.loop) return;
      try { v.currentTime = 0; v.play().catch(() => { /* noop */ }); } catch { /* noop */ }
    });
  }

  // Realize + render a frame synchronously (used by export).
  renderFrame(frame: number) {
    this.getFrameState(frame);
    const s = useSceneStore.getState();
    const order = compositionOrder(s.tracks, s.textLayers);
    for (const [id, rt] of this.overlays) if (!s.textLayers.some((l) => l.id === id)) { rt.sprite.destroy(); rt.texture.destroy(true); rt.raster.destroy(); this.overlays.delete(id); }
    for (const item of order) {
      if (item.kind === 'motion') { const rt = this.trackRTs.get(item.id); if (rt) rt.container.zIndex = item.z; continue; }
      const layer = s.textLayers.find((l) => l.id === item.id)!;
      let rt = this.overlays.get(item.id);
      if (!rt) { const raster = new OverlayRaster(); raster.update(layer, s.width, s.height, this.app.renderer.resolution, frame / s.fps, this.exportingImages); const texture = PIXI.Texture.from(raster.canvas); const sprite = new PIXI.Sprite(texture); this.motion.addChild(sprite); rt = { raster, texture, sprite }; this.overlays.set(item.id, rt); }
      if (rt.raster.update(layer, s.width, s.height, this.app.renderer.resolution, frame / s.fps, this.exportingImages)) {
        const canvas = rt.raster.canvas;
        rt.texture.source.resize(canvas.width, canvas.height);
        rt.texture.frame.width = canvas.width; rt.texture.frame.height = canvas.height; rt.texture.update(); rt.texture.source.update();
      }
      rt.sprite.width = s.width; rt.sprite.height = s.height; rt.sprite.position.set(-s.width / 2, -s.height / 2); rt.sprite.zIndex = item.z;
      rt.sprite.visible = layer.visible && (this.exportingImages || !isCanvasEditing(layer.id)) && frame / s.fps >= layer.start && frame / s.fps < layer.end;
    }
    this.app.renderer.render(this.app.stage);
    this.outputCanvas = this.app.canvas as HTMLCanvasElement;
  }

  hitTest(x: number, y: number) {
    const s = useSceneStore.getState();
    for (const item of compositionOrder(s.tracks, []).reverse()) {
      const rt = this.trackRTs.get(item.id); if (!rt?.container.visible || rt.container.alpha < .02) continue;
      for (const slot of [...rt.slots].reverse()) {
        if (!slot.root.visible || slot.root.alpha < .05) continue;
        const p = slot.sprite.toLocal(new PIXI.Point(x, y));
        if (Math.abs(p.x) <= slot.texW / 2 && Math.abs(p.y) <= slot.texH / 2) return item.id;
      }
    }
    return null;
  }
  selectionBounds(id: string) { const rt = this.trackRTs.get(id); if (!rt?.container.visible) return null; const b = rt.container.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }
  selectionFrame(id: string) {
    const rt = this.trackRTs.get(id), track = useSceneStore.getState().tracks.find(t => t.id === id);
    if (!rt?.container.visible || !track) return null;
    const b = rt.container.getLocalBounds();
    if (!(b.width > 0 && b.height > 0)) return null;
    const p = rt.container.toGlobal({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    return { cx: p.x, cy: p.y, width: b.width * track.transform.scale, height: b.height * track.transform.scale, rotation: track.transform.rotation };
  }

  // Deterministic capture: realize frame, render, read pixels as a JPEG data URL.
  // JPEG (q0.92) over PNG: ~5–10× smaller + far faster to encode at 2K/4K, and
  // the scene always paints a background so the missing alpha channel is moot.
  // ffmpeg re-encodes to h264/gif downstream, so there's no visible quality loss.
  captureFrame(frame: number): string {
    this.renderFrame(frame);
    return this.extractCanvas().toDataURL('image/jpeg', 0.92);
  }

  // Multiply the backing-store resolution for export capture. Logical
  // coordinates stay at store width/height, so template layout is untouched;
  // only the pixel density of the rendered output changes.
  setCaptureScale(k: number) {
    const { width, height } = useSceneStore.getState();
    this.resize(width, height, k);
  }

  extractCanvas(): HTMLCanvasElement {
    return this.outputCanvas ?? this.app.canvas as HTMLCanvasElement;
  }

  destroy() {
    this.gradientTexture?.destroy(true); this.gradientTexture = null;
    dropPixiFilters(new Set(), this.fxOwner);
    this.textCompositor.destroy();
    this.overlays.forEach((rt) => { rt.texture.destroy(true); rt.raster.destroy(); }); this.overlays.clear();
    this.ready = false;
    this.texturePromises.clear();
    this.videoEls.forEach((v) => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* noop */ } });
    this.videoEls.clear();
    this.croppedCache.forEach((texture) => texture.destroy(false));
    this.croppedCache.clear();
    this.textureCache.forEach((texture) => texture.destroy(true));
    this.textureCache.clear();
    this.previewImageTextures.forEach(texture=>texture?.destroy(true));this.previewImageTextures.clear();
    try { this.app.destroy(true, { children: true, texture: false }); } catch { /* noop */ }
  }
}
