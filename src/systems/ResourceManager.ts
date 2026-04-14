import { Mesh, MeshStandardMaterial, Object3D, Scene, Vector3, CylinderGeometry } from "three";

type ThresholdHandler = () => void;

type ScrapItem = {
  mesh: Mesh;
  value: number;
};

export class ResourceManager {
  public readonly threshold = 20;
  private readonly scraps: ScrapItem[] = [];
  private readonly progressFill: HTMLElement;
  private scrapCount = 0;
  private thresholdTriggered = false;

  public constructor(
    private readonly scene: Scene,
    private readonly onThresholdReached: ThresholdHandler,
  ) {
    this.progressFill = this.createProgressUI();
  }

  public spawnScrap(position: Vector3): void {
    const geometry = new CylinderGeometry(0.32, 0.32, 0.2, 16);
    const material = new MeshStandardMaterial({ color: 0xffce54, emissive: 0x553000 });
    const mesh = new Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copy(position).add(new Vector3(0, 0.55, 0));
    this.scene.add(mesh);
    this.scraps.push({ mesh, value: 1 });
  }

  public updateCollection(shipPosition: Vector3): void {
    for (let i = this.scraps.length - 1; i >= 0; i -= 1) {
      const scrap = this.scraps[i];
      scrap.mesh.rotation.z += 0.04;
      if (scrap.mesh.position.distanceTo(shipPosition) < 1.6) {
        this.scrapCount += scrap.value;
        this.updateProgressBar();
        this.scene.remove(scrap.mesh);
        scrap.mesh.geometry.dispose();
        (scrap.mesh.material as MeshStandardMaterial).dispose();
        this.scraps.splice(i, 1);
      }
    }

    if (this.scrapCount >= this.threshold && !this.thresholdTriggered) {
      this.thresholdTriggered = true;
      this.onThresholdReached();
    }
  }

  public getScrapMeshes(): Object3D[] {
    return this.scraps.map((scrap) => scrap.mesh);
  }

  public resetAfterUpgrade(): void {
    this.scrapCount = 0;
    this.thresholdTriggered = false;
    this.updateProgressBar();
  }

  public dispose(): void {
    for (const scrap of this.scraps) {
      this.scene.remove(scrap.mesh);
      scrap.mesh.geometry.dispose();
      (scrap.mesh.material as MeshStandardMaterial).dispose();
    }
    this.scraps.length = 0;

    const ui = document.querySelector<HTMLElement>(".resource-ui");
    ui?.remove();
  }

  private updateProgressBar(): void {
    const percent = Math.min(100, (this.scrapCount / this.threshold) * 100);
    this.progressFill.style.width = `${percent}%`;
  }

  private createProgressUI(): HTMLElement {
    const existing = document.querySelector<HTMLElement>(".resource-ui");
    if (existing) {
      existing.remove();
    }

    const root = document.createElement("div");
    root.className = "resource-ui";

    const label = document.createElement("span");
    label.textContent = "Scrap";

    const track = document.createElement("div");
    track.className = "resource-track";

    const fill = document.createElement("div");
    fill.className = "resource-fill";

    track.appendChild(fill);
    root.append(label, track);
    document.body.appendChild(root);
    return fill;
  }
}
