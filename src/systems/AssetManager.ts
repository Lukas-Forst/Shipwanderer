import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SpriteStackFactory } from "../visuals/SpriteStackFactory";

const MODEL_PATHS = {
  hull: "/models/hull.glb",
  cannon: "/models/cannon.glb",
  enemy: "/models/enemy.glb",
} as const;

export type VisualMode = "sprite" | "model";
const VISUAL_MODE_STORAGE_KEY = "sea-wanderer-visual-mode";

export class AssetManager {
  private readonly loader = new GLTFLoader();
  private readonly spriteStackFactory = new SpriteStackFactory();
  private readonly cache = new Map<string, Object3D | null>();
  private readonly visualMode: VisualMode = this.resolveVisualMode();

  public getVisualMode(): VisualMode {
    return this.visualMode;
  }

  public toggleVisualMode(): VisualMode {
    const next: VisualMode = this.visualMode === "sprite" ? "model" : "sprite";
    localStorage.setItem(VISUAL_MODE_STORAGE_KEY, next);
    return next;
  }

  public async createHull(): Promise<Object3D> {
    if (this.visualMode === "sprite") {
      return this.spriteStackFactory.createShipStack();
    }

    const model = await this.loadModel(MODEL_PATHS.hull);
    if (model) {
      model.scale.setScalar(1.5);
      return model;
    }

    const fallback = this.createFallbackBox(0x5b4a3b, 3, 1, 3);
    fallback.position.y = 0.5;
    return fallback;
  }

  public async createCannon(): Promise<Object3D> {
    const model = await this.loadModel(MODEL_PATHS.cannon);
    if (model) {
      model.scale.setScalar(0.9);
      return model;
    }

    const fallback = this.createFallbackBox(0x3d3d3d, 0.45, 0.45, 0.85);
    fallback.position.y = 1.2;
    return fallback;
  }

  public async createEnemy(): Promise<Object3D> {
    if (this.visualMode === "sprite") {
      return this.spriteStackFactory.createEnemyStack();
    }

    const model = await this.loadModel(MODEL_PATHS.enemy);
    if (model) {
      model.scale.setScalar(1.1);
      return model;
    }

    const fallback = this.createFallbackBox(0xb32020, 1.4, 1.4, 1.4);
    fallback.position.y = 0.7;
    return fallback;
  }

  private async loadModel(path: string): Promise<Object3D | null> {
    if (this.cache.has(path)) {
      const cached = this.cache.get(path);
      return cached ? cached.clone(true) : null;
    }

    try {
      const gltf = await this.loader.loadAsync(path);
      const scene = gltf.scene.clone(true);
      this.cache.set(path, scene.clone(true));
      return scene;
    } catch {
      this.cache.set(path, null);
      return null;
    }
  }

  private createFallbackBox(color: number, width: number, height: number, depth: number): Group {
    const geometry = new BoxGeometry(width, height, depth);
    const material = new MeshStandardMaterial({ color });
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const group = new Group();
    group.add(mesh);
    return group;
  }

  private resolveVisualMode(): VisualMode {
    const stored = localStorage.getItem(VISUAL_MODE_STORAGE_KEY);
    if (stored === "sprite" || stored === "model") {
      return stored;
    }

    const queryMode = new URLSearchParams(window.location.search).get("visual");
    if (queryMode === "sprite" || queryMode === "model") {
      localStorage.setItem(VISUAL_MODE_STORAGE_KEY, queryMode);
      return queryMode;
    }

    const defaultMode: VisualMode = "sprite";
    localStorage.setItem(VISUAL_MODE_STORAGE_KEY, defaultMode);
    return defaultMode;
  }
}
