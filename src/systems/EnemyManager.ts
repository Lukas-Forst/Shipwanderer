import { Mesh, MeshStandardMaterial, Object3D, Scene, Vector3 } from "three";
import { AssetManager } from "./AssetManager";

type EnemyBehavior = "direct" | "strafe" | "retreat" | "siege" | "charge";
type EnemyArchetypeId = "patrol" | "skirmisher" | "raider" | "smoke-runner" | "warship" | "elite";
export type EnemyVisualStylePreset = "industrial" | "clean" | "stormy";

type EnemyArchetype = {
  id: EnemyArchetypeId;
  speed: number;
  maxHp: number;
  collisionDamage: number;
  scale: number;
  behavior: EnemyBehavior;
  canShoot: boolean;
  fireCooldown: number;
  preferredRange: number;
  projectileSpeed: number;
  projectileLifeSeconds: number;
  projectileDamage: number;
  projectileColor: number;
  projectileRadius: number;
};

type SpawnDirectorPhase = {
  startsAtMinute: number;
  spawnCooldown: number;
  maxAlive: number;
  burstMin: number;
  burstMax: number;
  table: ReadonlyArray<{ archetype: EnemyArchetypeId; weight: number }>;
};

const ARCHETYPES: Record<EnemyArchetypeId, EnemyArchetype> = {
  patrol: {
    id: "patrol",
    speed: 2.2,
    maxHp: 1,
    collisionDamage: 5,
    scale: 0.95,
    behavior: "direct",
    canShoot: false,
    fireCooldown: 99,
    preferredRange: 0,
    projectileSpeed: 0,
    projectileLifeSeconds: 0,
    projectileDamage: 0,
    projectileColor: 0x000000,
    projectileRadius: 0.1,
  },
  skirmisher: {
    id: "skirmisher",
    speed: 2.6,
    maxHp: 1,
    collisionDamage: 6,
    scale: 1.0,
    behavior: "strafe",
    canShoot: true,
    fireCooldown: 2.1,
    preferredRange: 13,
    projectileSpeed: 18,
    projectileLifeSeconds: 2.2,
    projectileDamage: 4,
    projectileColor: 0x6f2f14,
    projectileRadius: 0.16,
  },
  raider: {
    id: "raider",
    speed: 2.9,
    maxHp: 2,
    collisionDamage: 8,
    scale: 1.08,
    behavior: "strafe",
    canShoot: true,
    fireCooldown: 1.75,
    preferredRange: 14,
    projectileSpeed: 20,
    projectileLifeSeconds: 2.5,
    projectileDamage: 6,
    projectileColor: 0x822816,
    projectileRadius: 0.17,
  },
  "smoke-runner": {
    id: "smoke-runner",
    speed: 3.25,
    maxHp: 2,
    collisionDamage: 7,
    scale: 1.0,
    behavior: "retreat",
    canShoot: true,
    fireCooldown: 2.4,
    preferredRange: 16,
    projectileSpeed: 21,
    projectileLifeSeconds: 2.6,
    projectileDamage: 5,
    projectileColor: 0x4a4a4a,
    projectileRadius: 0.15,
  },
  warship: {
    id: "warship",
    speed: 2.45,
    maxHp: 4,
    collisionDamage: 12,
    scale: 1.2,
    behavior: "siege",
    canShoot: true,
    fireCooldown: 1.35,
    preferredRange: 17,
    projectileSpeed: 22,
    projectileLifeSeconds: 2.8,
    projectileDamage: 8,
    projectileColor: 0x2c2c2c,
    projectileRadius: 0.2,
  },
  elite: {
    id: "elite",
    speed: 2.8,
    maxHp: 6,
    collisionDamage: 15,
    scale: 1.32,
    behavior: "charge",
    canShoot: true,
    fireCooldown: 1.05,
    preferredRange: 18,
    projectileSpeed: 24,
    projectileLifeSeconds: 3.0,
    projectileDamage: 10,
    projectileColor: 0x9d1f1f,
    projectileRadius: 0.22,
  },
};

