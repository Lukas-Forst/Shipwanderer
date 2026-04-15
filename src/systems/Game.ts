import {
  AmbientLight,
  BufferAttribute,
  Clock,
  Color,
  DirectionalLight,
  Group,
  ImageLoader,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { Projectile } from "../entities/Projectile";
import { Ship } from "../entities/Ship";
import type { ShipSpriteOptions } from "../entities/Ship";
import { AssetManager } from "./AssetManager";
import { EnemyManager } from "./EnemyManager";
import type { EnemyVisualStylePreset } from "./EnemyManager";
import { ResourceManager } from "./ResourceManager";
import { loadShipStackSliceImages } from "../visuals/shipTileStack";
import { WorldManager } from "./WorldManager";

type SplashParticle = { mesh: Mesh; life: number; drift: Vector3; shrink: number };
type UpgradeId = "rapid-fire" | "heavy-hull" | "long-range";
type EnemyProjectile = { projectile: Projectile; damage: number };
type WaterStyleConfig = {
  color: string;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  waveHeight: number;
  waveSpeed: number;
  foamColor: number;
  foamAccentColor: number;
};

export class Game {
  private readonly renderer = new WebGLRenderer({ antialias: true });
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera();
  private readonly clock = new Clock();
  private readonly assetManager = new AssetManager();
  private readonly worldManager = new WorldManager(this.scene);

  private composer!: EffectComposer;
  private outlinePass!: OutlinePass;
  private resourceManager!: ResourceManager;
  private enemyManager!: EnemyManager;
  private ship!: Ship;

  private readonly projectiles: Projectile[] = [];
  private readonly enemyProjectiles: EnemyProjectile[] = [];
  private readonly splashParticles: SplashParticle[] = [];
  private readonly cameraOffset = new Vector3(24, 24, 24);
  private readonly cameraTarget = new Vector3();
  private readonly shakeJitter = new Vector3();
  private readonly moveForward = new Vector3();
  private readonly moveRight = new Vector3();
  private readonly wakeDirection = new Vector3();
  private readonly wakeLateral = new Vector3();
  private oceanBasePositions: Float32Array | null = null;
  private animationFrameId: number | null = null;
  private timeScale = 1;
  private shakeStrength = 0;
  private splashTimer = 0;
  private cameraHalfWidth = 13;
  private cameraHalfHeight = 13;
  private visualToggleButton: HTMLButtonElement | null = null;
  private debugHudElement: HTMLDivElement | null = null;
  private devPanelElement: HTMLDivElement | null = null;
  private debugHudTimer = 0;
  private isDebugHudVisible = true;
  private isDevPanelVisible = false;
  private oceanMesh: Mesh<PlaneGeometry, MeshStandardMaterial> | null = null;
  private oceanTime = 0;
  private oceanNormalRefreshTimer = 0;
  private currentVisualStyle: EnemyVisualStylePreset = "industrial";
  private waveHeightScale = 1;
  private waveSpeedScale = 1;
  private foamColor = 0xe7f8ff;
  private foamAccentColor = 0xc9f1ff;

  public constructor(private readonly rootElement: HTMLElement) {
    this.scene.background = new Color("#8fd6ff");
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = false;
    this.setupLighting();
    this.setupOcean();
    this.onResize = this.onResize.bind(this);
    this.render = this.render.bind(this);
    this.onDebugKeyDown = this.onDebugKeyDown.bind(this);
  }

  public async start(): Promise<void> {
    this.rootElement.appendChild(this.renderer.domElement);
    this.setupPostProcessing();

    const visualMode = this.assetManager.getVisualMode();
    const hull = visualMode === "model" ? await this.assetManager.createHull() : new Group();
    const cannon = visualMode === "model" ? await this.assetManager.createCannon() : new Group();

    const spriteOptions: ShipSpriteOptions = {};
    if (visualMode === "sprite") {
      spriteOptions.includeAltHullRow = new URLSearchParams(window.location.search).get("doubleHull") === "1";

      const sliceImages = await loadShipStackSliceImages();
      spriteOptions.stackSliceImages = sliceImages.length >= 3 ? sliceImages : null;

      if (!spriteOptions.stackSliceImages) {
        try {
          spriteOptions.sheetImage = await new ImageLoader().loadAsync("/sprites/player_ship_stack.png");
        } catch {
          spriteOptions.sheetImage = null;
        }
      }
    }

    this.ship = new Ship(hull, cannon, visualMode, spriteOptions);
    this.scene.add(this.ship.mesh);

    this.enemyManager = new EnemyManager(this.scene, this.assetManager, this.worldManager.halfSize);
    await this.enemyManager.initialize();
    this.applyVisualStylePreset(this.currentVisualStyle);

    this.resourceManager = new ResourceManager(this.scene, () => this.openUpgradeOverlay());
    this.createUpgradeOverlay();
    this.createVisualModeToggle();
    this.createDebugHud();
    this.createDevPanel();
    this.setCameraToIsometricAngle();
    this.onResize();
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onDebugKeyDown);
    this.render();
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.ship?.dispose();
    this.enemyManager?.clear();
    this.resourceManager?.dispose();
    this.disposeProjectilesAndParticles();
    document.querySelector<HTMLElement>("#upgrade-overlay")?.remove();
    this.visualToggleButton?.remove();
    this.visualToggleButton = null;
    this.debugHudElement?.remove();
    this.debugHudElement = null;
    this.devPanelElement?.remove();
    this.devPanelElement = null;
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onDebugKeyDown);
  }

  private setupLighting(): void {
    const ambientLight = new AmbientLight("#ffffff", 0.8);
    const sunLight = new DirectionalLight("#ffffff", 1.1);
    sunLight.position.set(18, 28, 12);
    this.scene.add(ambientLight, sunLight);
  }

  private setupOcean(): void {
    const geometry = new PlaneGeometry(260, 260, 56, 56);
    const material = new MeshStandardMaterial({
      color: "#5daedf",
      roughness: 0.34,
      metalness: 0.08,
      emissive: new Color("#0a2a46"),
      emissiveIntensity: 0.12,
    });
    const ocean = new Mesh(geometry, material);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.05;
    this.oceanMesh = ocean;
    this.copyOceanBasePositions();
    this.scene.add(ocean);
  }

  private setupPostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.outlinePass = new OutlinePass(new Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
    this.outlinePass.edgeStrength = 6;
    this.outlinePass.edgeThickness = 1.7;
    this.outlinePass.visibleEdgeColor.set("#000000");
    this.outlinePass.hiddenEdgeColor.set("#111111");
    this.composer.addPass(this.outlinePass);
  }

  private setCameraToIsometricAngle(): void {
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);
  }

  private onResize(): void {
    const width = this.rootElement.clientWidth || window.innerWidth;
    const height = this.rootElement.clientHeight || window.innerHeight;
    const aspect = width / height;
    const viewSize = 26;

    this.camera.left = (-viewSize * aspect) / 2;
    this.camera.right = (viewSize * aspect) / 2;
    this.camera.top = viewSize / 2;
    this.camera.bottom = -viewSize / 2;
    this.camera.near = 0.1;
    this.camera.far = 500;
    this.camera.updateProjectionMatrix();
    this.cameraHalfWidth = (viewSize * aspect) / 2;
    this.cameraHalfHeight = viewSize / 2;

    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    if (this.outlinePass) {
      this.outlinePass.resolution.set(width, height);
    }
  }

  private render(): void {
    this.animationFrameId = requestAnimationFrame(this.render);
    const unscaledDelta = this.clock.getDelta();
    const deltaSeconds = unscaledDelta * this.timeScale;
    this.updateOcean(unscaledDelta);

    this.computeMoveBasis();
    this.ship.update(deltaSeconds, this.moveForward, this.moveRight);
    this.worldManager.keepInsideWorld(this.ship.mesh.position, this.ship.velocity);
    this.updateCameraFollow();

    if (this.timeScale > 0) {
      this.enemyManager.update(deltaSeconds, this.ship.mesh.position, this.cameraHalfWidth, this.cameraHalfHeight);
      this.spawnEnemyProjectiles();
      this.updateWeapons(deltaSeconds);
      this.updateProjectiles(deltaSeconds);
      this.updateEnemyProjectiles(deltaSeconds);
      this.updateScrapAndEnemies();
      this.updateSplashEffects(deltaSeconds);
    }

    this.updateDebugHud(deltaSeconds);
    this.updateScreenShake();
    this.updateOutlineTargets();
    this.composer.render();
  }

  private spawnEnemyProjectiles(): void {
    const fireRequests = this.enemyManager.consumeFireRequests();
    if (fireRequests.length === 0) {
      return;
    }

    for (const request of fireRequests) {
      const projectile = new Projectile(request.position, request.direction, {
        speed: request.speed,
        lifeSeconds: request.lifeSeconds,
        color: request.color,
        radius: request.radius,
      });
      this.enemyProjectiles.push({ projectile, damage: request.damage });
      this.scene.add(projectile.mesh);
    }
  }

  private updateCameraFollow(): void {
    this.cameraTarget.copy(this.ship.mesh.position).add(this.cameraOffset);
    this.camera.position.lerp(this.cameraTarget, 0.08);
    this.camera.lookAt(this.ship.mesh.position);
  }

  private computeMoveBasis(): void {
    this.moveForward.subVectors(this.ship.mesh.position, this.camera.position).setY(0);
    if (this.moveForward.lengthSq() <= 0.0001) {
      this.moveForward.set(0, 0, 1);
    } else {
      this.moveForward.normalize();
    }

    this.moveRight.set(-this.moveForward.z, 0, this.moveForward.x);
    if (this.moveRight.lengthSq() <= 0.0001) {
      this.moveRight.set(1, 0, 0);
    } else {
      this.moveRight.normalize();
    }
  }

  private updateWeapons(deltaSeconds: number): void {
    const projectile = this.ship.findShot(this.enemyManager.getAll());
    if (projectile) {
      this.projectiles.push(projectile);
      this.scene.add(projectile.mesh);
      this.shakeStrength = Math.min(0.35, this.shakeStrength + 0.12);
    }
    this.splashTimer += deltaSeconds;
  }

  private updateProjectiles(deltaSeconds: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      if (!projectile.update(deltaSeconds)) {
        this.removeProjectile(i);
      }
    }
  }

  private updateEnemyProjectiles(deltaSeconds: number): void {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i -= 1) {
      const enemyShot = this.enemyProjectiles[i];
      if (!enemyShot.projectile.update(deltaSeconds)) {
        this.removeEnemyProjectile(i);
        continue;
      }

      const hitDistance = 0.9 + (enemyShot.projectile.mesh.geometry as SphereGeometry).parameters.radius;
      if (enemyShot.projectile.mesh.position.distanceTo(this.ship.mesh.position) < hitDistance) {
        this.ship.takeHit(enemyShot.damage);
        this.removeEnemyProjectile(i);
        this.shakeStrength = Math.min(0.4, this.shakeStrength + 0.1);
      }
    }
  }

  private updateScrapAndEnemies(): void {
    const enemies = this.enemyManager.getAll();
    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = enemies[enemyIndex];

      if (enemy.mesh.position.distanceTo(this.ship.mesh.position) < 1.5) {
        this.ship.takeHit(enemy.collisionDamage);
        this.enemyManager.remove(enemy);
        this.shakeStrength = Math.min(0.45, this.shakeStrength + 0.18);
        continue;
      }

      for (let projectileIndex = this.projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
        const projectile = this.projectiles[projectileIndex];
        if (projectile.mesh.position.distanceTo(enemy.mesh.position) < 1.2) {
          const destroyed = this.enemyManager.applyProjectileHit(enemy, 1);
          if (destroyed) {
            this.resourceManager.spawnScrap(enemy.mesh.position.clone());
          }
          this.removeProjectile(projectileIndex);
          break;
        }
      }
    }

    this.resourceManager.updateCollection(this.ship.mesh.position);
  }

  private updateSplashEffects(deltaSeconds: number): void {
    const speed = this.ship.getSpeed();
    if (speed > 6.5 && this.splashTimer > 0.055) {
      this.splashTimer = 0;
      this.spawnWaterFoam(speed);
    }

    for (let i = this.splashParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.splashParticles[i];
      particle.life -= deltaSeconds;
      particle.mesh.position.addScaledVector(particle.drift, deltaSeconds);
      particle.mesh.scale.multiplyScalar(Math.max(0.5, 1 - particle.shrink * deltaSeconds));
      const material = particle.mesh.material as MeshStandardMaterial;
      material.opacity = Math.max(0, particle.life * 2.1);
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        material.dispose();
        this.splashParticles.splice(i, 1);
      }
    }
  }

  private spawnWaterFoam(speed: number): void {
    this.wakeDirection.copy(this.ship.velocity).setY(0);
    if (this.wakeDirection.lengthSq() <= 0.001) {
      this.wakeDirection.set(0, 0, 1);
    } else {
      this.wakeDirection.normalize();
    }
    this.wakeLateral.set(-this.wakeDirection.z, 0, this.wakeDirection.x);

    const rearCenter = this.ship.splashAnchor
      .clone()
      .addScaledVector(this.wakeDirection, -0.9)
      .add(new Vector3(0, -0.04, 0));
    for (const side of [-1, 1]) {
      const splash = new Mesh(
        new SphereGeometry(0.13 + Math.random() * 0.04, 6, 6),
        new MeshStandardMaterial({
          color: this.foamColor,
          transparent: true,
          opacity: 0.85,
          roughness: 0.22,
          metalness: 0.0,
        }),
      );
      splash.position
        .copy(rearCenter)
        .addScaledVector(this.wakeLateral, side * (0.26 + Math.random() * 0.14))
        .addScaledVector(this.wakeDirection, -Math.random() * 0.28);
      this.scene.add(splash);
      this.splashParticles.push({
        mesh: splash,
        life: 0.34 + Math.random() * 0.16,
        drift: this.wakeDirection
          .clone()
          .multiplyScalar(-0.65 - speed * 0.03)
          .addScaledVector(this.wakeLateral, side * (0.18 + Math.random() * 0.12))
          .setY(0.3 + Math.random() * 0.2),
        shrink: 0.85 + Math.random() * 0.5,
      });
    }

    if (speed > 9) {
      const wakeFoam = new Mesh(
        new SphereGeometry(0.2 + Math.random() * 0.05, 8, 8),
        new MeshStandardMaterial({
          color: this.foamAccentColor,
          transparent: true,
          opacity: 0.5,
          roughness: 0.2,
          metalness: 0.0,
        }),
      );
      wakeFoam.position.copy(rearCenter).addScaledVector(this.wakeDirection, -0.42);
      this.scene.add(wakeFoam);
      this.splashParticles.push({
        mesh: wakeFoam,
        life: 0.46,
        drift: this.wakeDirection.clone().multiplyScalar(-0.8 - speed * 0.03).setY(0.1),
        shrink: 0.5,
      });
    }
  }

  private updateScreenShake(): void {
    this.shakeStrength = Math.max(0, this.shakeStrength * 0.82 - 0.006);
    if (this.shakeStrength <= 0.001) {
      return;
    }
    this.shakeJitter.set((Math.random() - 0.5) * this.shakeStrength, 0, (Math.random() - 0.5) * this.shakeStrength);
    this.camera.position.add(this.shakeJitter);
  }

  private copyOceanBasePositions(): void {
    if (!this.oceanMesh) {
      return;
    }
    const position = this.oceanMesh.geometry.attributes.position as BufferAttribute;
    const src = position.array as Float32Array;
    this.oceanBasePositions = new Float32Array(src);
  }

  private updateOcean(deltaSeconds: number): void {
    if (!this.oceanMesh) {
      return;
    }

    this.oceanTime += deltaSeconds;
    this.oceanNormalRefreshTimer += deltaSeconds;
    if (!this.oceanBasePositions) {
      return;
    }
    const position = this.oceanMesh.geometry.attributes.position as BufferAttribute;
    const vertices = position.array as Float32Array;
    const t = this.oceanTime;

    for (let i = 0; i < vertices.length; i += 3) {
      const baseX = this.oceanBasePositions[i] ?? 0;
      const baseY = this.oceanBasePositions[i + 1] ?? 0;
      const baseZ = this.oceanBasePositions[i + 2] ?? 0;
      const waveA =
        Math.sin(baseX * 0.11 + t * 1.65 * this.waveSpeedScale + baseZ * 0.07) * (0.13 * this.waveHeightScale);
      const waveB =
        Math.cos(baseZ * 0.09 - t * 1.25 * this.waveSpeedScale + baseX * 0.04) * (0.1 * this.waveHeightScale);
      const chop =
        Math.sin(baseX * 0.32 + t * 2.9 * this.waveSpeedScale) *
        Math.cos(baseZ * 0.28 - t * 2.5 * this.waveSpeedScale) *
        (0.03 * this.waveHeightScale);
      vertices[i + 1] = baseY + waveA + waveB + chop;
    }

    position.needsUpdate = true;
    if (this.oceanNormalRefreshTimer >= 0.12) {
      this.oceanNormalRefreshTimer = 0;
      this.oceanMesh.geometry.computeVertexNormals();
    }
  }

  private updateOutlineTargets(): void {
    const targets: Object3D[] = [];
    // depthWrite:false sprite stacks go solid-black in OutlinePass — same
    // reason enemies are excluded. Only include ship mesh in model mode.
    if (this.ship.currentVisualMode !== "sprite") {
      targets.push(this.ship.mesh);
    }
    targets.push(...this.resourceManager.getScrapMeshes());
    this.outlinePass.selectedObjects = targets;
  }

  private removeProjectile(index: number): void {
    const projectile = this.projectiles[index];
    this.scene.remove(projectile.mesh);
    projectile.dispose();
    this.projectiles.splice(index, 1);
  }

  private removeEnemyProjectile(index: number): void {
    const enemyShot = this.enemyProjectiles[index];
    this.scene.remove(enemyShot.projectile.mesh);
    enemyShot.projectile.dispose();
    this.enemyProjectiles.splice(index, 1);
  }

  private createUpgradeOverlay(): void {
    const overlay = document.createElement("div");
    overlay.id = "upgrade-overlay";
    overlay.className = "upgrade-overlay hidden";
    overlay.innerHTML = `
      <div class="upgrade-panel">
        <h2>Level Up</h2>
        <p>Pick one upgrade</p>
        <button data-upgrade="rapid-fire">Rapid Fire</button>
        <button data-upgrade="heavy-hull">Heavy Hull</button>
        <button data-upgrade="long-range">Long Range</button>
      </div>
    `;

    overlay.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName !== "BUTTON") {
        return;
      }
      const upgrade = target.dataset.upgrade as UpgradeId | undefined;
      if (!upgrade) {
        return;
      }
      this.applyUpgrade(upgrade);
    });

    document.body.appendChild(overlay);
  }

  private openUpgradeOverlay(): void {
    const overlay = document.querySelector<HTMLElement>("#upgrade-overlay");
    if (!overlay) {
      return;
    }
    this.timeScale = 0;
    overlay.classList.remove("hidden");
  }

  private closeUpgradeOverlay(): void {
    const overlay = document.querySelector<HTMLElement>("#upgrade-overlay");
    if (!overlay) {
      return;
    }
    overlay.classList.add("hidden");
    this.timeScale = 1;
  }

  private applyUpgrade(upgradeId: UpgradeId): void {
    if (upgradeId === "rapid-fire") {
      this.ship.applyRapidFireUpgrade();
    } else if (upgradeId === "heavy-hull") {
      this.ship.applyHeavyHullUpgrade();
    } else {
      this.ship.applyLongRangeUpgrade();
    }

    this.resourceManager.resetAfterUpgrade();
    this.closeUpgradeOverlay();
  }

  private createVisualModeToggle(): void {
    const existing = document.querySelector<HTMLButtonElement>(".visual-mode-toggle");
    existing?.remove();

    const button = document.createElement("button");
    button.className = "visual-mode-toggle";
    button.textContent = `Visual: ${this.assetManager.getVisualMode()} (switch)`;
    button.addEventListener("click", () => {
      this.assetManager.toggleVisualMode();
      window.location.reload();
    });
    document.body.appendChild(button);
    this.visualToggleButton = button;
  }

  private createDebugHud(): void {
    this.debugHudElement?.remove();

    const hud = document.createElement("div");
    hud.className = "debug-hud";
    if (!this.isDebugHudVisible) {
      hud.classList.add("hidden");
    }
    document.body.appendChild(hud);
    this.debugHudElement = hud;
    this.updateDebugHud(1);
  }

  private updateDebugHud(deltaSeconds: number): void {
    if (!this.debugHudElement) {
      return;
    }

    this.debugHudTimer += deltaSeconds;
    if (this.debugHudTimer < 0.2) {
      return;
    }
    this.debugHudTimer = 0;

    const telemetry = this.enemyManager.getTelemetry();
    const counts = telemetry.archetypeCounts;
    this.debugHudElement.innerHTML = `
      <div><strong>Dev HUD</strong></div>
      <div>HUD: F3 | Tuning: Shift+F3</div>
      <div>Time: ${telemetry.elapsedMinutes.toFixed(1)} min | Phase: ${telemetry.phaseStartMinute}-${telemetry.phaseStartMinute + 10}</div>
      <div>Alive: ${telemetry.alive}/${telemetry.maxAlive} | Spawn CD: ${telemetry.spawnCooldown.toFixed(2)}s (x${telemetry.devSpawnCooldownScale.toFixed(2)})</div>
      <div>Enemy dmg x${telemetry.enemyDamageMultiplier.toFixed(2)}</div>
      <div>Dev dmg scale: x${telemetry.devEnemyDamageScale.toFixed(2)}</div>
      <div>P:${counts.patrol} S:${counts.skirmisher} R:${counts.raider} SR:${counts["smoke-runner"]} W:${counts.warship} E:${counts.elite}</div>
      <div>Enemy shots active: ${this.enemyProjectiles.length}</div>
    `;
  }

  private onDebugKeyDown(event: KeyboardEvent): void {
    if (event.code !== "F3") {
      return;
    }

    event.preventDefault();
    if (event.shiftKey) {
      this.isDevPanelVisible = !this.isDevPanelVisible;
      this.devPanelElement?.classList.toggle("hidden", !this.isDevPanelVisible);
      return;
    }

    this.isDebugHudVisible = !this.isDebugHudVisible;
    this.debugHudElement?.classList.toggle("hidden", !this.isDebugHudVisible);
  }

  private createDevPanel(): void {
    this.devPanelElement?.remove();

    const panel = document.createElement("div");
    panel.className = "dev-panel hidden";
    panel.innerHTML = `
      <h3>Dev Tuning</h3>
      <label>
        Spawn cooldown scale
        <input type="range" min="0.45" max="2.5" step="0.05" value="1" data-dev="spawn-cooldown" />
        <span data-dev-value="spawn-cooldown">x1.00</span>
      </label>
      <label>
        Enemy damage scale
        <input type="range" min="0.5" max="3.0" step="0.05" value="1" data-dev="enemy-damage" />
        <span data-dev-value="enemy-damage">x1.00</span>
      </label>
      <div class="dev-presets">
        <button type="button" data-dev-preset="easy">Easy Test</button>
        <button type="button" data-dev-preset="mid">Mid Spike</button>
        <button type="button" data-dev-preset="chaos">Chaos</button>
      </div>
      <div class="dev-style">
        <span>Style pack</span>
        <div class="dev-style-buttons">
          <button type="button" data-style="industrial">Industrial</button>
          <button type="button" data-style="clean">Clean</button>
          <button type="button" data-style="stormy">Stormy</button>
        </div>
      </div>
      <button type="button" data-dev-action="reset">Reset</button>
    `;

    const spawnInput = panel.querySelector<HTMLInputElement>('input[data-dev="spawn-cooldown"]');
    const damageInput = panel.querySelector<HTMLInputElement>('input[data-dev="enemy-damage"]');
    const spawnValue = panel.querySelector<HTMLSpanElement>('[data-dev-value="spawn-cooldown"]');
    const damageValue = panel.querySelector<HTMLSpanElement>('[data-dev-value="enemy-damage"]');
    const resetButton = panel.querySelector<HTMLButtonElement>('button[data-dev-action="reset"]');
    const presetButtons = panel.querySelectorAll<HTMLButtonElement>("button[data-dev-preset]");
    const styleButtons = panel.querySelectorAll<HTMLButtonElement>("button[data-style]");
    if (
      !spawnInput ||
      !damageInput ||
      !spawnValue ||
      !damageValue ||
      !resetButton ||
      presetButtons.length === 0 ||
      styleButtons.length === 0
    ) {
      return;
    }

    const applyTuning = (spawnScale: number, damageScale: number): void => {
      spawnInput.value = spawnScale.toFixed(2);
      damageInput.value = damageScale.toFixed(2);
      this.enemyManager.setDevTuning({
        spawnCooldownScale: spawnScale,
        enemyDamageScale: damageScale,
      });
      spawnValue.textContent = `x${spawnScale.toFixed(2)}`;
      damageValue.textContent = `x${damageScale.toFixed(2)}`;
    };

    const applyFromInputs = (): void => {
      applyTuning(Number(spawnInput.value), Number(damageInput.value));
    };

    const presets: Record<string, { spawnCooldownScale: number; enemyDamageScale: number }> = {
      easy: { spawnCooldownScale: 1.4, enemyDamageScale: 0.8 },
      mid: { spawnCooldownScale: 0.9, enemyDamageScale: 1.25 },
      chaos: { spawnCooldownScale: 0.6, enemyDamageScale: 1.8 },
    };

    spawnInput.addEventListener("input", applyFromInputs);
    damageInput.addEventListener("input", applyFromInputs);
    for (const button of presetButtons) {
      button.addEventListener("click", () => {
        const key = button.dataset.devPreset;
        if (!key) {
          return;
        }
        const preset = presets[key];
        if (!preset) {
          return;
        }
        applyTuning(preset.spawnCooldownScale, preset.enemyDamageScale);
      });
    }
    resetButton.addEventListener("click", () => {
      applyTuning(1, 1);
    });
    for (const button of styleButtons) {
      button.addEventListener("click", () => {
        const style = button.dataset.style as EnemyVisualStylePreset | undefined;
        if (!style) {
          return;
        }
        this.applyVisualStylePreset(style);
        this.refreshStyleButtonState(styleButtons);
      });
    }

    applyTuning(1, 1);
    this.refreshStyleButtonState(styleButtons);
    document.body.appendChild(panel);
    this.devPanelElement = panel;
  }

  private disposeProjectilesAndParticles(): void {
    for (const projectile of this.projectiles) {
      this.scene.remove(projectile.mesh);
      projectile.dispose();
    }
    this.projectiles.length = 0;
    for (const enemyShot of this.enemyProjectiles) {
      this.scene.remove(enemyShot.projectile.mesh);
      enemyShot.projectile.dispose();
    }
    this.enemyProjectiles.length = 0;

    for (const particle of this.splashParticles) {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as MeshStandardMaterial).dispose();
    }
    this.splashParticles.length = 0;
  }

  private applyVisualStylePreset(style: EnemyVisualStylePreset): void {
    this.currentVisualStyle = style;
    this.enemyManager.setVisualStyle(style);
    this.ship.applyVisualStyle(style);
    this.applyWaterStyle(style);
  }

  private applyWaterStyle(style: EnemyVisualStylePreset): void {
    const config = this.getWaterStyleConfig(style);
    this.waveHeightScale = config.waveHeight;
    this.waveSpeedScale = config.waveSpeed;
    this.foamColor = config.foamColor;
    this.foamAccentColor = config.foamAccentColor;
    if (!this.oceanMesh) {
      return;
    }
    this.oceanMesh.material.color.set(config.color);
    this.oceanMesh.material.emissive.set(config.emissive);
    this.oceanMesh.material.emissiveIntensity = config.emissiveIntensity;
    this.oceanMesh.material.roughness = config.roughness;
    this.oceanMesh.material.metalness = config.metalness;
  }

  private getWaterStyleConfig(style: EnemyVisualStylePreset): WaterStyleConfig {
    if (style === "clean") {
      return {
        color: "#76c8ef",
        emissive: "#163450",
        emissiveIntensity: 0.08,
        roughness: 0.28,
        metalness: 0.1,
        waveHeight: 0.8,
        waveSpeed: 0.9,
        foamColor: 0xf6ffff,
        foamAccentColor: 0xd7f5ff,
      };
    }
    if (style === "stormy") {
      return {
        color: "#3f6e90",
        emissive: "#07182d",
        emissiveIntensity: 0.2,
        roughness: 0.52,
        metalness: 0.12,
        waveHeight: 1.35,
        waveSpeed: 1.25,
        foamColor: 0xc2d7e4,
        foamAccentColor: 0x95afc0,
      };
    }
    return {
      color: "#5daedf",
      emissive: "#0a2a46",
      emissiveIntensity: 0.12,
      roughness: 0.34,
      metalness: 0.08,
      waveHeight: 1,
      waveSpeed: 1,
      foamColor: 0xe7f8ff,
      foamAccentColor: 0xc9f1ff,
    };
  }

  private refreshStyleButtonState(styleButtons: NodeListOf<HTMLButtonElement>): void {
    for (const button of styleButtons) {
      button.classList.toggle("active", button.dataset.style === this.currentVisualStyle);
    }
  }
}
