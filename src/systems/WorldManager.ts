import { BufferGeometry, Color, GridHelper, Line, LineBasicMaterial, Scene, Vector3 } from "three";

export const WORLD_SIZE = 100;

export class WorldManager {
  public readonly halfSize = WORLD_SIZE / 2;

  public constructor(private readonly scene: Scene) {
    this.addVisualBorder();
  }

  public keepInsideWorld(position: Vector3, velocity: Vector3): void {
    const min = -this.halfSize + 1;
    const max = this.halfSize - 1;

    if (position.x < min) {
      position.x = min;
      velocity.x = Math.max(0, velocity.x);
    } else if (position.x > max) {
      position.x = max;
      velocity.x = Math.min(0, velocity.x);
    }

    if (position.z < min) {
      position.z = min;
      velocity.z = Math.max(0, velocity.z);
    } else if (position.z > max) {
      position.z = max;
      velocity.z = Math.min(0, velocity.z);
    }
  }

  private addVisualBorder(): void {
    const grid = new GridHelper(WORLD_SIZE, 40, 0x99d8ff, 0xbbe7ff);
    grid.position.y = 0.03;
    this.scene.add(grid);

    const points = [
      new Vector3(-this.halfSize, 0.08, -this.halfSize),
      new Vector3(this.halfSize, 0.08, -this.halfSize),
      new Vector3(this.halfSize, 0.08, this.halfSize),
      new Vector3(-this.halfSize, 0.08, this.halfSize),
      new Vector3(-this.halfSize, 0.08, -this.halfSize),
    ];
    const borderGeometry = new BufferGeometry().setFromPoints(points);
    const borderMaterial = new LineBasicMaterial({ color: new Color("#31d5ff"), linewidth: 2 });
    const border = new Line(borderGeometry, borderMaterial);
    this.scene.add(border);
  }
}
