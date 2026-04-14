import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  Group,
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
import { AssetManager } from "./AssetManager";
import { EnemyManager } from "./EnemyManager";
import { ResourceManager } from "./ResourceManager";
import { WorldManager } from "./WorldManager";

type SplashParticle = { mesh: Mesh; life: number };
type UpgradeId = "rapid-fire" | "heavy-hull" | "long-range";

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
  private readonly splashParticles: SplashParticle[] = [];
  private readonly cameraOffset = new Vector3(24, 24, 24);
  private readonly cameraTarget = new Vector3();
  private readonly shakeJitter = new Vector3();
  private readonly moveForward = new Vector3();
  private readonly moveRight = new Vector3();
  private animationFrameId: number | null = null;
  private timeScale = 1;
  private shakeStrength = 0;
  private splashTimer = 0;
  private cameraHalfWidth = 13;
  private cameraHalfHeight = 13;
  private visualToggleButton: HTMLButtonElement | null = null;

  public constructor(private readonly rootElement: HTMLElement) {
    this.scene.background = new Color("#8fd6ff");
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = false;
    this.setupLighting();
    this.setupOcean();
    this.onResize = this.onResize.bind(this);
    this.render = this.render.bind(this);
  }

  public async start(): Promise<void> {
    this.rootElement.appendChild(this.renderer.domElement);
    this.setupPostProcessing();

    const visualMode = this.assetManager.getVisualMode();
    const hull = visualMode === "model" ? await this.assetManager.createHull() : new Group();
    const cannon = visualMode === "model" ? await this.assetManager.createCannon() : new Group();
    this.ship = new Ship(hull, cannon, visualMode);
    this.scene.add(this.ship.mesh);

    this.enemyManager = new EnemyManager(this.scene, this.assetManager, this.worldManager.halfSize);
    await this.enemyManager.initialize();

    this.resourceManager = new ResourceManager(this.scene, () => this.openUpgradeOverlay());
    this.createUpgradeOverlay();
    this.createVisualModeToggle();
    this.setCameraToIsometricAngle();
    this.onResize();
    window.addEventListener("resize", this.onResize);
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
    window.removeEventListener("resize", this.onResize);
  }

  private setupLighting(): void {
    const ambientLight = new AmbientLight("#ffffff", 0.8);
    const sunLight = new DirectionalLight("#ffffff", 1.1);
    sunLight.position.set(18, 28, 12);
    this.scene.add(ambientLight, sunLight);
  }

  private setupOcean(): void {
    const ocean = new Mesh(
      new PlaneGeometry(220, 220, 1, 1),
      new MeshStandardMaterial({ color: "#7bc9ff", roughness: 0.38, metalness: 0.06 }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.04;
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

    this.computeMoveBasis();
    this.ship.update(deltaSeconds, this.moveForward, this.moveRight);
    this.worldManager.keepInsideWorld(this.ship.mesh.position, this.ship.velocity);
    this.updateCameraFollow();

    if (this.timeScale > 0) {
      this.enemyManager.update(deltaSeconds, this.ship.mesh.position, this.cameraHalfWidth, this.cameraHalfHeight);
      this.updateWeapons(deltaSeconds);
      this.updateProjectiles(deltaSeconds);
      this.updateScrapAndEnemies();
      this.updateSplashEffects(deltaSeconds);
    }

    this.updateScreenShake();
    this.updateOutlineTargets();
    this.composer.render();
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

  private updateScrapAndEnemies(): void {
    const enemies = this.enemyManager.getAll();
    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = enemies[enemyIndex];

      if (enemy.mesh.position.distanceTo(this.ship.mesh.position) < 1.5) {
        this.ship.takeHit(5);
        this.enemyManager.remove(enemy);
        this.shakeStrength = Math.min(0.45, this.shakeStrength + 0.18);
        continue;
      }

      for (let projectileIndex = this.projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
        const projectile = this.projectiles[projectileIndex];
        if (projectile.mesh.position.distanceTo(enemy.mesh.position) < 1.2) {
          this.resourceManager.spawnScrap(enemy.mesh.position.clone());
          this.enemyManager.remove(enemy);
          this.removeProjectile(projectileIndex);
          break;
        }
      }
    }

    this.resourceManager.updateCollection(this.ship.mesh.position);
  }

  private updateSplashEffects(deltaSeconds: number): void {
    if (this.ship.getSpeed() > 7 && this.splashTimer > 0.07) {
      this.splashTimer = 0;
      const splash = new Mesh(
        new SphereGeometry(0.15, 6, 6),
        new MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
      );
      splash.position.copy(this.ship.splashAnchor).add(new Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8));
      this.scene.add(splash);
      this.splashParticles.push({ mesh: splash, life: 0.35 });
    }

    for (let i = this.splashParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.splashParticles[i];
      particle.life -= deltaSeconds;
      particle.mesh.position.y += deltaSeconds * 0.8;
      const material = particle.mesh.material as MeshStandardMaterial;
      material.opacity = Math.max(0, particle.life * 2.2);
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        material.dispose();
        this.splashParticles.splice(i, 1);
      }
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

  private updateOutlineTargets(): void {
    const targets: Object3D[] = [this.ship.mesh];
    for (const enemy of this.enemyManager.getAll()) {
      targets.push(enemy.mesh);
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

  private disposeProjectilesAndParticles(): void {
    for (const projectile of this.projectiles) {
      this.scene.remove(projectile.mesh);
      projectile.dispose();
    }
    this.projectiles.length = 0;

    for (const particle of this.splashParticles) {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as MeshStandardMaterial).dispose();
    }
    this.splashParticles.length = 0;
  }
}
