// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import * as THREE from 'three';
import { makeBentPlaneGeometry, makeCurlPlaneGeometry, makeStickerRollGeometry, makeCornerPeelGeometry } from '@/three3d/cardMesh';
import { previewMatrix } from './templatePreviewGeometry';
import { BLEND_GLSL, blendIndex } from './blendModes';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getTemplate, layerCountFor } from '@/templates';
import { getEffect } from '@/effects';
import { threeMaterialsFor, applyThreeUniforms, dropThreeMaterials } from '@/effects/adapters/three';
import { useSceneStore } from '@/store/useSceneStore';
import { resolveEasing } from '@/lib/easing';
import { assetIndexForSlot, clamp, lerp } from '@/lib/motion';
import { loadImage, loadPreviewImage } from '@/lib/textureLoad';
import { TextCompositor, OverlayRaster } from '@/lib/textLayers';
import { isCanvasEditing } from './canvasEditing';
import { gradientFor, gradientCanvas } from './backgroundGradient';
import { compositionOrder } from '@/lib/composition';
import { cardAspectFor, coverCrop, cropKey } from '@/lib/crop';
import { advanceVideoForExport, createCardVideo, isVideoSource, prepareVideoForSequentialExport } from '@/lib/videoTexture';
import type { IRenderer } from '@/lib/rendererTypes';
import type { CameraPose, LayerTransform3D } from '@/lib/types';
import { resolveTrackTime, trackAssetIndices, type MotionTrack } from '@/lib/tracks';
import type { SceneState } from '@/store/useSceneStore';
import { placeholderFill, placeholderHex, placeholderLabel } from '@/lib/placeholderPalette';
import { previewResolution } from '@/lib/previewResolution';
import { reelVideoTime, syncReelVideo } from '@/lib/reelVideoClock';
import { setImageLighting } from '@/lib/imageLighting';
import { renderableTracks, renderableAssetUrls, exportImageUrls } from '@/lib/renderAssets';
import { cardOpacity } from '@/lib/cardOpacity';
import { modelPathOffset } from '@/lib/modelMotionPath';

// Shared with the Pixi renderer so control values read identically in px.
const SPRITE_BASE = 340;

export interface Slot3D {
  // Legacy alias retained while old single-track fallback code remains
  // unreachable below getFrameState's multicamera dispatch.
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  root: THREE.Group;
  front: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  back: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  body: THREE.Mesh<RoundedBoxGeometry, THREE.MeshStandardMaterial>;
  texW: number;
  texH: number;
  cornerR: number; // cached rounded-corner fraction (-1 = unset)
  bindKey: string;
  fitScale?: number;
}

interface TrackRT3D {
  scene: THREE.Scene;
  group: THREE.Group;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  target: THREE.WebGLRenderTarget;
  slots: Slot3D[];
  countSig: number;
  assetSig: string;
  active: boolean;
  opacity: number;
  blend: MotionTrack['blend'];
  keyLight: THREE.DirectionalLight;
  r3fManaged: boolean;
  r3fVersion: number;
}

