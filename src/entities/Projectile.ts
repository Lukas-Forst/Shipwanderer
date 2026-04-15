import { Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from "three";

type ProjectileOptions = {
  speed?: number;
  lifeSeconds?: number;
  radius?: number;
  color?: number;
};

export class Projectile {
  public readonly mesh: Mesh;
  private readonly velocity: Vector3;
  private lifeSeconds: number;

  public constructor(startPosition: Vector3, direction: Vector3, options: ProjectileOptions = {}) {
    const radius = options.radius ?? 0.2;
    const geometry = new SphereGeometry(radius, 10, 10);
    const material = new MeshStandardMaterial({ color: options.color ?? 0x222222 });
    this.mesh = new Mesh(geometry, material);
    this.mesh.position.copy(startPosition);
    this.velocity = direction.clone().normalize().multiplyScalar(options.speed ?? 25);
    this.lifeSeconds = options.lifeSeconds ?? 2.5;
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
