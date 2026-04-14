export class ProceduralLayerGenerator {
  public generateLayerCanvas(index: number, totalLayers: number, type: "hull" | "enemy"): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create 2D context for procedural layer canvas.");
    }

    ctx.clearRect(0, 0, 64, 64);

    if (type === "hull") {
      this.drawSteamboatLayer(ctx, index, totalLayers);
    } else {
      this.drawEnemyLayer(ctx, index, totalLayers);
    }

    return canvas;
  }

  private drawSteamboatLayer(ctx: CanvasRenderingContext2D, index: number, totalLayers: number): void {
    // Palette requested by user.
    const hullDark = "#4b3621";
    const hullMid = "#654321";
    const deckDark = "#8b5a2b";
    const deckLight = "#d2b48c";
    const detailLight = "#a0a0a0";
    const detailDark = "#404040";

    // Simple boat profile: lower hull, deck, then compact stern cabin.
    if (index <= 4) {
      const width = 24 - index * 0.95;
      const sternY = 53 - index * 0.5;
      const bowY = 10 + index * 0.85;
      this.drawTaperedHull(ctx, width, bowY, sternY, index < 3 ? hullDark : hullMid);
      return;
    }

    if (index <= 8) {
      const width = 18 - (index - 5) * 0.75;
      const sternY = 49 - (index - 5) * 0.45;
      const bowY = 15 + (index - 5) * 0.7;
      this.drawTaperedHull(ctx, width, bowY, sternY, index % 2 === 0 ? deckLight : deckDark);
      this.drawPlankLines(ctx, detailDark);

      // Small wheelhouse/cabin near stern.
      if (index >= 7) {
        ctx.fillStyle = detailLight;
        ctx.fillRect(24, 37, 16, 8);
        ctx.fillStyle = detailDark;
        ctx.fillRect(26, 39, 3, 3);
        ctx.fillRect(31, 39, 3, 3);
        ctx.fillRect(36, 39, 3, 3);
      }
      return;
    }

    // Top cap layers: keep low profile and avoid tower look.
    const t = (index - 9) / Math.max(1, totalLayers - 10);
    this.drawTaperedHull(ctx, 12.5 - t * 1.4, 20, 41, deckDark);
    ctx.fillStyle = detailLight;
    ctx.fillRect(25, 38, 14, 5);
    ctx.fillStyle = detailDark;
    ctx.fillRect(27, 38, 10, 2);
  }

  private drawTaperedHull(
    ctx: CanvasRenderingContext2D,
    halfWidth: number,
    bowY: number,
    sternY: number,
    color: string,
  ): void {
    const cx = 32;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, bowY);
    ctx.bezierCurveTo(cx + halfWidth, bowY + 10, cx + halfWidth, sternY - 8, cx + halfWidth * 0.75, sternY);
    ctx.lineTo(cx - halfWidth * 0.75, sternY);
    ctx.bezierCurveTo(cx - halfWidth, sternY - 8, cx - halfWidth, bowY + 10, cx, bowY);
    ctx.closePath();
    ctx.fill();
  }

  private drawPlankLines(ctx: CanvasRenderingContext2D, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let y = 24; y <= 44; y += 6) {
      ctx.beginPath();
      ctx.moveTo(17, y);
      ctx.lineTo(47, y);
      ctx.stroke();
    }
  }

  private drawEnemyLayer(ctx: CanvasRenderingContext2D, index: number, totalLayers: number): void {
    const t = index / Math.max(1, totalLayers - 1);
    const bright = 90 + Math.floor((1 - t) * 70);
    ctx.fillStyle = `rgb(${bright + 70}, ${Math.floor(bright * 0.3)}, ${Math.floor(bright * 0.3)})`;

    const center = 32;
    const radius = 16 - t * 3;
    ctx.beginPath();
    ctx.moveTo(center, center - (radius + 5));
    ctx.lineTo(center + radius, center - 1);
    ctx.lineTo(center + radius - 2, center + radius);
    ctx.lineTo(center, center + (radius - 4));
    ctx.lineTo(center - radius + 2, center + radius);
    ctx.lineTo(center - radius, center - 1);
    ctx.closePath();
    ctx.fill();
  }
}
