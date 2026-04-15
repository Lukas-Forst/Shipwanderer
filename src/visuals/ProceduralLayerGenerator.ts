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
    const hullDark = "#1e130b";
    const hullMid = "#4a3020";
    const deckDark = "#7c5538";
    const deckLight = "#9c7a5e";
    const detailLight = "#8f969f";
    const detailDark = "#353b44";

    // Simple boat profile: lower hull, deck, then compact stern cabin.
    if (index <= 4) {
      const width = 24 - index * 0.95;
      const sternY = 53 - index * 0.5;
      const bowY = 10 + index * 0.85;
      this.drawTaperedHull(ctx, width, bowY, sternY, index < 3 ? hullDark : hullMid);

      if (index <= 2) {
        // Dark stripe near the hull's widest section to fake a painted keel/waterline break.
        ctx.fillStyle = "#120b07";
        const stripeWidth = width * 1.65;
        ctx.fillRect(32 - stripeWidth * 0.5, 31, stripeWidth, 2);
      }
      return;
    }

    if (index <= 10) {
      const width = 19 - (index - 4) * 0.72;
      const sternY = 49 - (index - 4) * 0.45;
      const bowY = 14 + (index - 4) * 0.68;
      const layerColor = index <= 7 ? hullMid : index % 2 === 0 ? deckLight : deckDark;
      this.drawTaperedHull(ctx, width, bowY, sternY, layerColor);
      this.drawPlankLines(ctx, detailDark);

      // Small wheelhouse/cabin near stern.
      if (index >= 7) {
        ctx.fillStyle = detailLight;
        ctx.fillRect(24, 37, 16, 8);
        ctx.fillStyle = detailDark;
        ctx.fillRect(26, 39, 3, 3);
        ctx.fillRect(31, 39, 3, 3);
        ctx.fillRect(36, 39, 3, 3);
        ctx.fillStyle = "#8f5a3f";
        ctx.fillRect(24, 44, 16, 2);
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
    // Tiny vertical segment at the tip creates a sharper bow point than a pure bezier start.
    ctx.moveTo(cx, bowY + 2);
    ctx.lineTo(cx, bowY);
    ctx.bezierCurveTo(cx + halfWidth, bowY + 10, cx + halfWidth, sternY - 8, cx + halfWidth * 0.75, sternY);
    ctx.lineTo(cx - halfWidth * 0.75, sternY);
    // Slight stern notch makes rear profile read differently from the bow.
    ctx.lineTo(cx, sternY + 4);
    ctx.bezierCurveTo(cx - halfWidth, sternY - 8, cx - halfWidth, bowY + 10, cx, bowY);
    ctx.closePath();
    ctx.fill();
  }

  private drawPlankLines(ctx: CanvasRenderingContext2D, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let y = 24; y <= 44; y += 5) {
      ctx.beginPath();
      ctx.moveTo(17, y);
      ctx.lineTo(47, y);
      ctx.stroke();
    }
  }

  private drawEnemyLayer(ctx: CanvasRenderingContext2D, index: number, totalLayers: number): void {
    const t = index / Math.max(1, totalLayers - 1);
    const bright = 82 + Math.floor((1 - t) * 66);
    ctx.fillStyle = `rgb(${bright + 56}, ${Math.floor(bright * 0.24)}, ${Math.floor(bright * 0.25)})`;

    const center = 32;
    const radius = 17 - t * 3.5;
    const bowSpike = 7 + t * 1.5;
    const sternInset = 6 + t * 1.8;
    ctx.beginPath();
    ctx.moveTo(center, center - (radius + bowSpike));
    ctx.lineTo(center + (radius - 1), center - 2);
    ctx.lineTo(center + radius, center + radius * 0.75);
    ctx.lineTo(center + 3, center + (radius - sternInset));
    ctx.lineTo(center - 3, center + (radius - sternInset));
    ctx.lineTo(center - radius, center + radius * 0.75);
    ctx.lineTo(center - (radius - 1), center - 2);
    ctx.closePath();
    ctx.fill();

    if (t > 0.28 && t < 0.9) {
      ctx.fillStyle = "rgba(44, 20, 20, 0.62)";
      ctx.beginPath();
      ctx.moveTo(center, center - (radius + bowSpike - 4));
      ctx.lineTo(center + (radius - 5), center);
      ctx.lineTo(center + (radius - 4), center + radius * 0.62);
      ctx.lineTo(center, center + (radius - sternInset + 1));
      ctx.lineTo(center - (radius - 4), center + radius * 0.62);
      ctx.lineTo(center - (radius - 5), center);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(215, 123, 84, 0.9)";
      ctx.fillRect(center - 6, center - 3, 4, 3);
      ctx.fillRect(center + 2, center - 3, 4, 3);
      ctx.fillStyle = "rgba(92, 24, 19, 0.84)";
      ctx.fillRect(center - 6, center + 2, 12, 2);
    }
  }
}