// Rounded-rectangle alpha mask (white on black) for cornerRadius; cached by
// (fraction, aspect) so corners stay circular on non-square cards.
function makeCornerAlphaMap(fracR: number, aspect: number): THREE.CanvasTexture {
  const W = 512;
  const H = Math.max(2, Math.round(W / aspect));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  const r = (Math.min(W, H) / 2) * fracR;
  g.beginPath();
  g.roundRect(0, 0, W, H, r);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// Numbered placeholder card as a CanvasTexture (mirrors the Pixi placeholder).
function makePlaceholderTexture(index: number, aspect: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = Math.max(2,Math.round(600*Math.min(1,aspect))); c.height = Math.max(2,Math.round(600*Math.min(1,1/aspect)));
  const g = c.getContext('2d')!;
  g.fillStyle = placeholderHex(placeholderFill(index));
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = placeholderHex(placeholderLabel(index));
  g.font = '600 130px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(index + 1).padStart(2, '0'), c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Hybrid 2D/3D renderer. Every timeline track owns an isolated scene, camera,
// depth buffer and RGBA render target; a full-screen compositor then applies
// timeline order, opacity, fades and blend modes before the HUD/export pass.
export class SceneRenderer3D implements IRenderer {
  private exportingImages = false;
  private previewImageTextures = new Map<string, THREE.Texture | undefined>();
  private overlays = new Map<string, { raster: OverlayRaster; texture: THREE.CanvasTexture; mask?: THREE.CanvasTexture }>();
  private textCompositor = new TextCompositor();
  private outputCanvas: HTMLCanvasElement | null = null;
  onDirty?: () => void;   // preview loop hooks this to redraw once after async loads
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 1, 40000);
  private trackRTs = new Map<string, TrackRT3D>();
  private textureCache = new Map<string, THREE.Texture>();
  private texturePromises = new Map<string, Promise<THREE.Texture | null>>();
  private croppedCache = new Map<string, THREE.Texture>(); // cover-crop clones (repeat/offset) of cached bases
  private videoEls = new Map<string, HTMLVideoElement>();   // live <video> per url, for playback + cleanup
  private exportVideoFrames = new Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture }>();
  private placeholders = new Map<string, THREE.CanvasTexture>();
  private cornerMaps = new Map<string, THREE.CanvasTexture>();
  private gradientTex: THREE.CanvasTexture | null = null;
  private gradientSig = '';
  private backgroundTex: THREE.CanvasTexture | null = null;
  private backgroundSig = '';
  private backgroundGeneration = 0;
  private backgroundSource = '';
  // HUD overlay (logo + safe-area) rendered orthographically on top.
  private hud = new THREE.Scene();
  private hudCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  private logoMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  private logoUrl = '';
  private safeLine: THREE.LineLoop | null = null;
  private composeA!: THREE.WebGLRenderTarget;
  private composeB!: THREE.WebGLRenderTarget;
  private backdropTargets: [THREE.WebGLRenderTarget,THREE.WebGLRenderTarget]|null=null;
  private backdropMaterial: THREE.ShaderMaterial|null=null;
  private composeScene = new THREE.Scene();
  private readonly fxOwner = `${crypto.randomUUID()}/`;
  private composeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  private composeQuad!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private outputScene = new THREE.Scene();
  private outputQuad!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private cardPlaneGeometry = new THREE.PlaneGeometry(1, 1);
  private cardBodyGeometry = new RoundedBoxGeometry(1, 1, 1, 3, 0.055);
  private bentCardGeometries = new Map<string, THREE.BufferGeometry>();
  private resolution = 1;
  private r3f: import('@/lib/r3fSceneBridge').R3FSceneBridge | null = null;
  private width = 810;
  private height = 1080;
  ready = false;

  async init(canvas: HTMLCanvasElement) {
    const s = useSceneStore.getState();
    this.width = s.width;
    this.height = s.height;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // required for toDataURL export capture
      powerPreference: 'high-performance', // hint the browser to use the discrete GPU
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.resolution = previewResolution();
    this.renderer.setPixelRatio(this.resolution);
    this.renderer.setSize(this.width, this.height, false);
    const { R3FSceneBridge } = await import('@/lib/r3fSceneBridge');
    this.r3f = new R3FSceneBridge();
    await this.r3f.init(canvas, this.renderer, this.scene, this.camera, this.width, this.height);
    this.createCompositor();
    this.ready = true;
    this.syncAssets();
  }

  resize(width: number, height: number, resolution = previewResolution()) {
    if (!this.ready) return;
    // WebGL texture storage is immutable after its first upload. Resizing a
    // CanvasTexture's canvas alone uploads into the old allocation, shifting
    // text and its blur mask during high-resolution export. Recreate both.
    this.overlays.forEach(rt=>{rt.texture.dispose();rt.mask?.dispose();rt.raster.destroy();});
    this.overlays.clear();
    this.width = width;
    this.height = height;
    this.resolution = resolution;
    this.renderer.setPixelRatio(resolution);
    this.renderer.setSize(width, height, false);
    // R3F is only the Box scene-graph reconciler. It must never own the CSS
    // size of this canvas, otherwise a later Aspect change updates pixels but
    // leaves the visible frame pinned to the initial dimensions.
    this.renderer.domElement.style.removeProperty('width');
    this.renderer.domElement.style.removeProperty('height');
    const rw = Math.max(1, Math.round(width * resolution));
    const rh = Math.max(1, Math.round(height * resolution));
    this.composeA?.setSize(rw, rh);
    this.composeB?.setSize(rw, rh);
    this.backdropTargets?.forEach(target=>target.setSize(Math.max(1,Math.round(rw/4)),Math.max(1,Math.round(rh/4))));
    this.trackRTs.forEach((rt) => rt.target.setSize(rw, rh));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setCaptureScale(k: number) {
    const { width, height } = useSceneStore.getState();
    this.resize(width, height, k);
  }

  // Map the house `perspective` control (0–200) onto the camera: low values =
  // long lens (near-ortho), high = wide-angle. Camera distance keeps the z=0
  // plane at exact preview-pixel scale for any fov.
  private updateTrackCamera(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, perspective: number, pose?: CameraPose) {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.left = -this.width / 2;
      camera.right = this.width / 2;
      camera.top = this.height / 2;
      camera.bottom = -this.height / 2;
      camera.near = -20000;
      camera.far = 20000;
      camera.position.set(0, 0, 1000);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      return;
    }
    const fov = pose?.fov ?? lerp(15, 95, clamp(perspective, 0, 200) / 200);
    camera.fov = fov;
    camera.aspect = this.width / this.height;
    const D = (this.height / 2) / Math.tan((fov * Math.PI) / 360);
    // `distance` is a multiplier on D, not a replacement for it — the same
    // "camDistance, 1.0 = default fit" convention three3d/animations.ts uses.
    // Below 1 moves the camera physically closer (the subject fills more of
    // the frame at the SAME fov, so the keystone/perspective feel is
    // unchanged — a different move than widening the lens). Templates that
    // set an explicit `position` bypass this entirely, same as before.
    const position = pose?.position ?? { x: 0, y: 0, z: D * (pose?.distance ?? 1) };
    const target = pose?.target ?? { x: 0, y: 0, z: 0 };
    camera.position.set(position.x, -position.y, position.z);
    camera.lookAt(target.x, -target.y, target.z);
    camera.near = pose?.near ?? 0.1;
    camera.far = pose?.far ?? Math.max(D * 8, Math.abs(position.z) * 8);
    camera.updateProjectionMatrix();
  }

  private makeTarget(depthBuffer: boolean) {
    const target = new THREE.WebGLRenderTarget(
      Math.max(1, Math.round(this.width * this.resolution)),
      Math.max(1, Math.round(this.height * this.resolution)),
      { depthBuffer, stencilBuffer: false },
    );
    target.texture.minFilter = THREE.LinearFilter;
    target.texture.magFilter = THREE.LinearFilter;
    target.texture.generateMipmaps = false;
    return target;
  }

  private createCompositor() {
    this.composeA = this.makeTarget(false);
    this.composeB = this.makeTarget(false);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const composeMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        baseMap: { value: null },
        layerMap: { value: null },
        opacity: { value: 1 },
        blendMode: { value: 0 },
        backdropMap: {value:null},
        blurredMap: {value:null},
        backdropBlur: {value:0},
        sceneSize: {value:new THREE.Vector2(1,1)},
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `
        uniform sampler2D baseMap;
        uniform sampler2D layerMap;
        uniform float opacity;
        uniform int blendMode;
        uniform sampler2D backdropMap;
        uniform sampler2D blurredMap;
        uniform float backdropBlur;
        uniform vec2 sceneSize;
        varying vec2 vUv;
        ${BLEND_GLSL}
        void main(){
          vec4 base = texture2D(baseMap, vUv);
          // Read the accumulator BEFORE this layer. Blur only the rounded
          // background mask, leaving glyphs and everything outside it sharp.
          float mask = backdropBlur > 0.0 ? texture2D(backdropMap,vUv).a : 0.0;
          if(mask>0.0001){
            base.rgb=mix(base.rgb,texture2D(blurredMap,vUv).rgb,clamp(mask,0.0,1.0));
          }
          vec4 layer = texture2D(layerMap, vUv);
          float a = clamp(layer.a * opacity, 0.0, 1.0);
          vec3 straight = layer.a > 0.00001 ? layer.rgb / layer.a : vec3(0.0);
          vec3 blend = clamp(rpBlend(blendMode, base.rgb, clamp(straight, 0.0, 1.0)), 0.0, 1.0);
          gl_FragColor = vec4(mix(base.rgb, blend, a), 1.0);
        }
      `,
    });
    this.composeQuad = new THREE.Mesh(geometry, composeMaterial);
    this.composeScene.add(this.composeQuad);

    const outputMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        map: { value: null },
        resolution: { value: new THREE.Vector2(this.width, this.height) },
        pixelSize: { value: 1 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `
        uniform sampler2D map;
        uniform vec2 resolution;
        uniform float pixelSize;
        varying vec2 vUv;
        void main(){
          vec2 size = max(vec2(1.0), vec2(pixelSize));
          vec2 uv = (floor(vUv * resolution / size) + 0.5) * size / resolution;
          gl_FragColor = texture2D(map, uv);
          #include <colorspace_fragment>
        }
      `,
    });
    this.outputQuad = new THREE.Mesh(geometry.clone(), outputMaterial);
    this.outputScene.add(this.outputQuad);
  }

  // Cover-fit via UV window (repeat/offset) on a clone sharing the decoded
  // image — mirrors the Pixi renderer's frame-cropped texture views.
  private backdropTexture(source: THREE.Texture, radius: number) {
    // Separable Gaussian at quarter resolution: dense samples without the
    // ghosted copies of a sparse 2D kernel. Targets/material are reused.
    if(!this.backdropTargets){
      this.backdropTargets=[this.makeTarget(false),this.makeTarget(false)];
      this.backdropTargets.forEach(target=>target.setSize(Math.max(1,Math.round(this.width*this.resolution/4)),Math.max(1,Math.round(this.height*this.resolution/4))));
    }
    this.backdropMaterial??=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
      uniforms:{map:{value:null},direction:{value:new THREE.Vector2()},radius:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`uniform sampler2D map;uniform vec2 direction;uniform float radius;varying vec2 vUv;
      void main(){vec3 sum=texture2D(map,vUv).rgb;float total=1.0;
        for(int i=1;i<=8;i++){float n=float(i)/8.0;float weight=exp(-n*n*2.0);vec2 d=direction*radius*n;
          sum+=(texture2D(map,clamp(vUv+d,vec2(0.0),vec2(1.0))).rgb+texture2D(map,clamp(vUv-d,vec2(0.0),vec2(1.0))).rgb)*weight;total+=2.0*weight;}
        gl_FragColor=vec4(sum/total,1.0);}`});
    const previous=this.composeQuad.material,material=this.backdropMaterial;
    try{
      this.composeQuad.material=material;material.uniforms.radius.value=radius;
      for(let i=0;i<2;i++){
        material.uniforms.map.value=i===0?source:this.backdropTargets[0].texture;
        material.uniforms.direction.value.set(i===0?1/this.width:0,i===1?1/this.height:0);
        this.renderer.setRenderTarget(this.backdropTargets[i]);this.renderer.clear(true,false,false);this.renderer.render(this.composeScene,this.composeCam);
      }
    }finally{this.composeQuad.material=previous;}
    return this.backdropTargets[1].texture;
  }

  private croppedView(url: string, base: THREE.Texture, aspect: number, crop?: { x: number; y: number }): { tex: THREE.Texture; fw: number; fh: number } {
    const img = base.image as HTMLImageElement;
    const { fx, fy, fw, fh } = coverCrop(img.width, img.height, aspect, crop);
    const key = cropKey(url, aspect, crop);
    let tex = this.croppedCache.get(key);
    if (!tex) {
      tex = base.clone();
      tex.repeat.set(fw / img.width, fh / img.height);
      tex.offset.set(fx / img.width, 1 - (fy + fh) / img.height); // three's V origin is bottom
      tex.needsUpdate = true;
      this.croppedCache.set(key, tex);
    }
    return { tex, fw, fh };
  }

  private loadTexture(url: string): Promise<THREE.Texture | null> {
    const cached = this.textureCache.get(url);
    if (cached) return Promise.resolve(cached);
    const pending = this.texturePromises.get(url);
    if (pending) return pending;
    const promise = loadPreviewImage(url)
      .then((img) => {
        if (!img || !this.ready) return null;
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        // Every card can end up viewed near edge-on — a Card Tunnel wall close to
        // the vanishing point, a Surface curve's far edge, any face turned away
        // in Box or Orbit. Mipmapping alone still aliases badly at a grazing
        // angle because it picks ONE isotropic mip level for a footprint that is
        // actually long and thin; anisotropic filtering samples along that
        // footprint instead, which is what removes the fine horizontal banding
        // those views showed. Applied once here because cropped views (below)
        // are `.clone()`d from this texture and inherit it.
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        tex.needsUpdate = true;
        this.textureCache.set(url, tex);
        return tex;
      })
      .finally(() => { this.texturePromises.delete(url); });
    this.texturePromises.set(url, promise);
    return promise;
  }

  syncAssets() {
    if (!this.ready) return;
    const s = useSceneStore.getState();
    const tracks=renderableTracks(s);
    for (const [id, rt] of this.trackRTs) {
      if (!tracks.some((track) => track.id === id)) {
        this.r3f?.remove(id);
        this.destroyTrack(rt);
        this.trackRTs.delete(id);
      }
    }
    tracks.forEach((track) => {
      let rt = this.trackRTs.get(track.id);
      if (!rt) {
        const scene = new THREE.Scene();
        const group = new THREE.Group();
        scene.add(group);
        const hemi = new THREE.HemisphereLight(0xffffff, 0x202028, 1.65);
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
        keyLight.position.set(-420, 560, 900);
        keyLight.castShadow = true;
        keyLight.shadow.bias = -0.00025;
        keyLight.shadow.normalBias = 0.025;
        keyLight.shadow.camera.near = 10;
        keyLight.shadow.camera.far = 5000;
        keyLight.shadow.camera.left = -1400;
        keyLight.shadow.camera.right = 1400;
        keyLight.shadow.camera.top = 1400;
        keyLight.shadow.camera.bottom = -1400;
        scene.add(hemi, keyLight, keyLight.target);
        const is3d = getTemplate(track.templateId).meta.engine === 'webgl';
        rt = {
          scene, group,
          camera: is3d ? new THREE.PerspectiveCamera(50, 1, 1, 40000) : new THREE.OrthographicCamera(),
          target: this.makeTarget(true),
          slots: [], countSig: -1, assetSig: '', active: false, opacity: 1, blend: 'normal', keyLight,
          r3fManaged: false,
          r3fVersion: 0,
        };
        this.trackRTs.set(track.id, rt);
      }
      const is3d = getTemplate(track.templateId).meta.engine === 'webgl';
      if (is3d !== (rt.camera instanceof THREE.PerspectiveCamera)) {
        rt.camera = is3d ? new THREE.PerspectiveCamera(50, 1, 1, 40000) : new THREE.OrthographicCamera();
      }
      this.syncTrackSlots(track, rt, s);
    });
    const used = renderableAssetUrls(s);
    if(this.placeholders.size>96){
      const live=new Set([...this.trackRTs.values()].flatMap(rt=>rt.slots.map(slot=>slot.front.material.map)));
      for(const [key,texture] of this.placeholders){if(this.placeholders.size<=96)break;if(!live.has(texture)){texture.dispose();this.placeholders.delete(key);}}
    }
    for (const [key, texture] of this.croppedCache) {
      if (!used.has(key.split('|')[0])) { texture.dispose(); this.croppedCache.delete(key); }
    }
    for (const [url, texture] of this.textureCache) {
      if (!used.has(url)) { texture.dispose(); this.textureCache.delete(url); }
    }
    for (const [url, video] of this.videoEls) {
      if (!used.has(url)) { video.pause(); video.removeAttribute('src'); video.load(); this.videoEls.delete(url); }
    }
    if (this.croppedCache.size > 128) {
      const live = new Set([...this.trackRTs.values()].flatMap((track) => track.slots.map((slot) => slot.front.material.map)));
      for (const [key, texture] of this.croppedCache) {
        if (this.croppedCache.size <= 128) break;
        if (!live.has(texture)) { texture.dispose(); this.croppedCache.delete(key); }
      }
    }
  }

  private syncTrackSlots(track: MotionTrack, rt: TrackRT3D, s: SceneState) {
    const count = layerCountFor(track.templateId, track.values, s);
    const template = getTemplate(track.templateId);
    const meta = template.meta;
    const r3fManaged = meta.id.startsWith('box-');
    const repeat = meta.repeatAssets === true;
    const defaultAspect = cardAspectFor(meta, s.width, s.height, s.cardShape);
    const slotAspects = Array.from({ length: count }, (_, i) =>
      template.slotAspect?.(i, track.values, s.width, s.height) ?? defaultAspect);
    const pool = trackAssetIndices(track, s.assets, repeat).map((i) => s.assets[i]).filter(Boolean);
    const assetSig = pool.map((a) => a.crop?.zoom ?? 1).join(',') + (repeat ? 'R|' : '') + 'A' + slotAspects.map((a) => a.toFixed(4)).join(',') + '|' +
      pool.map((a) => a.id + ':' + a.url + ':' + a.visible + ':' + (a.fit ?? 'fill') + ':' + (a.crop ? a.crop.x + ',' + a.crop.y : 'c')).join('|');
    if (!rt.r3fManaged && r3fManaged) {
      // Entering the R3F-managed Box from another WebGL template keeps the
      // same renderer and track runtime. Remove the previous native meshes
      // before mounting the portal, otherwise both effects remain in the
      // scene and look like duplicated/glitching images behind the box.
      rt.slots.forEach((slot) => {
        rt.group.remove(slot.root);
        slot.front.material.dispose();
        slot.back.material.dispose();
        slot.body.material.dispose();
      });
      rt.slots = [];
      rt.countSig = -1;
      rt.assetSig = '';
    }
    if (rt.r3fManaged && !r3fManaged) {
      rt.r3fVersion++;
      this.r3f?.remove(track.id);
      rt.slots = [];
      rt.countSig = -1;
    }
    rt.r3fManaged = r3fManaged;
    if (r3fManaged && count !== rt.countSig) {
      const version = ++rt.r3fVersion;
      const slots: Array<Slot3D | undefined> = new Array(count);
      this.r3f?.upsertBox({
        id: track.id,
        container: rt.group,
        count,
        planeGeometry: this.cardPlaneGeometry,
        bodyGeometry: this.cardBodyGeometry,
        register: (index, slot) => {
          if (rt.r3fVersion !== version || !rt.r3fManaged) return;
          slots[index] = slot ?? undefined;
          rt.slots = slots.filter((item): item is Slot3D => Boolean(item));
          // The first React commit can happen after this sync pass. Force the
          // next pass to bind textures to the newly materialized cards.
          queueMicrotask(() => {
            if (rt.r3fVersion !== version || !slot) return;
            rt.assetSig = '';
            this.onDirty?.();
          });
        },
      });
    }
    if (count === rt.countSig && assetSig === rt.assetSig) return;
    rt.countSig = count;
    rt.assetSig = assetSig;
    const shadowSize = count <= 24 ? 1024 : 512;
    rt.keyLight.shadow.mapSize.set(shadowSize, shadowSize);
    rt.keyLight.shadow.map?.dispose();

    while (!r3fManaged && rt.slots.length < count) {
      const frontMaterial = new THREE.MeshStandardMaterial({
        transparent: true,
        alphaTest: .001,
        roughness: 0.82,
        metalness: 0,
        emissive: 0xffffff,
        emissiveIntensity: 0.28,
        depthWrite: true,
        side: THREE.DoubleSide,
      });
      const backMaterial = new THREE.MeshStandardMaterial({ color: 0x17171b, roughness: 0.9, metalness: 0, transparent: true });
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.88, metalness: 0, transparent: true });
      const root = new THREE.Group();
      const body = new THREE.Mesh(this.cardBodyGeometry, bodyMaterial);
      const front = new THREE.Mesh(this.cardPlaneGeometry, frontMaterial);
      const back = new THREE.Mesh(this.cardPlaneGeometry, backMaterial);
      front.position.z = 0.501;
      back.position.z = -0.501;
      back.rotation.y = Math.PI;
      front.castShadow = front.receiveShadow = true;
      back.castShadow = back.receiveShadow = true;
      body.castShadow = body.receiveShadow = true;
      root.add(body, front, back);
      rt.group.add(root);
      rt.slots.push({ mesh: front, root, front, back, body, texW: 480, texH: 600, cornerR: -1, bindKey: '' });
    }
    while (!r3fManaged && rt.slots.length > count) {
      const slot = rt.slots.pop()!;
      rt.group.remove(slot.root);
      slot.front.material.dispose();
      slot.back.material.dispose();
      slot.body.material.dispose();
    }

    rt.slots.forEach((slot, i) => {
      const aspect = slotAspects[i] ?? defaultAspect;
      const placeholderLongEdge = 600;
      const placeholderW = placeholderLongEdge * Math.min(1, aspect);
      const placeholderH = placeholderLongEdge * Math.min(1, 1 / aspect);
      let asset = pool[assetIndexForSlot(i, pool.length, repeat)];
      if (!asset && pool.length > 0) asset = pool[i % pool.length];
      const binding = `${asset?.crop?.zoom ?? 1}|` + (asset
        ? `${asset.id}|${asset.url}|${aspect.toFixed(4)}|${asset.fit ?? 'fill'}|${asset.crop?.x ?? 0.5},${asset.crop?.y ?? 0.5}`
        : `placeholder|${i}`);
      const bindingChanged = slot.bindKey !== binding;
      slot.bindKey = binding;
      slot.fitScale = 1;
      if (bindingChanged) {
        // Never keep the previous slot's image visible while a new async
        // image/video is loading. A numbered placeholder is deterministic and
        // is replaced immediately when a cached source is available.
        let ph = this.placeholders.get(`${i}|${aspect.toFixed(4)}`);
        if (!ph) { ph = makePlaceholderTexture(i,aspect); this.placeholders.set(`${i}|${aspect.toFixed(4)}`, ph); }
        slot.front.material.map = ph;
        slot.front.material.emissiveMap = ph;
        slot.front.material.needsUpdate = true;
        // Keep the temporary plane at the newly selected shape. Using the old
        // fixed 4:5 dimensions here produced one visibly open/deformed Box
        // frame while the cropped texture was being rebuilt.
        slot.texW = placeholderW;
        slot.texH = placeholderH;
        slot.cornerR = -1;
      }
      if (!asset || !asset.visible || asset.origin === 'demo') {
        let ph = this.placeholders.get(`${i}|${aspect.toFixed(4)}`);
        if (!ph) { ph = makePlaceholderTexture(i,aspect); this.placeholders.set(`${i}|${aspect.toFixed(4)}`, ph); }
        slot.front.material.map = ph;
        slot.front.material.emissiveMap = ph;
        slot.front.material.needsUpdate = true;
        slot.texW = placeholderW; slot.texH = placeholderH;
      } else if (isVideoSource(asset.url, asset.kind)) {
        const { url, crop } = asset;
        const fit = asset.fit ?? 'fill';
        const frozen = this.exportVideoFrames.get(url);
        if (frozen) {
          const img = frozen.texture.image as HTMLCanvasElement;
          if (fit === 'fit') slot.fitScale = Math.min(placeholderW / img.width, placeholderH / img.height) * Math.max(img.width, img.height) / 600;
          const cropped = fit === 'fill' ? this.croppedView(url, frozen.texture, aspect, crop) : null;
          const tex = cropped?.tex ?? frozen.texture;
          slot.front.material.map = tex;
          slot.front.material.emissiveMap = tex;
          slot.front.material.needsUpdate = true;
          slot.texW = fit === 'fit' ? img.width : fit === 'stretch' ? placeholderW : cropped!.fw;
          slot.texH = fit === 'fit' ? img.height : fit === 'stretch' ? placeholderH : cropped!.fh;
          slot.cornerR = -1;
          return;
        }
        // Live video card: cover-crop via a per-(url,crop) VideoTexture that
        // wraps a shared <video>. A dedicated VideoTexture (not a clone) keeps
        // three's auto-update (requestVideoFrameCallback) working per slot.
        let video = this.videoEls.get(url);
        if (!video) {
          video = createCardVideo(url);
          this.videoEls.set(url, video);
          video.play().catch(() => { /* autoplay blocked — first frame only */ });
        }
        const applyVid = (v: HTMLVideoElement) => {
          if (slot.bindKey !== binding) return;
          const vw = v.videoWidth, vh = v.videoHeight;
          if (!vw || !vh || !this.ready) return;
          if (fit === 'fit') slot.fitScale = Math.min(placeholderW / vw, placeholderH / vh) * Math.max(vw, vh) / 600;
          const { fx, fy, fw, fh } = coverCrop(vw, vh, aspect, crop);
          const key = `${cropKey(url, aspect, crop)}|${fit}`;
          let tex = this.croppedCache.get(key);
          if (!tex) {
            const vt = new THREE.VideoTexture(v);
            vt.colorSpace = THREE.SRGBColorSpace;
            if (fit === 'fill') {
              vt.repeat.set(fw / vw, fh / vh);
              vt.offset.set(fx / vw, 1 - (fy + fh) / vh); // three's V origin is bottom
            }
            tex = vt;
            this.croppedCache.set(key, tex);
          }
          slot.front.material.map = tex;
          slot.front.material.emissiveMap = tex;
          slot.front.material.needsUpdate = true;
          slot.texW = fit === 'fit' ? vw : fit === 'stretch' ? placeholderW : fw;
          slot.texH = fit === 'fit' ? vh : fit === 'stretch' ? placeholderH : fh;
          slot.cornerR = -1; // aspect changed → rebuild the corner mask
          this.onDirty?.();
        };
        if (video.videoWidth) applyVid(video);
        else video.addEventListener('loadeddata', () => applyVid(video!), { once: true });
      } else {
        const { url, crop } = asset;
        const fit = asset.fit ?? 'fill';
        const applyCropped = (base: THREE.Texture) => {
          if (slot.bindKey !== binding) return;
          const img = base.image as HTMLImageElement;
          if (fit === 'fit') slot.fitScale = Math.min(placeholderW / img.width, placeholderH / img.height) * Math.max(img.width, img.height) / 600;
          const cropped = fit === 'fill' ? this.croppedView(url, base, aspect, crop) : null;
          const tex = cropped?.tex ?? base;
          slot.front.material.map = tex;
          slot.front.material.emissiveMap = tex;
          slot.front.material.needsUpdate = true;
          slot.texW = fit === 'fit' ? img.width : fit === 'stretch' ? placeholderW : cropped!.fw;
          slot.texH = fit === 'fit' ? img.height : fit === 'stretch' ? placeholderH : cropped!.fh;
          slot.cornerR = -1; // aspect changed → rebuild the corner mask
          this.onDirty?.();
        };
        this.loadTexture(url).then((tex) => {
          if (!tex || tex !== this.textureCache.get(url) || !this.ready || slot.bindKey !== binding) return;
          applyCropped(tex);
        });
      }
      if (bindingChanged) slot.cornerR = -1;
    });
  }

  private invalidateTracks() {
    this.trackRTs.forEach((rt) => { rt.countSig = -1; rt.assetSig = ''; });
  }

  private destroyTrack(rt: TrackRT3D) {
    rt.slots.forEach((slot) => {
      slot.bindKey='';
      rt.group.remove(slot.root);
      if (!rt.r3fManaged) {
        slot.front.material.dispose();
        slot.back.material.dispose();
        slot.body.material.dispose();
      }
    });
    rt.slots = [];
    rt.target.dispose();
  }

  // Rounded corners via a cached alpha mask (Pixi uses a stencil mask).
  private applyCorner(slot: Slot3D, cornerRadiusPct: number) {
    const fracR = clamp(cornerRadiusPct / 100, 0, 1);
    if (slot.cornerR === fracR) return;
    slot.cornerR = fracR;
    if (fracR === 0) {
      slot.front.material.alphaMap = null;
      slot.front.material.needsUpdate = true;
      return;
    }
    const aspect = slot.texW / slot.texH;
    const key = `${fracR.toFixed(2)}|${aspect.toFixed(2)}`;
    let map = this.cornerMaps.get(key);
    if (!map) { map = makeCornerAlphaMap(fracR, aspect); this.cornerMaps.set(key, map); }
    slot.front.material.alphaMap = map;
    slot.front.material.needsUpdate = true;
  }

  // Backdrop + HUD (logo, safe-area) sync from the store.
  private syncScenery() {
    const s = useSceneStore.getState();

    // Leaving an image/reflected background invalidates any decode still in
    // flight. Without this guard an older async load can finish after a model
    // switch and paint itself behind the new scene.
    if (this.backgroundSource !== s.background.source) {
      this.backgroundSource = s.background.source;
      this.backgroundGeneration++;
    }

    // Background parity with Pixi: solid, gradient, uploaded image, or an
    // asset reflected from the active motion layer.
    if (s.background.source === 'color' && s.background.gradient) {
      const spec = gradientFor(s.background), sig = JSON.stringify([spec,s.width,s.height]);
      if (this.gradientSig !== sig) {
        this.gradientTex?.dispose();
        this.gradientTex = new THREE.CanvasTexture(gradientCanvas(spec,s.width,s.height));
        this.gradientTex.colorSpace = THREE.SRGBColorSpace;
        this.gradientSig = sig;
      }
      this.scene.background = this.gradientTex;
    } else if (s.background.source === 'image' && s.background.imageUrl) {
      this.syncBackgroundTexture(s.background.imageUrl, s.background.blur);
    } else if (s.background.source === 'card') {
      const active = s.tracks.find((track) => track.id === s.activeTrackId) ?? s.tracks.find((track) => track.visible);
      const assetIndex = active ? trackAssetIndices(active, s.assets, getTemplate(active.templateId).meta.repeatAssets === true)[0] : undefined;
      const url = assetIndex === undefined ? null : s.assets[assetIndex]?.url;
      if (url && !isVideoSource(url, s.assets[assetIndex!]?.kind)) this.syncBackgroundTexture(url, s.background.blur);
      else this.scene.background = new THREE.Color(s.background.color);
    } else {
      this.scene.background = new THREE.Color(s.background.color);
    }

    // HUD ortho camera matches the logical canvas (y up; positions flipped)
    this.hudCam.left = -this.width / 2;
    this.hudCam.right = this.width / 2;
    this.hudCam.top = this.height / 2;
    this.hudCam.bottom = -this.height / 2;
    this.hudCam.updateProjectionMatrix();

    // safe-area guide (5% inset, cyan) — mirrors the Pixi overlay
    if (s.safeArea) {
      if (!this.safeLine) {
        const geo = new THREE.BufferGeometry();
        const mat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6 });
        this.safeLine = new THREE.LineLoop(geo, mat);
        this.hud.add(this.safeLine);
      }
      const mx = this.width * 0.05, my = this.height * 0.05;
      const w2 = this.width / 2 - mx, h2 = this.height / 2 - my;
      this.safeLine.geometry.setFromPoints([
        new THREE.Vector3(-w2, -h2, 0), new THREE.Vector3(w2, -h2, 0),
        new THREE.Vector3(w2, h2, 0), new THREE.Vector3(-w2, h2, 0),
      ]);
      this.safeLine.visible = true;
    } else if (this.safeLine) {
      this.safeLine.visible = false;
    }

    // logo overlay in the chosen corner
    if (s.logo.url) {
      if (!this.logoMesh) {
        this.logoMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false })
        );
        this.hud.add(this.logoMesh);
      }
      if (this.logoUrl !== s.logo.url) {
        this.logoUrl = s.logo.url;
        loadImage(s.logo.url).then((img) => {
          if (!img || !this.ready || !this.logoMesh) return;
          const tex = new THREE.Texture(img);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          this.logoMesh.material.map = tex;
          this.logoMesh.material.needsUpdate = true;
          this.logoMesh.userData.aspect = img.width / img.height;
          this.onDirty?.();
        });
      }
      const aspect: number = this.logoMesh.userData.aspect ?? 1;
      const size = s.logo.size;
      const w = aspect >= 1 ? size : size * aspect;
      const h = aspect >= 1 ? size / aspect : size;
      const pad = 24;
      const px = s.logo.position.includes('r') ? this.width / 2 - pad - w / 2 : -this.width / 2 + pad + w / 2;
      const py = s.logo.position.startsWith('t') ? this.height / 2 - pad - h / 2 : -this.height / 2 + pad + h / 2;
      this.logoMesh.position.set(px, py, 0);
      this.logoMesh.scale.set(w, h, 1);
      this.logoMesh.visible = !!this.logoMesh.material.map;
    } else if (this.logoMesh) {
      this.logoMesh.visible = false;
    }
  }

  getFrameState(frame: number) {
    if (!this.ready) return;
    const s = useSceneStore.getState();
    this.syncAssets();
    // live loop/hold behaviour follows the scene setting
    this.videoEls.forEach((v, url) => {
      v.loop = s.videoEnd !== 'hold';
      if (!this.exportVideoFrames.size) syncReelVideo(v, reelVideoTime(s, url, frame), s, this.onDirty);
    });
    this.syncScenery();

    const sceneTotal = Math.max(1, Math.round(s.duration * s.fps));
    s.tracks.forEach((motionTrack) => {
      const runtime = this.trackRTs.get(motionTrack.id);
      if (!runtime) return;
      if (!motionTrack.visible || (s.compositeMode === 'single' && motionTrack.id !== s.activeTrackId)) {
        runtime.active = false;
        runtime.group.visible = false;
        return;
      }
      this.updateTrackState(motionTrack, runtime, frame, sceneTotal, s);
    });
    return;

    const track = s.tracks.find((item) => item.id === s.activeTrackId) ?? s.tracks[0];
    if (!track) return;
    const rt = this.trackRTs.get(track.id);
    if (!rt) return;
    this.updateTrackCamera(rt!.camera, Number(track.values.perspective ?? 100));

    const template = getTemplate(track.templateId);
    const count = rt!.slots.length;
    const ease = resolveEasing(track.easing);
    const easedPhase = (phase: number) => {
      const base = Math.floor(phase);
      return base + ease(phase - base);
    };
    const ctx = {
      fps: s.fps, width: s.width, height: s.height,
      duration: s.duration,
      totalFrames: Math.max(1, Math.round(s.duration * s.fps)),
      ease, easedPhase,
    };

    for (let i = 0; i < count; i++) {
      const slot = rt!.slots[i];
      const norm = SPRITE_BASE / Math.max(slot.texW, slot.texH) * (slot.fitScale ?? 1);
      this.applyCorner(slot, Number(track.values.cornerRadius ?? 0));
      if (template.transform3d) {
        const t = template.transform3d!(frame, i, count, track.values, ctx);
        slot.mesh.position.set(t.x, -t.y, t.z); // canvas y-down → three y-up
        slot.mesh.rotation.set(t.rotationX ?? 0, t.rotationY ?? 0, t.rotationZ ?? 0);
        slot.mesh.scale.set(slot.texW * norm * t.scale, slot.texH * norm * t.scale, 1);
        slot.mesh.material.opacity = t.alpha;
        // A fully opaque plane writes depth, so it genuinely OCCLUDES what sits
        // behind it. The material is created with depthWrite: false — correct for
        // blended planes, since a translucent card must not mask its neighbours —
        // but with it off nothing ever occludes anything, and a closed solid (the
        // Box family's prism) has no way to hide its own far side. Gating on full
        // opacity gives real occlusion where it is unambiguous and keeps correct
        // blending everywhere else.
        slot.mesh.material.depthWrite = t.alpha > 0.995;
        slot.mesh.visible = t.alpha > 0.001 && t.scale > 0.0001;
      } else {
        // fallback: project the 2D transform onto the z=0 plane
        const t = template.transform(frame, i, count, track.values, ctx);
        slot.mesh.position.set(t.x, -t.y, t.depth);
        slot.mesh.rotation.set(0, 0, -t.rotation);
        slot.mesh.scale.set(slot.texW * norm * t.scale * (t.scaleX ?? 1), slot.texH * norm * t.scale * (t.scaleY ?? 1), 1);
        slot.mesh.material.opacity = t.alpha;
        slot.mesh.visible = t.alpha > 0.001 && t.scale > 0.0001;
      }
    }
  }

  private syncBackgroundTexture(url: string, blur: number) {
    const sig = `${url}|${this.width}x${this.height}|${Math.max(0, blur)}`;
    if (sig === this.backgroundSig) {
      if (this.backgroundTex) this.scene.background = this.backgroundTex;
      return;
    }
    this.backgroundSig = sig;
    const generation = ++this.backgroundGeneration;
    loadImage(url).then((img) => {
      if (!img || !this.ready || generation !== this.backgroundGeneration) return;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, this.width);
      canvas.height = Math.max(2, this.height);
      const g = canvas.getContext('2d');
      if (!g) return;
      const cover = Math.max(canvas.width / img.width, canvas.height / img.height) * 1.08;
      const w = img.width * cover;
      const h = img.height * cover;
      g.filter = blur > 0 ? `blur(${Math.max(0, blur)}px)` : 'none';
      g.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.backgroundTex?.dispose();
      this.backgroundTex = texture;
      this.scene.background = texture;
      this.onDirty?.();
    });
  }

  private applyPhysicalPose(slot: Slot3D, t: LayerTransform3D, norm: number, imageLighting = false, autoTransparency = false) {
    const alpha = cardOpacity(t.alpha, autoTransparency, t.solidAlpha);
    const thickness = Math.max(0, t.thickness ?? 0);
    const bend = clamp(t.bend ?? 0, -0.45, 0.45);
    const bent = Math.abs(bend) > 0.0001;
    const curl = clamp(t.curl ?? 0, -Math.PI * 2.4, Math.PI * 2.4);
    const curled = Math.abs(curl) > 0.001;
    const cornerPeel = clamp(t.cornerPeel ?? 0, 0, 1);
    const peeling = cornerPeel > 0.0001;
    const stickerRolling = Number.isFinite(t.stickerPeelFront)
      && Number.isFinite(t.stickerCurlRadius)
      && (t.stickerCurlRadius ?? 0) > 0;
    const peelSoftness = clamp(t.peelSoftness ?? 0, 0, 1);
    const physical = thickness > 0.05 && !bent && !curled && !peeling && !stickerRolling;
    // A flat, double-sided card needs one raster pass. Three's default two-pass
    // transparency path doubles draw calls without improving a single plane.
    const singlePass = !physical && !bent && !curled && !peeling && !stickerRolling;
    if(slot.front.material.forceSinglePass!==singlePass) { slot.front.material.forceSinglePass=singlePass;slot.front.material.needsUpdate=true; }
    const exposure = clamp(t.materialExposure ?? 1, 0.25, 2.5);
    const shadow = (t.shadowStrength ?? 0) > 0.02;

    slot.root.matrixAutoUpdate = true;
    slot.front.renderOrder=slot.back.renderOrder=slot.body.renderOrder=0;
    slot.root.position.set(t.x, -t.y, t.z);
    if (t.quaternion) {
      slot.root.quaternion.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w).normalize();
    } else {
      slot.root.rotation.set(t.rotationX ?? 0, t.rotationY ?? 0, t.rotationZ ?? 0);
    }
    slot.root.scale.set(
      slot.texW * norm * t.scale,
      slot.texH * norm * t.scale,
      (bent || curled || peeling || stickerRolling) ? slot.texW * norm * t.scale : physical ? thickness : 1,
    );
    if (stickerRolling) {
      const quantizedFront = Math.round((t.stickerPeelFront ?? 0) * 180) / 180;
      const quantizedRadius = Math.round((t.stickerCurlRadius ?? 0.15) * 180) / 180;
      const quantizedDirection = Math.round((t.peelDirection ?? 50) * 2) / 2;
      const aspect=slot.texW/Math.max(.0001,slot.texH);
      const key = `sticker-roll:${quantizedFront.toFixed(4)}:${quantizedRadius.toFixed(4)}:${quantizedDirection.toFixed(1)}:${aspect.toFixed(6)}`;
      let geometry = this.bentCardGeometries.get(key);
      if (!geometry) {
        geometry = makeStickerRollGeometry(quantizedFront, quantizedRadius, quantizedDirection,aspect);
        this.bentCardGeometries.set(key, geometry);
      }
      slot.front.geometry = geometry;
      slot.back.geometry = geometry;
    } else if (peeling) {
      const progressSteps = 180;
      const quantizedProgress = Math.round(cornerPeel * progressSteps) / progressSteps;
      const quantizedAngle = Math.round((t.peelAngle ?? Math.PI * 0.78) * 64) / 64;
      const quantizedCurl = Math.round(curl * 64) / 64;
      const quantizedDirection = Math.round((t.peelDirection ?? 50) * 2) / 2;
      const quantizedSoftness = Math.round(peelSoftness * 32) / 32;
      const key = `peel:${quantizedProgress.toFixed(3)}:${quantizedAngle.toFixed(3)}:${quantizedCurl.toFixed(3)}:${quantizedDirection.toFixed(1)}:${quantizedSoftness.toFixed(3)}`;
      let geometry = this.bentCardGeometries.get(key);
      if (!geometry) {
        geometry = makeCornerPeelGeometry(
          quantizedProgress,
          quantizedAngle,
          quantizedCurl,
          quantizedDirection,
          quantizedSoftness,
        );
        this.bentCardGeometries.set(key, geometry);
      }
      slot.front.geometry = geometry;
      slot.back.geometry = geometry;
    } else if (curled) {
      const quantized = Math.round(curl * 60) / 60;
      const key = `curl:${quantized.toFixed(3)}`;
      let geometry = this.bentCardGeometries.get(key);
      if (!geometry) {
        geometry = makeCurlPlaneGeometry(quantized);
        this.bentCardGeometries.set(key, geometry);
      }
      slot.front.geometry = geometry;
      slot.back.geometry = geometry;
    } else if (bent) {
      const key = bend.toFixed(3);
      let geometry = this.bentCardGeometries.get(key);
      if (!geometry) {
        geometry = makeBentPlaneGeometry(bend);
        this.bentCardGeometries.set(key, geometry);
      }
      slot.front.geometry = geometry;
      slot.back.geometry = geometry;
    } else {
      slot.front.geometry = this.cardPlaneGeometry;
      slot.back.geometry = this.cardPlaneGeometry;
    }
    slot.front.position.z = physical ? 0.501 : 0;
    slot.front.material.opacity = alpha;
    slot.front.material.depthWrite = alpha > 0.995;
    const customBackface=!!t.backfaceColor;
    slot.front.material.side=customBackface?THREE.FrontSide:THREE.DoubleSide;
    slot.front.material.polygonOffset=!!t.depthBias;
    slot.front.material.polygonOffsetFactor=0;slot.front.material.polygonOffsetUnits=-(t.depthBias??0);
    setImageLighting(slot.front.material, imageLighting);
    if (imageLighting) {
      slot.front.material.color.setRGB(exposure, exposure, exposure);
      slot.front.material.emissiveIntensity = 0.18 + exposure * 0.14;
    } else {
      // The source image retains its color while geometry supplies perspective.
      // Lighting/highlights are opt-in for the selected motion layer.
      slot.front.material.color.setRGB(0, 0, 0);
      slot.front.material.emissiveIntensity = 1 - clamp(t.dim ?? 0, 0, 1);
    }
    slot.front.castShadow = shadow;
    slot.front.receiveShadow = shadow && imageLighting;

    // A physical card is THREE transparent meshes — front at +T/2, body, back at
    // -T/2. They only stack correctly while the card writes depth, and depth
    // writing is gated on alpha > 0.995 just above. Below that the three blend in
    // whatever order the scene graph happens to give, and the card renders as
    // interleaved stripes of itself: the front image shredded by its own body.
    // Measured across the library, this hit 100% of Depth Stack's cards, 86-94%
    // of Helix 3D's and 67% of Parallax Totem's — every template that combines
    // thickness with a depth/back fade, which is all of them.
    //
    // So the solid is shown on exactly the cards that can sort it. A faded card
    // falls back to its single front plane, which is the honest degradation:
    // you cannot see the edge of a translucent card anyway.
    const solid = physical && alpha > 0.995;
    slot.body.visible = solid;
    slot.back.visible = solid || (customBackface && alpha > .001);
    slot.back.position.z=physical?-.501:(bent||curled||peeling||stickerRolling)?-.0005:-.02;
    slot.back.material.side=THREE.BackSide;slot.back.rotation.y=0;
    slot.back.material.color.set(t.backfaceColor??'#17171b');
    slot.back.material.depthWrite=alpha>.995;
    slot.body.material.opacity = alpha;
    slot.back.material.opacity = alpha;
    slot.body.castShadow = slot.body.receiveShadow = shadow;
    slot.back.castShadow = slot.back.receiveShadow = shadow;
    slot.root.visible = alpha > 0.001 && t.scale > 0.0001;
  }

  private updateTrackState(track: MotionTrack, rt: TrackRT3D, frame: number, sceneTotal: number, s: SceneState) {
    const time = resolveTrackTime(track, frame, sceneTotal);
    rt.active = time.active;
    rt.group.visible = time.active;
    if (!time.active) return;
    const template = getTemplate(track.templateId);
    const count = rt.slots.length;
    const ease = resolveEasing(track.easing);
    const easedPhase = (phase: number) => {
      const base = Math.floor(phase);
      return base + ease(phase - base);
    };
    const ctx = {
      fps: s.fps, width: s.width, height: s.height,
      duration: time.localTotal / Math.max(1, s.fps),
      totalFrames: time.localTotal,
      ease, easedPhase,
      // The Box and other geometry-aware templates need the exact dimensions
      // that the renderer gives each cropped card. Without this, changing Card
      // shape updates the mesh but leaves the path geometry at its default.
      cardAspect: cardAspectFor(template.meta, s.width, s.height, s.cardShape),
    };
    this.updateTrackCamera(rt.camera, Number(track.values.perspective ?? 100), template.camera?.(track.values, ctx));
    const path = modelPathOffset(track, frame, s.fps, s.width, s.height);
    rt.group.position.set(track.transform.x + path.x, -(track.transform.y + path.y), 0);
    rt.group.scale.setScalar(track.transform.scale);
    rt.group.rotation.set(0, 0, -(track.transform.rotation * Math.PI) / 180);
    const layerAlpha = clamp(track.opacity, 0, 1) * time.envelope;
    rt.opacity = layerAlpha;
    rt.blend = track.blend;

    for (let i = 0; i < count; i++) {
      const slot = rt.slots[i];
      const norm = SPRITE_BASE / Math.max(slot.texW, slot.texH) * (slot.fitScale ?? 1);
      this.applyCorner(slot, Number(track.values.cornerRadius ?? 0));
      // Blend mode and layer opacity are applied once to the completed render
      // target. Inside a track cards still use normal alpha + their own depth.
      if (template.transform3d) {
        const t = template.transform3d(time.localFrame, i, count, track.values, ctx);
        this.applyPhysicalPose(slot, t, norm, track.values._imageLighting === true, track.values._autoTransparency === true);
      } else {
        const t = template.transform(time.localFrame, i, count, track.values, ctx);
        slot.front.geometry = this.cardPlaneGeometry;
        if(t.taper){
          const ratio=clamp(t.taper.ratio,0,1),key=`taper:${t.taper.edge}:${ratio.toFixed(3)}`;
          let geometry=this.bentCardGeometries.get(key);
          if(!geometry){
            geometry=new THREE.PlaneGeometry(1,1,16,16);
            const p=geometry.attributes.position;
            for(let j=0;j<p.count;j++){
              const x=p.getX(j),y=p.getY(j),edge=t.taper.edge;
              const progress=edge==='top'?y+.5:edge==='bottom'?.5-y:edge==='left'?.5-x:x+.5;
              const scale=1-(1-ratio)*progress;
              if(edge==='top'||edge==='bottom')p.setX(j,x*scale);else p.setY(j,y*scale);
            }
            geometry.computeVertexNormals();this.bentCardGeometries.set(key,geometry);
          }
          slot.front.geometry=geometry;
        }
        // The 2D contract uses two projected axes, including skew. Keep its
        // painter order even inside a mixed 3D composition or a BG Blur pass.
        const [a,b,c,d]=previewMatrix(t.rotation,t.skewX,t.skewY);
        const w=slot.texW*norm*t.scale*(t.scaleX??1),h=slot.texH*norm*t.scale*(t.scaleY??1);
        slot.root.matrixAutoUpdate=false;
        slot.root.matrix.set(a*w,-c*h,0,t.x,-b*w,d*h,0,-t.y,0,0,1,0,0,0,0,1);
        slot.front.renderOrder=t.depth*1000+i/1000;
        slot.front.material.side=THREE.DoubleSide;slot.front.material.polygonOffset=false;
        slot.front.position.z = 0;
        slot.front.material.opacity = cardOpacity(t.alpha,track.values._autoTransparency===true,t.solidAlpha);
        slot.front.material.depthWrite = false;
        slot.front.material.forceSinglePass = true;
        slot.front.material.color.setRGB(0, 0, 0);
        slot.front.material.emissiveIntensity = 1-clamp(t.dim??0,0,1);
        setImageLighting(slot.front.material, false);
        slot.front.castShadow = false;
        slot.front.receiveShadow = false;
        slot.body.visible = false;
        slot.back.visible = false;
        slot.root.visible = t.alpha > 0.001 && t.scale > 0.0001;
      }
    }
  }

  // ---- video export sync ---- (see the Pixi renderer for the rationale)
  async beginImageExport() {
    await Promise.all([...this.texturePromises.values()]);this.exportingImages=true;
    const s=useSceneStore.getState();
    const urls=exportImageUrls(s);
    for(let i=0;i<urls.length;i+=2){
      const results=await Promise.allSettled(urls.slice(i,i+2).map(async url=>{
        const image=await loadImage(url);if(!image||!this.ready)throw new Error('Não foi possível carregar a imagem original para exportar.');
        const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=this.renderer.capabilities.getMaxAnisotropy();texture.needsUpdate=true;
        this.previewImageTextures.set(url,this.textureCache.get(url));this.textureCache.set(url,texture);
      }));
      const error=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');if(error)throw error.reason;
    }
    this.croppedCache.forEach(texture=>texture.dispose());this.croppedCache.clear();this.invalidateTracks();this.syncAssets();await Promise.resolve();
  }
  endImageExport() {
    this.exportingImages=false;this.croppedCache.forEach(texture=>texture.dispose());this.croppedCache.clear();
    this.previewImageTextures.forEach((preview,url)=>{const original=this.textureCache.get(url);if(preview)this.textureCache.set(url,preview);else this.textureCache.delete(url);if(original&&original!==preview)original.dispose();});
    this.previewImageTextures.clear();this.invalidateTracks();this.syncAssets();this.onDirty?.();
  }
  async beginVideoExport() {
    if (this.videoEls.size === 0) return;
    await Promise.all([...this.videoEls.values()].map(prepareVideoForSequentialExport));
    this.videoEls.forEach((video, url) => {
      if (!video.videoWidth || !video.videoHeight) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.exportVideoFrames.set(url, { canvas, ctx, texture });
    });
    this.croppedCache.forEach((tex) => tex.dispose());
    this.croppedCache.clear();
    this.invalidateTracks();
    this.syncAssets();
  }

  endVideoExport() {
    this.croppedCache.forEach((tex) => tex.dispose());
    this.croppedCache.clear();
    this.exportVideoFrames.forEach(({ texture }) => texture.dispose());
    this.exportVideoFrames.clear();
    this.invalidateTracks();
    this.syncAssets();
  }

  async seekVideos(frame: number) {
    if (this.videoEls.size === 0) return;
    const s = useSceneStore.getState();
    const t = frame / Math.max(1, s.fps);
    await Promise.all([...this.videoEls.entries()].map(([url, v]) => {
      const localTime = reelVideoTime(s, url, frame);
      return localTime === null ? Promise.resolve() : advanceVideoForExport(v, localTime ?? t, s.fps, s.videoEnd);
    }));
    this.videoEls.forEach((video, url) => {
      const snapshot = this.exportVideoFrames.get(url);
      if (snapshot) {
        snapshot.ctx.drawImage(video, 0, 0);
        snapshot.texture.needsUpdate = true;
      }
    });
  }

  resumeVideos() {
    this.videoEls.forEach((v) => { v.play().catch(() => { /* noop */ }); });
  }

  pauseVideos() {
    this.videoEls.forEach((v) => { try { v.pause(); } catch { /* noop */ } });
  }

  restartVideos() {
    this.videoEls.forEach((v) => {
      // Looping videos keep their own continuous playback clock. Only videos
      // frozen by the "hold" mode need to restart with the scene timeline.
      if (v.loop) return;
      try { v.currentTime = 0; v.play().catch(() => { /* noop */ }); } catch { /* noop */ }
    });
  }

  renderFrame(frame: number) {
    if (!this.ready) return;
    this.getFrameState(frame);
    const s = useSceneStore.getState();

    // The accumulator begins with the opaque scene background.
    this.renderer.setRenderTarget(this.composeA);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);

    let read = this.composeA;
    let write = this.composeB;
    const composeMaterial = this.composeQuad.material;
    for (const [id, rt] of this.overlays) if (!s.textLayers.some((l) => l.id === id)) { rt.texture.dispose(); rt.mask?.dispose(); rt.raster.destroy(); this.overlays.delete(id); }
    compositionOrder(s.tracks, s.textLayers).forEach((item) => {
      composeMaterial.uniforms.backdropBlur.value=0;
      composeMaterial.uniforms.sceneSize.value.set(s.width,s.height);
      let texture: THREE.Texture, opacity = 1, blend: string = 'normal';
      if (item.kind === 'motion') {
        const rt = this.trackRTs.get(item.id); if (!rt?.active) return;
        this.renderer.setRenderTarget(rt.target); this.renderer.setClearColor(0x000000, 0);
        this.renderer.clear(true, true, true); this.renderer.render(rt.scene, rt.camera);
        texture = rt.target.texture; opacity = rt.opacity; blend = rt.blend;
      } else {
        const layer = s.textLayers.find((l) => l.id === item.id)!;
        if (s.textLayers.some((l) => l.maskId === layer.id)) return; // used as a mask only
        const mask = layer.maskId ? s.textLayers.find((l) => l.id === layer.maskId && l.id !== layer.id) : undefined;
        if (!this.exportingImages && isCanvasEditing(layer.id)) return;
        if (!layer.visible || frame / s.fps < layer.start || frame / s.fps >= layer.end) return;
        let rt = this.overlays.get(item.id);
        if (!rt) { const raster = new OverlayRaster(); raster.update(layer, s.width, s.height, this.resolution, frame / s.fps, this.exportingImages, mask); const texture = new THREE.CanvasTexture(raster.canvas); texture.colorSpace = THREE.SRGBColorSpace; rt = { raster, texture }; this.overlays.set(item.id, rt); }
        // The compositor consumes premultiplied layer RGB. Canvas textures
        // otherwise upload straight RGB, cancelling text opacity and fades.
        rt.texture.premultiplyAlpha = true;
        const changed=rt.raster.update(layer, s.width, s.height, this.resolution, frame / s.fps, this.exportingImages, mask);
        if (changed) rt.texture.needsUpdate = true;
        if(rt.raster.maskCanvas){
          if(!rt.mask){rt.mask=new THREE.CanvasTexture(rt.raster.maskCanvas);rt.mask.generateMipmaps=false;rt.mask.minFilter=THREE.LinearFilter;}
          if(changed)rt.mask.needsUpdate=true;
          composeMaterial.uniforms.backdropMap.value=rt.mask;
          composeMaterial.uniforms.backdropBlur.value=clamp(layer.backdropBlur??0,0,40);
          composeMaterial.uniforms.blurredMap.value=this.backdropTexture(read.texture,composeMaterial.uniforms.backdropBlur.value);
        }else if(rt.mask){rt.mask.dispose();rt.mask=undefined;}
        texture = rt.texture; blend = layer.blend ?? 'normal';
      }
      composeMaterial.uniforms.baseMap.value = read.texture;
      composeMaterial.uniforms.layerMap.value = texture;
      if(composeMaterial.uniforms.backdropBlur.value===0){composeMaterial.uniforms.backdropMap.value=texture;composeMaterial.uniforms.blurredMap.value=texture;}
      composeMaterial.uniforms.opacity.value = opacity;
      composeMaterial.uniforms.blendMode.value = blendIndex(blend);
      this.renderer.setRenderTarget(write);
      this.renderer.clear(true, false, false);
      this.renderer.render(this.composeScene, this.composeCam);
      [read, write] = [write, read];
    });

    const liveEffects = new Set<string>();
    if(this.bentCardGeometries.size>128){
      const used=new Set([...this.trackRTs.values()].flatMap(rt=>rt.slots.flatMap(slot=>[slot.front.geometry,slot.back.geometry])));
      for(const [key,geometry] of this.bentCardGeometries){if(this.bentCardGeometries.size<=128)break;if(!used.has(geometry)){geometry.dispose();this.bentCardGeometries.delete(key);}}
    }
    try {
      for (const effect of s.effects) {
        if (!effect.enabled) continue;
        const definition = getEffect(effect.effectId); if (!definition) continue;
        const key = this.fxOwner + effect.instanceId; liveEffects.add(key);
        threeMaterialsFor(definition, key).forEach((material, index) => {
          applyThreeUniforms(material, definition, effect.values, { width: s.width, height: s.height, time: frame / s.fps }, index);
          material.uniforms.map.value = read.texture;
          this.composeQuad.material = material;
          this.renderer.setRenderTarget(write); this.renderer.clear(true, false, false);
          this.renderer.render(this.composeScene, this.composeCam);
          [read, write] = [write, read];
        });
      }
    } finally { this.composeQuad.material = composeMaterial; dropThreeMaterials(liveEffects, this.fxOwner); }
    this.outputQuad.material.uniforms.map.value = read.texture;
    this.outputQuad.material.uniforms.resolution.value.set(
      this.width * this.resolution,
      this.height * this.resolution,
    );
    this.outputQuad.material.uniforms.pixelSize.value = 1;
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.outputScene, this.composeCam);

    // HUD pass (logo + safe-area) is deliberately outside global pixelation.
    this.renderer.autoClear = false;
    this.renderer.render(this.hud, this.hudCam);
    this.renderer.autoClear = true;
    this.outputCanvas = this.renderer.domElement;
  }

  hitTest(x: number, y: number) {
    const s = useSceneStore.getState();
    for (const item of compositionOrder(s.tracks, []).reverse()) {
      const rt = this.trackRTs.get(item.id); if (!rt?.active) continue;
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / s.width * 2 - 1, 1 - y / s.height * 2), rt.camera);
      if (ray.intersectObjects(rt.group.children, true).length) return item.id;
    }
    return null;
  }
  selectionBounds(id: string) {
    const rt = this.trackRTs.get(id); if (!rt?.active) return null;
    const s = useSceneStore.getState(), box = new THREE.Box3().setFromObject(rt.group);
    if (box.isEmpty()) return null;
    const pts: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z).project(rt.camera));
    const xs = pts.map((p) => (p.x + 1) / 2 * s.width), ys = pts.map((p) => (1 - p.y) / 2 * s.height);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }

  captureFrame(frame: number): string {
    this.renderFrame(frame);
    // JPEG (q0.92) — see the Pixi renderer's captureFrame for the rationale.
    return this.extractCanvas().toDataURL('image/jpeg', 0.92);
  }

  extractCanvas(): HTMLCanvasElement {
    return this.outputCanvas ?? this.renderer.domElement;
  }

  destroy() {
    dropThreeMaterials(new Set(), this.fxOwner);
    this.textCompositor.destroy();
    this.overlays.forEach((rt) => { rt.texture.dispose();rt.mask?.dispose(); rt.raster.destroy(); }); this.overlays.clear();
    this.ready = false;
    this.texturePromises.clear();
    this.r3f?.destroy();
    this.r3f = null;
    this.trackRTs.forEach((rt) => this.destroyTrack(rt));
    this.trackRTs.clear();
    this.textureCache.forEach((t) => t.dispose());
    this.textureCache.clear();
    this.previewImageTextures.forEach(texture=>texture?.dispose());this.previewImageTextures.clear();
    this.croppedCache.forEach((t) => t.dispose());
    this.croppedCache.clear();
    this.videoEls.forEach((v) => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* noop */ } });
    this.videoEls.clear();
    this.placeholders.forEach((t) => t.dispose());
    this.placeholders.clear();
    this.cornerMaps.forEach((t) => t.dispose());
    this.cornerMaps.clear();
    this.gradientTex?.dispose();
    this.backgroundTex?.dispose();
    this.backgroundGeneration++;
    this.composeA?.dispose();
    this.composeB?.dispose();
    this.backdropTargets?.forEach(target=>target.dispose());this.backdropTargets=null;this.backdropMaterial?.dispose();this.backdropMaterial=null;
    this.composeQuad?.geometry.dispose();
    this.composeQuad?.material.dispose();
    this.outputQuad?.geometry.dispose();
    this.outputQuad?.material.dispose();
    this.cardPlaneGeometry.dispose();
    this.cardBodyGeometry.dispose();
    this.bentCardGeometries.forEach((geometry) => geometry.dispose());
    this.bentCardGeometries.clear();
    if (this.logoMesh) { this.logoMesh.geometry.dispose(); this.logoMesh.material.map?.dispose(); this.logoMesh.material.dispose(); }
    if (this.safeLine) { this.safeLine.geometry.dispose(); (this.safeLine.material as THREE.Material).dispose(); }
    try {
      this.renderer.dispose();
    } catch { /* already lost */ }
  }
}
