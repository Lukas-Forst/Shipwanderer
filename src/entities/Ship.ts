import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
} from "three";
import { Enemy } from "../systems/EnemyManager";
import type { EnemyVisualStylePreset } from "../systems/EnemyManager";
import type { VisualMode } from "../systems/AssetManager";
import { Projectile } from "./Projectile";
import { ProceduralLayerGenerator } from "../visuals/ProceduralLayerGenerator";
import { buildStackTexturesFromSheet, getPlayerShipStackCells } from "../visuals/shipSpriteSheet";
import type { ShipStackSliceSource } from "../visuals/shipTileStack";

export type ShipSpriteOptions = {
  /**
   * Full-size slice PNGs (`public/ship/tile000.png`, …) bottom → top.
   * Takes precedence over `sheetImage` when at least three valid slices load.
   */
  stackSliceImages?: ShipStackSliceSource[] | null;
  /** Combined sprite sheet (`public/sprites/player_ship_stack.png`) if no tile slices. */
  sheetImage?: HTMLImageElement | null;
  /** Inserts sheet row 2 between hull and cabin for a thicker hull (see `?doubleHull=1`). */
  includeAltHullRow?: boolean;
};

type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export class Ship {
  public readonly mesh = new Group();
  public readonly velocity = new Vector3();
  public readonly splashAnchor = new Vector3();
  public readonly stackGroup = new Group();
  private readonly detailGroup = new Group();

  private readonly input: InputState = { up: false, down: false, left: false, right: false };
  private readonly acceleration = 28;
  private readonly maxSpeed = 14;
  private readonly drag = 3.1;
  private readonly tmpDirection = new Vector2();
  private readonly tmpAimDirection = new Vector3();
  private readonly tmpMoveDirection = new Vector3();
  private readonly spawnOffset = new Vector3(0, 0.8, 0);
  private readonly splashOffset = new Vector3(0, 0.15, 0);
  private readonly hullOffsets: Vector3[] = [
    new Vector3(0, 0, 0),
    new Vector3(2.5, 0, 0),
    new Vector3(-2.5, 0, 0),
    new Vector3(0, 0, 2.5),
    new Vector3(0, 0, -2.5),
  ];

  private fireCooldown = 1.5;
  private fireTimer = 0;
  private targetRadius = 30;
  private maxHp = 100;
  private hp = 100;
  private hullPiecesPlaced = 0;
  private stackFloatTime = 0;
  private readonly stackBaseY = 0.2;
  private readonly layerGenerator = new ProceduralLayerGenerator();
  private readonly visualYawOffset = Math.PI / 2;
  /** GPU textures we created for the stack (tiles or cropped sheet); disposed in `dispose`. */
  private readonly stackOwnedTextures: Texture[] = [];
  private hullShadow: Mesh | null = null;
  private readonly spriteDetailMeshes: Mesh[] = [];
  private visualMode: VisualMode;

  public constructor(
    hullModel: Object3D,
    cannonModel: Object3D,
    visualMode: VisualMode,
    private readonly spriteOptions: ShipSpriteOptions = {},
  ) {
    this.visualMode = visualMode;
    this.stackGroup.name = "stackGroup";
    if (visualMode === "sprite") {
      const slices = this.spriteOptions.stackSliceImages ?? null;
      if (slices && slices.length >= 3) {
        this.buildStackFromSliceImages(slices);
      } else {
        const sheet = this.spriteOptions.sheetImage ?? null;
        if (sheet) {
          const cells = getPlayerShipStackCells(this.spriteOptions.includeAltHullRow ?? false);
          this.buildSpriteSheetStack(sheet, cells);
        } else {
          this.buildProceduralStack();
        }
      }
      this.detailGroup.name = "detailGroup";
      this.stackGroup.rotation.y = this.visualYawOffset;
      this.detailGroup.rotation.y = this.visualYawOffset;
      this.mesh.add(this.stackGroup);
      this.mesh.add(this.detailGroup);
      this.addSpriteDeckDetails();
      this.hullShadow = this.addHullShadow();
      this.mesh.position.y = this.stackBaseY;
    } else {
      this.mesh.add(hullModel);
      cannonModel.position.set(0, 0.6, 0.35);
      this.mesh.add(cannonModel);
      this.mesh.position.y = 0.2;
    }

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.disposeOwnedStackLayers();
    this.disposeSpriteExtras();
  }

  public update(deltaSeconds: number, moveForward: Vector3, moveRight: Vector3): void {
    this.fireTimer += deltaSeconds;
    this.stackFloatTime += deltaSeconds;

    this.tmpDirection.set(0, 0);
    if (this.input.up) this.tmpDirection.y += 1;
    if (this.input.down) this.tmpDirection.y -= 1;
    if (this.input.left) this.tmpDirection.x -= 1;
    if (this.input.right) this.tmpDirection.x += 1;

    if (this.tmpDirection.lengthSq() > 0) {
      this.tmpDirection.normalize();
      this.tmpMoveDirection
        .copy(moveRight)
        .multiplyScalar(this.tmpDirection.x)
        .addScaledVector(moveForward, this.tmpDirection.y);

      if (this.tmpMoveDirection.lengthSq() > 0.0001) {
        this.tmpMoveDirection.normalize();
        this.velocity.addScaledVector(this.tmpMoveDirection, this.acceleration * deltaSeconds);
      }
    }

    const dragScale = Math.exp(-this.drag * deltaSeconds);
    this.velocity.multiplyScalar(dragScale);

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > this.maxSpeed) {
      const ratio = this.maxSpeed / horizontalSpeed;
      this.velocity.x *= ratio;
      this.velocity.z *= ratio;
    }

    this.mesh.position.addScaledVector(this.velocity, deltaSeconds);

    if (horizontalSpeed > 0.1) {
      const targetRotation = Math.atan2(this.velocity.x, this.velocity.z) + this.visualYawOffset;
      if (this.stackGroup.children.length > 0) {
        this.stackGroup.rotation.y = MathUtils.lerp(this.stackGroup.rotation.y, targetRotation, 0.15);
        // Keep detail meshes locked to the same yaw as the sprite stack.
        this.detailGroup.rotation.y = this.stackGroup.rotation.y;
      } else {
        this.mesh.rotation.y = MathUtils.lerp(this.mesh.rotation.y, targetRotation, 0.15);
      }
    }

    if (this.stackGroup.children.length > 0) {
      this.stackGroup.position.y = Math.sin(this.stackFloatTime * 2.1) * 0.02;
    }

    this.splashAnchor.copy(this.mesh.position).add(this.splashOffset);
  }

  public findShot(enemies: Enemy[]): Projectile | null {
    if (this.fireTimer < this.fireCooldown) {
      return null;
    }

    let nearestEnemy: Enemy | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of enemies) {
      const distance = enemy.mesh.position.distanceTo(this.mesh.position);
      if (distance <= this.targetRadius && distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    }

    if (!nearestEnemy) {
      return null;
    }

    this.fireTimer = 0;
    const direction = this.tmpAimDirection
      .subVectors(nearestEnemy.mesh.position, this.mesh.position)
      .setY(0)
      .normalize()
      .clone();
    const spawnPosition = this.mesh.position.clone().add(this.spawnOffset);
    return new Projectile(spawnPosition, direction);
  }

  public applyRapidFireUpgrade(): void {
    this.fireCooldown *= 0.8;
  }

  public applyLongRangeUpgrade(): void {
    this.targetRadius *= 1.3;
  }

  public applyHeavyHullUpgrade(): void {
    if (this.hullPiecesPlaced >= this.hullOffsets.length - 1) {
      this.maxHp += 10;
      this.hp = Math.min(this.hp + 10, this.maxHp);
      return;
    }

    this.hullPiecesPlaced += 1;
    const offset = this.hullOffsets[this.hullPiecesPlaced];
    const extraHull = this.createHullPiece();
    extraHull.position.copy(offset);
    this.mesh.add(extraHull);
    this.maxHp += 25;
    this.hp = Math.min(this.hp + 25, this.maxHp);
  }

  public takeHit(damage: number): void {
    this.hp = Math.max(0, this.hp - damage);
  }

  public getSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  public applyVisualStyle(style: EnemyVisualStylePreset): void {
    const preset =
      style === "clean"
        ? { tint: 0xf2efe9, emissive: 0x14181f, emissiveIntensity: 0.03, roughness: 0.52, metalness: 0.2 }
        : style === "stormy"
          ? { tint: 0xb6c0cc, emissive: 0x0b1723, emissiveIntensity: 0.13, roughness: 0.74, metalness: 0.16 }
          : { tint: 0xd3c0ad, emissive: 0x12151d, emissiveIntensity: 0.07, roughness: 0.64, metalness: 0.2 };

    const targets = this.visualMode === "sprite" ? [this.stackGroup, this.detailGroup] : [this.mesh];
    for (const target of targets) {
      target.traverse((child) => {
        const childMesh = child as Mesh;
        if (!("material" in childMesh)) {
          return;
        }
        const mat = childMesh.material;
        const materials = Array.isArray(mat) ? mat : [mat];
        for (const material of materials) {
          if (!(material instanceof MeshStandardMaterial)) {
            continue;
          }
          material.color.setHex(preset.tint);
          material.emissive.setHex(preset.emissive);
          material.emissiveIntensity = preset.emissiveIntensity;
          material.roughness = preset.roughness;
          material.metalness = preset.metalness;
        }
      });
    }
  }

  private createHullPiece(): Group {
    const geometry = new BoxGeometry(2, 0.9, 2);
    const material = new MeshStandardMaterial({ color: 0x6b5b4d });
    const mesh = new Mesh(geometry, material);
    mesh.position.y = 0.5;

    const group = new Group();
    group.add(mesh);
    return group;
  }

  private addSpriteDeckDetails(): void {
    const funnelMaterial = new MeshStandardMaterial({ color: 0x252b37, roughness: 0.7, metalness: 0.16 });
    const brassMaterial = new MeshStandardMaterial({ color: 0x956a3f, roughness: 0.52, metalness: 0.32 });
    const cabinMaterial = new MeshStandardMaterial({ color: 0xb19678, roughness: 0.82, metalness: 0.04 });
    const plateMaterial = new MeshStandardMaterial({ color: 0x3e434d, roughness: 0.66, metalness: 0.26 });

    const rearFunnel = new Mesh(new CylinderGeometry(0.12, 0.16, 0.68, 10), funnelMaterial);
    rearFunnel.position.set(-0.38, 0.82, 0.1);
    this.detailGroup.add(rearFunnel);
    this.spriteDetailMeshes.push(rearFunnel);

    const frontFunnel = new Mesh(new CylinderGeometry(0.1, 0.14, 0.58, 10), funnelMaterial);
    frontFunnel.position.set(0.3, 0.7, -0.2);
    this.detailGroup.add(frontFunnel);
    this.spriteDetailMeshes.push(frontFunnel);

    const cabin = new Mesh(new BoxGeometry(0.5, 0.2, 0.36), cabinMaterial);
    cabin.scale.set(1.4, 1, 1.2);
    cabin.position.set(-0.04, 0.56, 0.06);
    this.detailGroup.add(cabin);
    this.spriteDetailMeshes.push(cabin);

    const roof = new Mesh(new BoxGeometry(0.42, 0.08, 0.3), brassMaterial);
    roof.position.set(-0.04, 0.7, 0.06);
    this.detailGroup.add(roof);
    this.spriteDetailMeshes.push(roof);

    const sidePlateLeft = new Mesh(new BoxGeometry(0.06, 0.3, 0.42), plateMaterial);
    sidePlateLeft.position.set(-0.9, 0.5, 0.06);
    this.detailGroup.add(sidePlateLeft);
    this.spriteDetailMeshes.push(sidePlateLeft);

    const sidePlateRight = new Mesh(new BoxGeometry(0.06, 0.3, 0.42), plateMaterial);
    sidePlateRight.position.set(0.9, 0.5, 0.06);
    this.detailGroup.add(sidePlateRight);
    this.spriteDetailMeshes.push(sidePlateRight);
  }

  private addHullShadow(): Mesh {
    const geometry = new PlaneGeometry(3.2, 2);
    const material = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const shadow = new Mesh(geometry, material);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.04;
    this.mesh.add(shadow);
    return shadow;
  }

  private buildProceduralStack(): void {
    const totalLayers = 16;
    const dy = 0.065;
    for (let index = 0; index < totalLayers; index += 1) {
      const canvas = this.layerGenerator.generateLayerCanvas(index, totalLayers, "hull");
      const layer = this.createStackLayer(canvas, index, index * dy);
      layer.rotation.x = -Math.PI / 2;
      this.stackGroup.add(layer);
    }

    // Keep the hull broad in X/Z but compress Y to avoid a tower-like silhouette.
    this.stackGroup.scale.set(3.25, 0.9, 3.25);
  }

  private buildStackFromSliceImages(slices: ShipStackSliceSource[]): void {
    const layerCount = slices.length;
    // Push more vertical separation for lower slice counts so ships do not read as flat pancakes.
    const dy = layerCount >= 22 ? 0.025 : layerCount >= 18 ? 0.033 : layerCount >= 14 ? 0.044 : 0.052;

    for (let i = 0; i < layerCount; i += 1) {
      const image = slices[i];
      const texture = new Texture(image);
      texture.format = RGBAFormat;
      texture.colorSpace = SRGBColorSpace;
      texture.magFilter = NearestFilter;
      texture.minFilter = NearestFilter;
      texture.premultiplyAlpha = false;
      texture.needsUpdate = true;
      this.stackOwnedTextures.push(texture);

      const iw = image instanceof HTMLCanvasElement ? image.width : image.naturalWidth;
      const ih = image instanceof HTMLCanvasElement ? image.height : image.naturalHeight;
      const aspect = iw / Math.max(1, ih);
      const layer = this.createStackLayerFromTexture(texture, i, i * dy, aspect);
      layer.rotation.x = -Math.PI / 2;
      this.stackGroup.add(layer);
    }

    const yScale = layerCount >= 22 ? 0.62 : layerCount >= 18 ? 0.72 : layerCount >= 14 ? 0.84 : 0.92;
    this.stackGroup.scale.set(2.75, yScale, 2.75);
  }

  private buildSpriteSheetStack(
    image: HTMLImageElement,
    cells: readonly (readonly [number, number])[],
  ): void {
    const textures = buildStackTexturesFromSheet(image, cells);
    this.stackOwnedTextures.push(...textures);

    const layerCount = textures.length;
    // Slightly larger stepping improves depth cues while preserving overall hull height with y-scale.
    const dy = layerCount >= 20 ? 0.032 : layerCount >= 15 ? 0.04 : 0.05;

    for (let i = 0; i < layerCount; i += 1) {
      const texture = textures[i];
      const canvas = texture.image as HTMLCanvasElement;
      const aspect = canvas.width / Math.max(1, canvas.height);
      const layer = this.createStackLayerFromTexture(texture, i, i * dy, aspect);
      layer.rotation.x = -Math.PI / 2;
      this.stackGroup.add(layer);
    }

    const yScale = layerCount >= 20 ? 0.7 : layerCount >= 15 ? 0.79 : 0.88;
    this.stackGroup.scale.set(3.05, yScale, 3.05);
  }

  private disposeOwnedStackLayers(): void {
    if (this.stackGroup.children.length === 0) {
      return;
    }

    for (const child of this.stackGroup.children) {
      const mesh = child as Mesh;
      const geometry = mesh.geometry as PlaneGeometry | undefined;
      const material = mesh.material as MeshStandardMaterial | undefined;
      geometry?.dispose();
      if (material) {
        const map = material.map;
        if (map) {
          material.map = null;
          map.dispose();
        }
        material.dispose();
      }
    }
    this.stackGroup.clear();
    this.stackOwnedTextures.length = 0;
  }

  private disposeSpriteExtras(): void {
    if (this.hullShadow) {
      this.mesh.remove(this.hullShadow);
      const shadowGeometry = this.hullShadow.geometry;
      const shadowMaterial = this.hullShadow.material;
      shadowGeometry.dispose();
      if (Array.isArray(shadowMaterial)) {
        for (const material of shadowMaterial) {
          material.dispose();
        }
      } else {
        shadowMaterial.dispose();
      }
      this.hullShadow = null;
    }

    if (this.spriteDetailMeshes.length === 0) {
      return;
    }

    const disposedMaterials = new Set<MeshStandardMaterial>();
    for (const detail of this.spriteDetailMeshes) {
      this.detailGroup.remove(detail);
      detail.geometry.dispose();
      const material = detail.material as MeshStandardMaterial;
      if (!disposedMaterials.has(material)) {
        material.dispose();
        disposedMaterials.add(material);
      }
    }
    this.detailGroup.clear();
    this.spriteDetailMeshes.length = 0;
  }

  private createStackLayer(canvas: HTMLCanvasElement, renderOrder: number, y: number): Mesh {
    const texture = new CanvasTexture(canvas);
    texture.format = RGBAFormat;
    texture.needsUpdate = true;

    const material = new MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      alphaTest: 0.5,
      side: DoubleSide,
      premultipliedAlpha: false,
    });

    const layer = new Mesh(new PlaneGeometry(1, 1), material);
    layer.position.y = y;
    layer.renderOrder = renderOrder;
    return layer;
  }

  private createStackLayerFromTexture(
    texture: Texture,
    renderOrder: number,
    y: number,
    aspect: number,
  ): Mesh {
    const material = new MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      alphaTest: 0.5,
      side: DoubleSide,
      premultipliedAlpha: false,
    });

    const layer = new Mesh(new PlaneGeometry(aspect, 1), material);
    layer.position.y = y;
    layer.renderOrder = renderOrder;
    return layer;
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.code === "KeyW" || event.code === "ArrowUp") this.input.up = true;
    if (event.code === "KeyS" || event.code === "ArrowDown") this.input.down = true;
    if (event.code === "KeyA" || event.code === "ArrowLeft") this.input.left = true;
    if (event.code === "KeyD" || event.code === "ArrowRight") this.input.right = true;
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (event.code === "KeyW" || event.code === "ArrowUp") this.input.up = false;
    if (event.code === "KeyS" || event.code === "ArrowDown") this.input.down = false;
    if (event.code === "KeyA" || event.code === "ArrowLeft") this.input.left = false;
    if (event.code === "KeyD" || event.code === "ArrowRight") this.input.right = false;
  }
}