const PHASES: readonly SpawnDirectorPhase[] = [
  {
    startsAtMinute: 0,
    spawnCooldown: 1.7,
    maxAlive: 8,
    burstMin: 1,
    burstMax: 1,
    table: [
      { archetype: "patrol", weight: 0.85 },
      { archetype: "skirmisher", weight: 0.15 },
    ],
  },
  {
    startsAtMinute: 10,
    spawnCooldown: 1.45,
    maxAlive: 10,
    burstMin: 1,
    burstMax: 1,
    table: [
      { archetype: "patrol", weight: 0.5 },
      { archetype: "skirmisher", weight: 0.5 },
    ],
  },
  {
    startsAtMinute: 20,
    spawnCooldown: 1.25,
    maxAlive: 12,
    burstMin: 1,
    burstMax: 2,
    table: [
      { archetype: "skirmisher", weight: 0.35 },
      { archetype: "raider", weight: 0.5 },
      { archetype: "smoke-runner", weight: 0.15 },
    ],
  },
  {
    startsAtMinute: 30,
    spawnCooldown: 1.05,
    maxAlive: 14,
    burstMin: 1,
    burstMax: 2,
    table: [
      { archetype: "raider", weight: 0.55 },
      { archetype: "smoke-runner", weight: 0.25 },
      { archetype: "warship", weight: 0.2 },
    ],
  },
  {
    startsAtMinute: 40,
    spawnCooldown: 0.9,
    maxAlive: 16,
    burstMin: 2,
    burstMax: 2,
    table: [
      { archetype: "raider", weight: 0.3 },
      { archetype: "warship", weight: 0.55 },
      { archetype: "elite", weight: 0.15 },
    ],
  },
  {
    startsAtMinute: 50,
    spawnCooldown: 0.75,
    maxAlive: 18,
    burstMin: 2,
    burstMax: 3,
    table: [
      { archetype: "smoke-runner", weight: 0.2 },
      { archetype: "warship", weight: 0.5 },
      { archetype: "elite", weight: 0.3 },
    ],
  },
];

const ENEMY_VISUAL_STYLE: Record<
  EnemyVisualStylePreset,
  Record<EnemyArchetypeId, { tint: number; emissive: number; emissiveIntensity: number; roughness: number; metalness: number }>
> = {
  industrial: {
    patrol: { tint: 0x7f4d36, emissive: 0x140806, emissiveIntensity: 0.08, roughness: 0.9, metalness: 0.05 },
    skirmisher: { tint: 0x8d5138, emissive: 0x1c0907, emissiveIntensity: 0.1, roughness: 0.82, metalness: 0.1 },
    raider: { tint: 0x933b2d, emissive: 0x240907, emissiveIntensity: 0.14, roughness: 0.76, metalness: 0.16 },
    "smoke-runner": { tint: 0x5d5f63, emissive: 0x111419, emissiveIntensity: 0.12, roughness: 0.7, metalness: 0.22 },
    warship: { tint: 0x4f4540, emissive: 0x1a1311, emissiveIntensity: 0.16, roughness: 0.62, metalness: 0.32 },
    elite: { tint: 0x8a2a24, emissive: 0x290d0a, emissiveIntensity: 0.26, roughness: 0.56, metalness: 0.38 },
  },
  clean: {
    patrol: { tint: 0x8f6f58, emissive: 0x17100b, emissiveIntensity: 0.05, roughness: 0.78, metalness: 0.08 },
    skirmisher: { tint: 0xa07254, emissive: 0x21150f, emissiveIntensity: 0.06, roughness: 0.72, metalness: 0.12 },
    raider: { tint: 0xad6452, emissive: 0x2a1411, emissiveIntensity: 0.08, roughness: 0.66, metalness: 0.18 },
    "smoke-runner": { tint: 0x73808f, emissive: 0x101823, emissiveIntensity: 0.08, roughness: 0.58, metalness: 0.28 },
    warship: { tint: 0x6b6760, emissive: 0x1a1814, emissiveIntensity: 0.1, roughness: 0.52, metalness: 0.36 },
    elite: { tint: 0xb34a3f, emissive: 0x341814, emissiveIntensity: 0.14, roughness: 0.48, metalness: 0.42 },
  },
  stormy: {
    patrol: { tint: 0x5c4842, emissive: 0x090c14, emissiveIntensity: 0.1, roughness: 0.92, metalness: 0.06 },
    skirmisher: { tint: 0x674944, emissive: 0x0c1019, emissiveIntensity: 0.13, roughness: 0.86, metalness: 0.1 },
    raider: { tint: 0x6e403d, emissive: 0x13111b, emissiveIntensity: 0.16, roughness: 0.8, metalness: 0.16 },
    "smoke-runner": { tint: 0x4d5664, emissive: 0x0d1622, emissiveIntensity: 0.16, roughness: 0.76, metalness: 0.24 },
    warship: { tint: 0x45464f, emissive: 0x111923, emissiveIntensity: 0.2, roughness: 0.68, metalness: 0.34 },
    elite: { tint: 0x6d2d37, emissive: 0x221126, emissiveIntensity: 0.32, roughness: 0.6, metalness: 0.4 },
  },
};

