/* eslint-disable @typescript-eslint/no-explicit-any */
import type p5 from 'p5';
import type { ControlParam, LayerEngine } from './types';
import { applyDither } from './dither-utils';

// ---------------------------------------------------------------------------
// Object3D Engine — real-time Three.js layer (extruded type + primitives)
// Renders a WebGL scene to an offscreen canvas, then composites (optionally
// dithered) into the layer's p5.Graphics buffer. Keeps the existing
// blend-mode / opacity compositing pipeline untouched.
// ---------------------------------------------------------------------------

export const object3dParams: ControlParam[] = [
  // SHAPE
  { key: 'shape', name: 'Shape', type: 'select', folder: 'SHAPE', default: 'text', options: [
    { label: 'Extruded Text', value: 'text' },
    { label: 'Image Relief', value: 'image' },
    { label: '3D Model (GLB)', value: 'model' },
    { label: 'Box', value: 'box' },
    { label: 'Sphere', value: 'sphere' },
    { label: 'Torus', value: 'torus' },
    { label: 'Torus Knot', value: 'torusKnot' },
    { label: 'Cylinder', value: 'cylinder' },
    { label: 'Cone', value: 'cone' },
    { label: 'Icosahedron', value: 'icosahedron' },
  ] },
  { key: 'text', name: 'Text', type: 'string', default: 'A', folder: 'SHAPE' },
  { key: 'imageSource', name: 'Image', type: 'file', accept: 'image/*', default: '', folder: 'SHAPE' },
  { key: 'modelSource', name: 'Model (.glb)', type: 'file', accept: '.glb,.gltf,model/gltf-binary', default: '', folder: 'SHAPE' },
  { key: 'displaceScale', name: 'Relief Depth', type: 'number', min: 0, max: 120, step: 1, default: 0, folder: 'SHAPE' },
  { key: 'removeBg', name: 'Remove BG', type: 'boolean', default: true, folder: 'SHAPE' },
  { key: 'bgThreshold', name: 'BG Cutoff', type: 'number', min: 0, max: 1, step: 0.01, default: 0.18, folder: 'SHAPE' },
  { key: 'bgInvert', name: 'BG Invert', type: 'boolean', default: false, folder: 'SHAPE' },
  { key: 'size', name: 'Size', type: 'number', min: 10, max: 200, step: 1, default: 120, folder: 'SHAPE' },
  { key: 'depth', name: 'Depth', type: 'number', min: 1, max: 160, step: 1, default: 44, folder: 'SHAPE' },
  { key: 'bevel', name: 'Bevel', type: 'number', min: 0, max: 12, step: 0.5, default: 2, folder: 'SHAPE' },

  // MATERIAL
  { key: 'material', name: 'Finish', type: 'select', folder: 'MATERIAL', default: 'satin', options: [
    { label: 'Matte', value: 'matte' },
    { label: 'Satin', value: 'satin' },
    { label: 'Metal', value: 'metal' },
    { label: 'Chrome', value: 'chrome' },
    { label: 'Plastic', value: 'plastic' },
    { label: 'Glass', value: 'glass' },
  ] },
  { key: 'color', name: 'Color', type: 'color', default: '#e6e6e6', folder: 'MATERIAL' },

  // POSITION (drag on canvas)
  { key: 'posX', name: 'Pos X', type: 'number', min: -0.5, max: 1.5, step: 0.005, default: 0.5, folder: 'POSITION' },
  { key: 'posY', name: 'Pos Y', type: 'number', min: -0.5, max: 1.5, step: 0.005, default: 0.5, folder: 'POSITION' },

  // SCENE
  { key: 'background', name: 'Background', type: 'select', folder: 'SCENE', default: 'transparent', options: [
    { label: 'Transparent', value: 'transparent' },
    { label: 'Solid', value: 'solid' },
  ] },
  { key: 'bgColor', name: 'BG Color', type: 'color', default: '#0a0a0a', folder: 'SCENE' },

  // POST (Endless-Tools-style real-time post-processing)
  { key: 'post', name: 'Post FX', type: 'boolean', default: false, folder: 'POST' },
  { key: 'bloom', name: 'Bloom', type: 'number', min: 0, max: 2, step: 0.05, default: 0.7, folder: 'POST' },
  { key: 'chroma', name: 'Chromatic', type: 'number', min: 0, max: 1, step: 0.01, default: 0.15, folder: 'POST' },
  { key: 'grain', name: 'Grain', type: 'number', min: 0, max: 1, step: 0.01, default: 0.12, folder: 'POST' },
  { key: 'vignette', name: 'Vignette', type: 'number', min: 0, max: 1, step: 0.01, default: 0.3, folder: 'POST' },

  // LIGHTING
  { key: 'lighting', name: 'Lighting', type: 'select', folder: 'LIGHTING', default: 'studio', options: [
    { label: 'Studio (3-point)', value: 'studio' },
    { label: 'Rim', value: 'rim' },
    { label: 'Soft', value: 'soft' },
    { label: 'Dramatic', value: 'dramatic' },
  ] },
  { key: 'intensity', name: 'Intensity', type: 'number', min: 0, max: 3, step: 0.05, default: 1, folder: 'LIGHTING' },

  // MOTION
  { key: 'motion', name: 'Motion', type: 'select', folder: 'MOTION', default: 'spin', options: [
    { label: 'None', value: 'none' },
    { label: 'Spin', value: 'spin' },
    { label: 'Orbit', value: 'orbit' },
    { label: 'Spherical Helix', value: 'helix' },
    { label: 'Float', value: 'float' },
  ] },
  { key: 'speed', name: 'Speed', type: 'number', min: 0, max: 3, step: 0.01, default: 0.6, folder: 'MOTION' },
  { key: 'amplitude', name: 'Amplitude', type: 'number', min: 0, max: 240, step: 1, default: 60, folder: 'MOTION' },

  // ROTATION (manual pose — motion is added on top)
  { key: 'rotX', name: 'Rotate X', type: 'number', min: -180, max: 180, step: 1, default: -18, folder: 'ROTATION' },
  { key: 'rotY', name: 'Rotate Y', type: 'number', min: -180, max: 180, step: 1, default: 0, folder: 'ROTATION' },
  { key: 'rotZ', name: 'Rotate Z', type: 'number', min: -180, max: 180, step: 1, default: 0, folder: 'ROTATION' },

  // CAMERA
  { key: 'zoom', name: 'Zoom', type: 'number', min: 0.4, max: 2.5, step: 0.01, default: 1, folder: 'CAMERA' },

  // DITHER
  { key: 'dither', name: 'Dither', type: 'boolean', default: false, folder: 'DITHER' },
  { key: 'ditherType', name: 'Type', type: 'select', folder: 'DITHER', default: 'bayer4', options: [
    { label: 'Bayer 4x4', value: 'bayer4' },
    { label: 'Bayer 8x8', value: 'bayer8' },
    { label: 'Floyd-Steinberg', value: 'fs' },
    { label: 'Halftone', value: 'halftone' },
  ] },
  { key: 'ditherColorMode', name: 'Color Mode', type: 'select', folder: 'DITHER', default: 'original', options: [
    { label: 'Original', value: 'original' },
    { label: 'Duotone', value: 'duotone' },
  ] },
  { key: 'ditherFg', name: 'Foreground', type: 'color', default: '#ffffff', folder: 'DITHER' },
  { key: 'ditherBg', name: 'Background', type: 'color', default: '#000000', folder: 'DITHER' },
  { key: 'threshold', name: 'Threshold', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, folder: 'DITHER' },
  { key: 'ditherScale', name: 'Dither Scale', type: 'number', min: 1, max: 6, step: 1, default: 1, folder: 'DITHER' },
];

