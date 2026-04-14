import { Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from "three";

export class Projectile {
  public readonly mesh: Mesh;
  private readonly velocity: Vector3;
  private lifeSeconds = 2.5;

  public constructor(startPosition: Vector3, direction: Vector3) {
    const geometry = new SphereGeometry(0.2, 10, 10);
    const material = new MeshStandardMaterial({ color: 0x222222 });
    this.mesh = new Mesh(geometry, material);
    this.mesh.position.copy(startPosition);
    this.velocity = direction.clone().normalize().multiplyScalar(25);
  }

  public update(deltaSeconds: number): boolean {
    this.lifeSeconds -= deltaSeconds;
    this.mesh.position.addScaledVector(this.velocity, deltaSeconds);
    return this.lifeSeconds > 0;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    const material = this.mesh.material as MeshStandardMaterial;
    material.dispose();
  }
}
