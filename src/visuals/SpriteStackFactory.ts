import {
  CanvasTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
} from "three";

export class SpriteStackFactory {
  public createShipStack(): Group {
    return this.createStack({
      layers: 13,
      layerHeight: 0.11,
      width: 3.2,
      depth: 3.2,
      drawer: (ctx, t) => {
        const shade = 34 + Math.floor((1 - t) * 36);
        ctx.fillStyle = `rgb(${shade + 36}, ${shade + 24}, ${shade + 14})`;
        this.drawShipHullSlice(ctx, t);
      },
    });
  }

  public createEnemyStack(): Group {
    return this.createStack({
      layers: 12,
      layerHeight: 0.12,
      width: 2.1,
      depth: 2.1,
      drawer: (ctx, t) => {
        const bright = 90 + Math.floor((1 - t) * 75);
        ctx.fillStyle = `rgb(${bright + 70}, ${Math.floor(bright * 0.3)}, ${Math.floor(bright * 0.32)})`;
        this.drawEnemySlice(ctx, t);
      },
    });
  }

  private createStack(config: {
    layers: number;
    layerHeight: number;
    width: number;
    depth: number;
    drawer: (ctx: CanvasRenderingContext2D, t: number) => void;
  }): Group {
    const group = new Group();

    for (let i = 0; i < config.layers; i += 1) {
      const t = i / Math.max(1, config.layers - 1);
      const texture = this.createLayerTexture((ctx) => {
        config.drawer(ctx, t);
      });

      const layer = new Mesh(
        new PlaneGeometry(config.width, config.depth),
        new MeshStandardMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.45,
          roughness: 0.95,
          metalness: 0.0,
          color: 0xffffff,
          side: DoubleSide,
        }),
      );
      layer.rotation.x = -Math.PI / 2;
      layer.position.y = i * config.layerHeight;
      layer.renderOrder = i;
      group.add(layer);
    }

    group.position.y = 0.2;
    return group;
  }

  private createLayerTexture(drawFn: (ctx: CanvasRenderingContext2D) => void): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create canvas context for sprite stack layer.");
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFn(ctx);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  private drawShipHullSlice(ctx: CanvasRenderingContext2D, t: number): void {
    const center = 64;
    const baseRadius = 40 - t * 8;
    const tailWidth = baseRadius * (0.82 - t * 0.2);
    const noseLength = baseRadius * (1.14 - t * 0.15);

    ctx.beginPath();
    ctx.moveTo(center, center - noseLength);
    ctx.bezierCurveTo(
      center + baseRadius,
      center - baseRadius * 0.55,
      center + tailWidth,
      center + baseRadius,
      center,
      center + baseRadius * 0.86,
    );
    ctx.bezierCurveTo(
      center - tailWidth,
      center + baseRadius,
      center - baseRadius,
      center - baseRadius * 0.55,
      center,
      center - noseLength,
    );
    ctx.closePath();
    ctx.fill();
  }

  private drawEnemySlice(ctx: CanvasRenderingContext2D, t: number): void {
    const center = 64;
    const r = 28 - t * 5;
    const notch = 8 + t * 3;

    ctx.beginPath();
    ctx.moveTo(center, center - (r + notch));
    ctx.lineTo(center + r, center - 2);
    ctx.lineTo(center + (r - 3), center + r);
    ctx.lineTo(center, center + (r - notch));
    ctx.lineTo(center - (r - 3), center + r);
    ctx.lineTo(center - r, center - 2);
    ctx.closePath();
    ctx.fill();
  }
}