const FINISH: Record<string, { metalness: number; roughness: number; physical?: boolean; clearcoat?: number; transmission?: number; ior?: number }> = {
  matte:   { metalness: 0,   roughness: 0.85 },
  satin:   { metalness: 0,   roughness: 0.40 },
  metal:   { metalness: 1,   roughness: 0.28 },
  chrome:  { metalness: 1,   roughness: 0.03 },
  plastic: { metalness: 0,   roughness: 0.35, physical: true, clearcoat: 1 },
  glass:   { metalness: 0,   roughness: 0.05, physical: true, transmission: 1, ior: 1.45 },
};

export class Object3DEngine implements LayerEngine {
  private THREE: any = null;
  private TextGeometry: any = null;
  private GLTFLoader: any = null;
  private meshKind: 'mesh' | 'model' | null = null;
  private modelUrl = '';
  private renderer: any = null;
  private composer: any = null;
  private bloomPass: any = null;
  private fxPass: any = null;
  private scene: any = null;
  private camera: any = null;
  private mesh: any = null;
  private lightGroup: any = null;
  private font: any = null;
  private envTexture: any = null;
  private glCanvas: HTMLCanvasElement | null = null;
  private tmpCanvas: HTMLCanvasElement | null = null;

  private w = 0;
  private h = 0;
  private ready = false;
  private initStarted = false;