export class Enemy {
  public readonly mesh: Object3D;
  public readonly archetype: EnemyArchetypeId;
  public readonly behavior: EnemyBehavior;
  public readonly speed: number;
  public readonly maxHp: number;
  public readonly collisionDamage: number;
  public readonly canShoot: boolean;
  public readonly fireCooldown: number;
  public readonly preferredRange: number;
  public readonly projectileSpeed: number;
  public readonly projectileLifeSeconds: number;
  public readonly projectileDamage: number;
  public readonly projectileColor: number;
  public readonly projectileRadius: number;
  public hp: number;
  public readonly orbitDirection: number;
  public behaviorTimer = Math.random() * 2;
  public fireTimer = Math.random();

  public constructor(mesh: Object3D, archetype: EnemyArchetype) {
    this.mesh = mesh;
    this.archetype = archetype.id;
    this.behavior = archetype.behavior;
    this.speed = archetype.speed;
    this.maxHp = archetype.maxHp;
    this.collisionDamage = archetype.collisionDamage;
    this.canShoot = archetype.canShoot;
    this.fireCooldown = archetype.fireCooldown;
    this.preferredRange = archetype.preferredRange;
    this.projectileSpeed = archetype.projectileSpeed;
    this.projectileLifeSeconds = archetype.projectileLifeSeconds;
    this.projectileDamage = archetype.projectileDamage;
    this.projectileColor = archetype.projectileColor;
    this.projectileRadius = archetype.projectileRadius;
    this.hp = archetype.maxHp;
    this.orbitDirection = Math.random() < 0.5 ? -1 : 1;
  }
}

export type EnemyFireRequest = {
  position: Vector3;
  direction: Vector3;
  speed: number;
  lifeSeconds: number;
  damage: number;
  color: number;
  radius: number;
};

export type SpawnDirectorTelemetry = {
  elapsedMinutes: number;
  phaseStartMinute: number;
  spawnCooldown: number;
  maxAlive: number;
  alive: number;
  enemyDamageMultiplier: number;
  devSpawnCooldownScale: number;
  devEnemyDamageScale: number;
  archetypeCounts: Record<EnemyArchetypeId, number>;
};

export class EnemyManager {
  private readonly enemies: Enemy[] = [];
  private readonly tmpToPlayer = new Vector3();
  private readonly tmpLateral = new Vector3();
  private readonly tmpMove = new Vector3();
  private readonly fireRequests: EnemyFireRequest[] = [];
  private elapsedSeconds = 0;
  private spawnTimer = 0;
  private enemyTemplate: Object3D | null = null;
  private devSpawnCooldownScale = 1;
  private devEnemyDamageScale = 1;
  private visualStyle: EnemyVisualStylePreset = "industrial";

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
    this.elapsedSeconds += deltaSeconds;
    this.spawnTimer += deltaSeconds;

    const phase = this.getCurrentPhase();
    const effectiveSpawnCooldown = phase.spawnCooldown * this.devSpawnCooldownScale;
    if (this.spawnTimer >= effectiveSpawnCooldown) {
      this.spawnTimer = 0;
      this.spawnBurst(playerPosition, cameraHalfWidth, cameraHalfHeight, phase);
    }

