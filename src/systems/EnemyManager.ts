import { Object3D, Scene, Vector3 } from "three";
import { AssetManager } from "./AssetManager";

export class Enemy {
  public readonly mesh: Object3D;
  public speed = 2.4;

  public constructor(mesh: Object3D) {
    this.mesh = mesh;
  }
}

export class EnemyManager {
  private readonly enemies: Enemy[] = [];
  private enemySpawnTimer = 0;
  private enemySpawnCooldown = 1.8;
  private enemyTemplate: Object3D | null = null;

  public constructor(
    private readonly scene: Scene,
    private readonly assetManager: AssetManager,
    private readonly worldHalfSize: number,
  ) {}

  public async initialize(): Promise<void> {
    this.enemyTemplate = await this.assetManager.createEnemy();
  }

  public getAll(): Enemy[] {
    return [...this.enemies];
  }

  public update(
    deltaSeconds: number,
    playerPosition: Vector3,
    cameraHalfWidth: number,
    cameraHalfHeight: number,
  ): void {
    this.enemySpawnTimer += deltaSeconds;
    if (this.enemySpawnTimer >= this.enemySpawnCooldown) {
      this.enemySpawnTimer = 0;
      this.spawnOutsideView(playerPosition, cameraHalfWidth, cameraHalfHeight);
    }

    for (const enemy of this.enemies) {
      const direction = new Vector3().subVectors(playerPosition, enemy.mesh.position).setY(0);
      if (direction.lengthSq() > 0.01) {
        direction.normalize();
        enemy.mesh.position.addScaledVector(direction, enemy.speed * deltaSeconds);
        enemy.mesh.lookAt(playerPosition.x, enemy.mesh.position.y, playerPosition.z);
      }
    }
  }

  public remove(enemy: Enemy): void {
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) {
      this.enemies.splice(index, 1);
      this.scene.remove(enemy.mesh);
    }
  }

  public clear(): void {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
    }
    this.enemies.length = 0;
  }

  private spawnOutsideView(playerPosition: Vector3, cameraHalfWidth: number, cameraHalfHeight: number): void {
    const margin = 6;
    const side = Math.floor(Math.random() * 4);
    let x = playerPosition.x;
    let z = playerPosition.z;
    if (side === 0) {
      x = playerPosition.x - cameraHalfWidth - margin;
      z = playerPosition.z + (Math.random() - 0.5) * cameraHalfHeight * 2.2;
    } else if (side === 1) {
      x = playerPosition.x + cameraHalfWidth + margin;
      z = playerPosition.z + (Math.random() - 0.5) * cameraHalfHeight * 2.2;
    } else if (side === 2) {
      z = playerPosition.z - cameraHalfHeight - margin;
      x = playerPosition.x + (Math.random() - 0.5) * cameraHalfWidth * 2.2;
    } else {
      z = playerPosition.z + cameraHalfHeight + margin;
      x = playerPosition.x + (Math.random() - 0.5) * cameraHalfWidth * 2.2;
    }

    const clampedX = Math.max(-this.worldHalfSize + 2, Math.min(this.worldHalfSize - 2, x));
    const clampedZ = Math.max(-this.worldHalfSize + 2, Math.min(this.worldHalfSize - 2, z));
    const mesh = this.enemyTemplate ? this.enemyTemplate.clone(true) : null;
    if (!mesh) {
      return;
    }

    mesh.position.set(clampedX, 0, clampedZ);
    const enemy = new Enemy(mesh);
    this.enemies.push(enemy);
    this.scene.add(mesh);
  }
}
