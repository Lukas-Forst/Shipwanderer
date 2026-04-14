import {
  BoxGeometry,
  CanvasTexture,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Vector2,
  Vector3,
} from "three";
import { Enemy } from "../systems/EnemyManager";
import type { VisualMode } from "../systems/AssetManager";
import { Projectile } from "./Projectile";
import { ProceduralLayerGenerator } from "../visuals/ProceduralLayerGenerator";

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

  public constructor(hullModel: Object3D, cannonModel: Object3D, visualMode: VisualMode) {
    this.stackGroup.name = "stackGroup";
    if (visualMode === "sprite") {
      this.buildProceduralStack();
      this.stackGroup.rotation.y = this.visualYawOffset;
      this.mesh.add(this.stackGroup);
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

  private createHullPiece(): Group {
    const geometry = new BoxGeometry(2, 0.9, 2);
    const material = new MeshStandardMaterial({ color: 0x6b5b4d });
    const mesh = new Mesh(geometry, material);
    mesh.position.y = 0.5;

    const group = new Group();
    group.add(mesh);
    return group;
  }

  private buildProceduralStack(): void {
    const totalLayers = 12;
    const dy = 0.045;
    for (let index = 0; index < totalLayers; index += 1) {
      const canvas = this.layerGenerator.generateLayerCanvas(index, totalLayers, "hull");
      const layer = this.createStackLayer(canvas, index, index * dy);
      layer.rotation.x = -Math.PI / 2;
      this.stackGroup.add(layer);
    }

    // Keep the hull broad in X/Z but compress Y to avoid a tower-like silhouette.
    this.stackGroup.scale.set(3.25, 0.9, 3.25);
  }

  private createStackLayer(canvas: HTMLCanvasElement, renderOrder: number, y: number): Mesh {
    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      alphaTest: 0.05,
    });

    const layer = new Mesh(new PlaneGeometry(1, 1), material);
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