    for (const enemy of this.enemies) {
      this.tmpToPlayer.subVectors(playerPosition, enemy.mesh.position).setY(0);
      const distanceSq = this.tmpToPlayer.lengthSq();
      if (distanceSq > 0.01) {
        const distance = Math.sqrt(distanceSq);
        this.tmpToPlayer.multiplyScalar(1 / distance);
        this.tmpLateral.set(-this.tmpToPlayer.z, 0, this.tmpToPlayer.x).multiplyScalar(enemy.orbitDirection);
        this.tmpMove.copy(this.resolveMoveDirection(enemy, distance));
        enemy.mesh.position.addScaledVector(this.tmpMove, enemy.speed * deltaSeconds);
        enemy.mesh.lookAt(playerPosition.x, enemy.mesh.position.y, playerPosition.z);
      }

      enemy.behaviorTimer += deltaSeconds;
      enemy.fireTimer += deltaSeconds;
      this.maybeQueueFireRequest(enemy, playerPosition, distanceSq);
    }
  }

  public applyProjectileHit(enemy: Enemy, damage: number): boolean {
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (enemy.hp <= 0) {
      this.remove(enemy);
      return true;
    }

    return false;
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
    this.fireRequests.length = 0;
    this.elapsedSeconds = 0;
    this.spawnTimer = 0;
  }

  public consumeFireRequests(): EnemyFireRequest[] {
    if (this.fireRequests.length === 0) {
      return [];
    }

    const requests = [...this.fireRequests];
    this.fireRequests.length = 0;
    return requests;
  }

  public getTelemetry(): SpawnDirectorTelemetry {
    const phase = this.getCurrentPhase();
    const counts: Record<EnemyArchetypeId, number> = {
      patrol: 0,
      skirmisher: 0,
      raider: 0,
      "smoke-runner": 0,
      warship: 0,
      elite: 0,
    };

    for (const enemy of this.enemies) {
      counts[enemy.archetype] += 1;
    }

    return {
      elapsedMinutes: this.elapsedSeconds / 60,
      phaseStartMinute: phase.startsAtMinute,
      spawnCooldown: phase.spawnCooldown * this.devSpawnCooldownScale,
      maxAlive: phase.maxAlive,
      alive: this.enemies.length,
      enemyDamageMultiplier: this.getEnemyProjectileDamageMultiplier(),
      devSpawnCooldownScale: this.devSpawnCooldownScale,
      devEnemyDamageScale: this.devEnemyDamageScale,
      archetypeCounts: counts,
    };
  }

  public setDevTuning(config: { spawnCooldownScale?: number; enemyDamageScale?: number }): void {
    if (typeof config.spawnCooldownScale === "number" && Number.isFinite(config.spawnCooldownScale)) {
      this.devSpawnCooldownScale = Math.min(2.5, Math.max(0.45, config.spawnCooldownScale));
    }
    if (typeof config.enemyDamageScale === "number" && Number.isFinite(config.enemyDamageScale)) {
      this.devEnemyDamageScale = Math.min(3.0, Math.max(0.5, config.enemyDamageScale));
    }
  }

  public setVisualStyle(style: EnemyVisualStylePreset): void {
    this.visualStyle = style;
    for (const enemy of this.enemies) {
      this.applyArchetypeVisuals(enemy.mesh, enemy.archetype);
    }
  }

  private spawnBurst(
    playerPosition: Vector3,
    cameraHalfWidth: number,
    cameraHalfHeight: number,
    phase: SpawnDirectorPhase,
  ): void {
    if (this.enemies.length >= phase.maxAlive) {
      return;
    }

    const burstRange = phase.burstMax - phase.burstMin + 1;
    const burstCount = phase.burstMin + Math.floor(Math.random() * burstRange);
    const remainingSlots = Math.max(0, phase.maxAlive - this.enemies.length);
    const spawnCount = Math.min(burstCount, remainingSlots);

    for (let i = 0; i < spawnCount; i += 1) {
      const archetype = ARCHETYPES[this.pickArchetype(phase)];
      this.spawnOutsideView(playerPosition, cameraHalfWidth, cameraHalfHeight, archetype, i > 0);
    }
  }

  private spawnOutsideView(
    playerPosition: Vector3,
    cameraHalfWidth: number,
    cameraHalfHeight: number,
    archetype: EnemyArchetype,
    asSquadOffset: boolean,
  ): void {
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

    if (asSquadOffset) {
      x += (Math.random() - 0.5) * 3;
      z += (Math.random() - 0.5) * 3;
    }

    const clampedX = Math.max(-this.worldHalfSize + 2, Math.min(this.worldHalfSize - 2, x));
    const clampedZ = Math.max(-this.worldHalfSize + 2, Math.min(this.worldHalfSize - 2, z));
    const mesh = this.enemyTemplate ? this.enemyTemplate.clone(true) : null;
    if (!mesh) {
      return;
    }

    mesh.position.set(clampedX, 0, clampedZ);
    mesh.scale.multiplyScalar(archetype.scale);
    this.applyArchetypeVisuals(mesh, archetype.id);
    const enemy = new Enemy(mesh, archetype);
    this.enemies.push(enemy);
    this.scene.add(mesh);
  }

  private getCurrentPhase(): SpawnDirectorPhase {
    const minutes = this.elapsedSeconds / 60;
    for (let i = PHASES.length - 1; i >= 0; i -= 1) {
      const phase = PHASES[i];
      if (minutes >= phase.startsAtMinute) {
        return phase;
      }
    }

    return PHASES[0];
  }

  private pickArchetype(phase: SpawnDirectorPhase): EnemyArchetypeId {
    let totalWeight = 0;
    for (const entry of phase.table) {
      totalWeight += entry.weight;
    }

    if (totalWeight <= 0) {
      return "patrol";
    }

    let roll = Math.random() * totalWeight;
    for (const entry of phase.table) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.archetype;
      }
    }

    return phase.table[phase.table.length - 1]?.archetype ?? "patrol";
  }

  private resolveMoveDirection(enemy: Enemy, distance: number): Vector3 {
    if (enemy.behavior === "direct") {
      return this.tmpToPlayer;
    }

    if (enemy.behavior === "strafe") {
      const approachWeight = distance > 12 ? 1 : distance < 6 ? -0.25 : 0.2;
      return this.tmpMove.copy(this.tmpToPlayer).multiplyScalar(approachWeight).addScaledVector(this.tmpLateral, 0.9).normalize();
    }

    if (enemy.behavior === "retreat") {
      if (distance < 7) {
        return this.tmpMove.copy(this.tmpToPlayer).multiplyScalar(-1);
      }
      return this.tmpMove.copy(this.tmpToPlayer).multiplyScalar(0.45).addScaledVector(this.tmpLateral, 0.8).normalize();
    }

    if (enemy.behavior === "siege") {
      const advanceWeight = distance > 16 ? 1 : distance < 10 ? -0.8 : 0.1;
      return this.tmpMove.copy(this.tmpToPlayer).multiplyScalar(advanceWeight).addScaledVector(this.tmpLateral, 0.55).normalize();
    }

    const chargeCycle = enemy.behaviorTimer % 2.2;
    const isCharging = chargeCycle < 0.7;
    const chargeWeight = isCharging ? 1.25 : 0.3;
    const strafeWeight = isCharging ? 0.2 : 0.95;
    return this.tmpMove.copy(this.tmpToPlayer).multiplyScalar(chargeWeight).addScaledVector(this.tmpLateral, strafeWeight).normalize();
  }

  private maybeQueueFireRequest(enemy: Enemy, playerPosition: Vector3, distanceSq: number): void {
    if (!enemy.canShoot || enemy.fireTimer < enemy.fireCooldown) {
      return;
    }

    const distance = Math.sqrt(distanceSq);
    if (distance > enemy.preferredRange || distance < 5) {
      return;
    }

    const direction = new Vector3().subVectors(playerPosition, enemy.mesh.position).setY(0);
    if (direction.lengthSq() <= 0.001) {
      return;
    }

    direction.normalize();
    const muzzlePosition = enemy.mesh.position.clone().setY(0.7);
    const scaledDamage = Math.max(
      1,
      Math.round(enemy.projectileDamage * this.getEnemyProjectileDamageMultiplier() * this.devEnemyDamageScale),
    );
    this.fireRequests.push({
      position: muzzlePosition,
      direction,
      speed: enemy.projectileSpeed,
      lifeSeconds: enemy.projectileLifeSeconds,
      damage: scaledDamage,
      color: enemy.projectileColor,
      radius: enemy.projectileRadius,
    });
    enemy.fireTimer = 0;
  }

  private getEnemyProjectileDamageMultiplier(): number {
    const minutes = this.elapsedSeconds / 60;
    const completedBlocks = Math.floor(minutes / 10);
    return Math.min(2.2, 1 + completedBlocks * 0.12);
  }

  private applyArchetypeVisuals(mesh: Object3D, archetypeId: EnemyArchetypeId): void {
    const style = ENEMY_VISUAL_STYLE[this.visualStyle][archetypeId];
    const variance = 0.93 + Math.random() * 0.16;
    mesh.traverse((child) => {
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
        material.color.setHex(style.tint).multiplyScalar(variance);
        material.emissive.setHex(style.emissive);
        material.emissiveIntensity = style.emissiveIntensity;
        material.roughness = style.roughness;
        material.metalness = style.metalness;
      }
    });
  }
}