  private geomSig = '';
  private matSig = '';
  private lightSig = '';
  private fitRadius = 100;

  // Image-relief state
  private imageTex: any = null;
  private maskTex: any = null;
  private imageAspect = 1;
  private texUrl = '';      // currently loaded/loading url
  private texVersion = 0;   // bumps when a new texture finishes loading

  setup(_p: p5, w: number, h: number, _params: Record<string, any>): void {
    this.w = w;
    this.h = h;
    if (!this.initStarted) {
      this.initStarted = true;
      void this.init();
    }
  }

  private async init(): Promise<void> {
    const THREE = await import('three');
    const { FontLoader } = await import('three/examples/jsm/loaders/FontLoader.js');
    const { TextGeometry } = await import('three/examples/jsm/geometries/TextGeometry.js');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
    const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
    const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
    const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');
    const { ShaderPass } = await import('three/examples/jsm/postprocessing/ShaderPass.js');
    const { OutputPass } = await import('three/examples/jsm/postprocessing/OutputPass.js');
    const fontJson: any = (await import('./fonts/google-sans-flex-bold.typeface.json')).default;

    this.THREE = THREE;
    this.TextGeometry = TextGeometry;
    this.GLTFLoader = GLTFLoader;
    this.font = new FontLoader().parse(fontJson);

    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    this.glCanvas = canvas;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(this.w, this.h, false);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    this.renderer = renderer;

    // Procedural studio environment for believable PBR reflections (no asset).
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.envTexture = envRT.texture;
    pmrem.dispose();

    const scene = new THREE.Scene();
    scene.environment = this.envTexture;
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(45, this.w / this.h, 0.1, 4000);
    camera.position.set(0, 0, 480);
    this.camera = camera;

    this.lightGroup = new THREE.Group();
    scene.add(this.lightGroup);

    // --- Post-processing pipeline (bloom + chromatic/grain/vignette) ---
    const composer = new EffectComposer(renderer);
    composer.setSize(this.w, this.h);
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(new THREE.Vector2(this.w, this.h), 0.7, 0.5, 0.85);
    composer.addPass(bloom);
    this.bloomPass = bloom;

    const fx = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uChroma: { value: 0.15 },
        uGrain: { value: 0.12 },
        uVignette: { value: 0.3 },
        uTime: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uChroma, uGrain, uVignette, uTime; varying vec2 vUv;
        float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec2 dir = vUv - 0.5;
          float amt = uChroma * 0.012;
          vec4 col;
          col.r = texture2D(tDiffuse, vUv - dir * amt).r;
          col.g = texture2D(tDiffuse, vUv).g;
          col.b = texture2D(tDiffuse, vUv + dir * amt).b;
          col.a = texture2D(tDiffuse, vUv).a;
          col.rgb += (rand(vUv * 999.0 + uTime) - 0.5) * uGrain;
          float v = smoothstep(0.85, 0.25, length(dir) * 1.4);
          col.rgb *= mix(1.0, v, uVignette);
          gl_FragColor = col;
        }`,
    });
    composer.addPass(fx);
    this.fxPass = fx;

    composer.addPass(new OutputPass());
    this.composer = composer;

    this.ready = true;
  }

  // --- Image texture (for relief) ------------------------------------------

  private loadTexture(url: string): void {
    if (url === this.texUrl) return;
    this.texUrl = url;
    this.imageTex?.dispose?.();
    this.imageTex = null;
    if (!url) return;
    const loader = new this.THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (tex: any) => {
        if (this.texUrl !== url) { tex.dispose?.(); return; } // superseded
        tex.colorSpace = this.THREE.SRGBColorSpace;
        const img = tex.image;
        this.imageAspect = img && img.height ? img.width / img.height : 1;
        this.imageTex = tex;
        this.texVersion++;        // force geometry+material rebuild
        this.geomSig = '';
        this.matSig = '';
      },
      undefined,
      () => { /* load error — leave as fallback */ }
    );
  }

  // Build a luminance alpha mask from the loaded image so the relief can drop
  // its background (dark pixels → transparent; inverted for bright backgrounds).
  private makeAlphaMask(invert: boolean): any {
    const img = this.imageTex?.image;
    const iw = img?.videoWidth || img?.naturalWidth || img?.width;
    const ih = img?.videoHeight || img?.naturalHeight || img?.height;
    if (!img || !iw || !ih) return null;
    try {
      const c = document.createElement('canvas');
      c.width = iw;
      c.height = ih;
      const cx = c.getContext('2d', { willReadFrequently: true })!;
      cx.drawImage(img, 0, 0, iw, ih);
      const id = cx.getImageData(0, 0, iw, ih);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        let lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        if (invert) lum = 255 - lum;
        d[i] = d[i + 1] = d[i + 2] = lum;
      }
      cx.putImageData(id, 0, 0);
      const tex = new this.THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    } catch {
      return null; // tainted (CORS) — skip
    }
  }

  // --- Geometry ------------------------------------------------------------

  private buildGeometry(pr: Record<string, any>): any {
    const T = this.THREE;
    const shape = pr.shape;
    const s = pr.size;

    if (shape === 'image') {
      // Height-field relief: a finely segmented plane displaced by image luma.
      const a = this.imageAspect || 1;
      const w = s * 1.6;
      const h = w / a;
      const segX = 200;
      const segY = Math.max(40, Math.round(200 / a));
      return new T.PlaneGeometry(w, h, segX, segY);
    }

    if (shape === 'text') {
      const geo = new this.TextGeometry(String(pr.text ?? 'A') || ' ', {
        font: this.font,
        size: s,
        depth: pr.depth,
        curveSegments: 8,
        bevelEnabled: pr.bevel > 0,
        bevelThickness: pr.bevel,
        bevelSize: pr.bevel * 0.6,
        bevelSegments: 3,
      });
      geo.center();
      return geo;
    }

    const r = s * 0.6;
    const d = Math.max(2, pr.depth);
    switch (shape) {
      case 'box': return new T.BoxGeometry(r * 1.4, r * 1.4, d);
      case 'sphere': return new T.SphereGeometry(r, 64, 48);
      case 'torus': return new T.TorusGeometry(r, Math.max(4, d * 0.4), 24, 96);
      case 'torusKnot': return new T.TorusKnotGeometry(r * 0.8, Math.max(4, d * 0.3), 160, 24);
      case 'cylinder': return new T.CylinderGeometry(r, r, d * 1.6, 64);
      case 'cone': return new T.ConeGeometry(r, d * 2.2, 64);
      case 'icosahedron': return new T.IcosahedronGeometry(r, 0);
      default: return new T.BoxGeometry(r, r, d);
    }
  }

  private buildMaterial(pr: Record<string, any>): any {
    const T = this.THREE;
    const f = FINISH[pr.material] ?? FINISH.satin;
    const color = new T.Color(pr.color || '#e6e6e6');

    // Image relief: textured + displaced surface, optional background removal.
    if (pr.shape === 'image' && this.imageTex) {
      const mat = new T.MeshStandardMaterial({
        map: this.imageTex,
        displacementMap: pr.displaceScale > 0 ? this.imageTex : null,
        displacementScale: pr.displaceScale ?? 0,
        metalness: f.metalness,
        roughness: Math.max(0.35, f.roughness),
        envMapIntensity: 0.5,
        side: T.DoubleSide,
        transparent: true,
        alphaTest: 0.5, // respect a transparent PNG's own alpha (clean cutout)
      });
      if (pr.removeBg) {
        const mask = this.makeAlphaMask(!!pr.bgInvert);
        if (mask) {
          this.maskTex?.dispose?.();
          this.maskTex = mask;
          mat.alphaMap = mask;
          mat.alphaTest = pr.bgThreshold ?? 0.18; // luminance-based removal
        }
      }
      return mat;
    }

    if (f.physical) {
      return new T.MeshPhysicalMaterial({
        color,
        metalness: f.metalness,
        roughness: f.roughness,
        clearcoat: f.clearcoat ?? 0,
        clearcoatRoughness: 0.1,
        transmission: f.transmission ?? 0,
        ior: f.ior ?? 1.5,
        thickness: f.transmission ? pr.depth : 0,
        transparent: !!f.transmission,
        envMapIntensity: 0.55,
      });
    }
    return new T.MeshStandardMaterial({
      color,
      metalness: f.metalness,
      roughness: f.roughness,
      envMapIntensity: 0.55,
    });
  }

  private applyLighting(pr: Record<string, any>): void {
    const T = this.THREE;
    const g = this.lightGroup;
    for (let i = g.children.length - 1; i >= 0; i--) g.remove(g.children[i]);
    const k = pr.intensity;

    switch (pr.lighting) {
      case 'rim': {
        g.add(new T.AmbientLight(0xffffff, 0.15 * k));
        const back = new T.DirectionalLight(0xffffff, 2.2 * k);
        back.position.set(0, 1, -2);
        g.add(back);
        const fill = new T.DirectionalLight(0xffffff, 0.5 * k);
        fill.position.set(-1, 0.5, 1);
        g.add(fill);
        break;
      }
      case 'soft': {
        g.add(new T.HemisphereLight(0xffffff, 0x444444, 0.9 * k));
        const d = new T.DirectionalLight(0xffffff, 0.6 * k);
        d.position.set(0.5, 1, 0.8);
        g.add(d);
        break;
      }
      case 'dramatic': {
        g.add(new T.AmbientLight(0xffffff, 0.08 * k));
        const key = new T.DirectionalLight(0xffffff, 2.6 * k);
        key.position.set(-1.2, 1.4, 0.6);
        g.add(key);
        break;
      }
      case 'studio':
      default: {
        g.add(new T.AmbientLight(0xffffff, 0.08 * k));
        const key = new T.DirectionalLight(0xffffff, 2.2 * k);
        key.position.set(-1, 1.2, 1);
        g.add(key);
        const fill = new T.DirectionalLight(0xffffff, 0.5 * k);
        fill.position.set(1.4, 0.2, 0.8);
        g.add(fill);
        const rim = new T.DirectionalLight(0xffffff, 1.1 * k);
        rim.position.set(0, 0.6, -1.6);
        g.add(rim);
        break;
      }
    }
  }

  private baseDist = 480;

  private fitToRadius(r: number): void {
    this.fitRadius = r;
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = (r / Math.sin(fov / 2)) * 1.25;
    this.baseDist = dist;
    this.camera.position.z = dist;
    // Generous clip range so zoom (0.4–2.5×) never clips the object.
    this.camera.near = 0.1;
    this.camera.far = dist * 4 + r * 6;
    this.camera.updateProjectionMatrix();
  }

  private fitCamera(): void {
    if (!this.mesh || !this.mesh.geometry) return;
    this.mesh.geometry.computeBoundingSphere();
    this.fitToRadius(this.mesh.geometry.boundingSphere?.radius ?? 100);
  }

  // Load an external/AI-generated GLB model (Meshy, Tripo, any source).
  private loadModel(url: string): void {
    if (url === this.modelUrl) return;
    this.modelUrl = url;
    if (!url) return;
    new this.GLTFLoader().load(url, (gltf: any) => {
      if (this.modelUrl !== url) return; // superseded
      const T = this.THREE;
      if (this.mesh) this.scene.remove(this.mesh);
      const root = gltf.scene;
      // Center + scale to a consistent size (scale-aware so it's truly centred).
      const box = new T.Box3().setFromObject(root);
      const c = box.getCenter(new T.Vector3());
      const sz = box.getSize(new T.Vector3());
      const maxDim = Math.max(sz.x, sz.y, sz.z) || 1;
      const s = 200 / maxDim;
      root.scale.setScalar(s);
      root.position.set(-c.x * s, -c.y * s, -c.z * s);
      root.updateMatrixWorld(true);
      this.mesh = root;
      this.meshKind = 'model';
      this.scene.add(root);
      this.geomSig = 'model:' + url;
      this.matSig = 'model:' + url;
      // Frame to the model's actual bounding sphere (fitToRadius adds margin).
      const sphere = new T.Box3().setFromObject(root).getBoundingSphere(new T.Sphere());
      this.fitToRadius(sphere.radius);
    });
  }

  private sync(pr: Record<string, any>): void {
    const T = this.THREE;

    // External resources.
    this.loadTexture(pr.shape === 'image' ? String(pr.imageSource || '') : '');
    this.loadModel(pr.shape === 'model' ? String(pr.modelSource || '') : '');

    const lightSig = [pr.lighting, pr.intensity].join('|');
    if (lightSig !== this.lightSig) {
      this.lightSig = lightSig;
      this.applyLighting(pr);
    }

    // Models keep their own geometry + materials (loaded async); skip rebuild.
    if (pr.shape === 'model') return;

    const geomSig = [pr.shape, pr.text, pr.size, pr.depth, pr.bevel, pr.imageSource, this.texVersion].join('|');
    const matSig = [pr.material, pr.color, pr.shape, pr.displaceScale, pr.removeBg, pr.bgThreshold, pr.bgInvert, this.texVersion].join('|');

    if (geomSig !== this.geomSig) {
      this.geomSig = geomSig;
      const geo = this.buildGeometry(pr);
      if (this.mesh && this.meshKind === 'mesh') {
        this.mesh.geometry.dispose();
        this.mesh.geometry = geo;
      } else {
        if (this.mesh) this.scene.remove(this.mesh); // was a model group
        this.mesh = new T.Mesh(geo, this.buildMaterial(pr));
        this.meshKind = 'mesh';
        this.matSig = matSig;
        this.scene.add(this.mesh);
      }
      this.fitCamera();
    }
    if (matSig !== this.matSig) {
      this.matSig = matSig;
      if (this.mesh && this.meshKind === 'mesh') {
        this.mesh.material.dispose();
        this.mesh.material = this.buildMaterial(pr);
      }
    }
  }

  // --- Motion (parametric) -------------------------------------------------

  private animate(pr: Record<string, any>, t: number): void {
    const m = this.mesh;
    if (!m) return;
    const rx = ((pr.rotX ?? 0) * Math.PI) / 180;
    const ry = ((pr.rotY ?? 0) * Math.PI) / 180;
    const rz = ((pr.rotZ ?? 0) * Math.PI) / 180;
    const sp = pr.speed;
    const amp = pr.amplitude;

    // Base pose from the manual rotation controls; motion adds on top.
    m.position.set(0, 0, 0);
    m.rotation.set(rx, ry, rz);

    switch (pr.motion) {
      case 'spin':
        m.rotation.y = ry + t * sp;
        m.rotation.x = rx + Math.sin(t * sp * 0.5) * 0.12;
        break;
      case 'orbit': {
        const a = t * sp;
        m.position.x = Math.cos(a) * amp;
        m.position.z = Math.sin(a) * amp;
        m.rotation.y = ry + a;
        break;
      }
      case 'helix': {
        const a = t * sp;
        const rad = Math.sin(a * 0.5) * amp;
        m.position.x = Math.cos(a * 4) * rad;
        m.position.y = Math.sin(a * 4) * rad;
        m.position.z = Math.cos(a * 0.5) * amp * 0.6;
        m.rotation.y = ry + a * 2;
        break;
      }
      case 'float':
        m.position.y = Math.sin(t * sp) * amp * 0.25;
        m.rotation.y = ry + Math.sin(t * sp * 0.4) * 0.4;
        break;
      case 'none':
      default:
        break;
    }
  }

  // --- Dither bridge -------------------------------------------------------

  private ditherInto(pg: any, pr: Record<string, any>, dx = 0, dy = 0): void {
    if (!this.tmpCanvas) this.tmpCanvas = document.createElement('canvas');
    const tmp = this.tmpCanvas;
    tmp.width = this.w;
    tmp.height = this.h;
    const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
    tctx.clearRect(0, 0, this.w, this.h);
    tctx.drawImage(this.glCanvas!, 0, 0);

    const id = tctx.getImageData(0, 0, this.w, this.h);
    const alpha = new Uint8ClampedArray(this.w * this.h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = id.data[i * 4 + 3];

    const out = applyDither(id, this.w, this.h, {
      ditherType: pr.ditherType,
      threshold: pr.threshold,
      contrast: 1.1,
      brightness: 0,
      invert: false,
      foregroundColor: pr.ditherFg,
      backgroundColor: pr.ditherBg,
      colorMode: pr.ditherColorMode,
      ditherScale: pr.ditherScale,
      posterization: 256,
      saturation: 1,
    });

    // Restore the silhouette's alpha so the layer stays transparent around it.
    const result = id;
    for (let i = 0; i < alpha.length; i++) {
      const o = i * 4;
      result.data[o] = out[o];
      result.data[o + 1] = out[o + 1];
      result.data[o + 2] = out[o + 2];
      result.data[o + 3] = alpha[i];
    }
    tctx.putImageData(result, 0, 0);

    const ctx = pg.drawingContext as CanvasRenderingContext2D;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, dx, dy, pg.width, pg.height);
    ctx.restore();
  }

  // --- Draw ----------------------------------------------------------------

  draw(pg: p5.Graphics, _p: p5, time: number, params: Record<string, any>): void {
    pg.clear();
    if (!this.ready || !this.renderer) return;

    this.sync(params);
    this.animate(params, time);
    this.camera.position.z = this.baseDist / (params.zoom ?? 1);

    // Background: transparent (overlay) or solid colour (full-frame hero).
    const solid = params.background === 'solid';
    this.renderer.setClearColor(new this.THREE.Color(params.bgColor || '#0a0a0a'), solid ? 1 : 0);

    if (params.post && this.composer) {
      if (this.bloomPass) this.bloomPass.strength = params.bloom ?? 0.7;
      if (this.fxPass) {
        this.fxPass.uniforms.uChroma.value = params.chroma ?? 0.15;
        this.fxPass.uniforms.uGrain.value = params.grain ?? 0.12;
        this.fxPass.uniforms.uVignette.value = params.vignette ?? 0.3;
        this.fxPass.uniforms.uTime.value = time;
      }
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // Canvas position offset (drag): shift the rendered frame.
    const dx = ((params.posX ?? 0.5) - 0.5) * pg.width;
    const dy = ((params.posY ?? 0.5) - 0.5) * pg.height;

    if (params.dither) {
      this.ditherInto(pg, params, dx, dy);
    } else {
      const ctx = pg.drawingContext as CanvasRenderingContext2D;
      ctx.drawImage(this.glCanvas!, dx, dy, pg.width, pg.height);
    }
  }

  dispose(): void {
    try {
      this.mesh?.geometry?.dispose?.();
      this.mesh?.material?.dispose?.();
      this.imageTex?.dispose?.();
      this.maskTex?.dispose?.();
      this.envTexture?.dispose?.();
      this.composer?.dispose?.();
      this.renderer?.dispose?.();
      this.renderer?.forceContextLoss?.();
    } catch {
      /* noop */
    }
    this.THREE = null;
    this.renderer = null;
    this.scene = null;
    this.mesh = null;
    this.glCanvas = null;
    this.tmpCanvas = null;
    this.ready = false;
  }
}
