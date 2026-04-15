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

  private drawSteamboatLayer(ctx: CanvasRenderingContext2D, index: number, _totalLayers: number): void {
    const hullDark  = "#1e130b";
    const detailDark = "#353b44";

    // ── Zone A: Hull (layers 0–3) ─────────────────────────────────────────
    // 10 px width taper + 8 px bow/stern movement so the isometric camera
    // clearly reads depth rather than a flat disc.
    if (index <= 3) {
      const t      = index / 3;
      const width  = 26 - t * 10;   // 26 → 16
      const bowY   =  8 + t *  8;   //  8 → 16
      const sternY = 55 - t *  8;   // 55 → 47
      // Fix 2: keel 0–1 very dark, hull sides 2–3 stepped up from keel
      this.drawTaperedHull(ctx, width, bowY, sternY, index < 2 ? "#3a2410" : "#5c3820");
      if (index <= 1) {
        ctx.fillStyle = "#120b07";
        ctx.fillRect(32 - width * 0.8, 32, width * 1.6, 2);
      }
      return;
    }

    // ── Zone B: Deck (layers 4–9) ─────────────────────────────────────────
    // Split into lower (4–5) and upper (6–9) sub-zones so the upper deck
    // tapers noticeably faster and reads as a distinct surface.
    if (index <= 9) {
      let width: number, bowY: number, sternY: number, layerColor: string;

      if (index <= 5) {
        // Fix 1/2: lower transition — gentle taper, hull-side colour, no planks yet.
        const t  = index - 4;              // 0, 1
        width    = 15 - t * 2;            // 15 → 13
        bowY     = 17 + t * 2;            // 17 → 19
        sternY   = 47 - t * 2;            // 47 → 45
        layerColor = "#5c3820";           // hull-side mid brown
      } else {
        // Fix 1/2: upper deck — aggressive taper, distinct lighter colours.
        const t  = (index - 6) / 3;       // 0 → 1 over 4 steps
        width    = 13 - t * 6;            // 13 → 7
        bowY     = 19 + t * 4;            // 19 → 23
        sternY   = 45 - t * 5;            // 45 → 40
        layerColor = index <= 7 ? "#7c5538" : "#9c7a5e";
      }

      this.drawTaperedHull(ctx, width, bowY, sternY, layerColor);

      // Fix 3: plank lines only on upper deck layers — not the lower hull sides.
      if (index >= 6) {
        this.drawPlankLines(ctx, detailDark);
      }

      if (index >= 7) {
        const step = index - 7;          // 0, 1, 2
        const whW  = 14 - step * 2;      // 14 → 10
        const whH  =  7 - step;          //  7 →  5
        const whX  = 32 - whW / 2;
        ctx.fillStyle = "#c4a882";
        ctx.fillRect(whX, 38, whW, whH);
        if (whW >= 12) {
          ctx.fillStyle = detailDark;
          ctx.fillRect(whX + 2, 40, 3, 3);
          ctx.fillRect(whX + 5, 40, 3, 3);
          ctx.fillRect(whX + 9, 40, 3, 3);
        }
      }
      return;
    }

    // ── Zone C: Cabin roof (layers 10–13) ─────────────────────────────────
    // No hull silhouette. Shrinking roof strip in the brightest deck tone.
    if (index <= 13) {
      const roofW = Math.max(2, 8 - (index - 10) * 2);   // 8 → 2
      ctx.fillStyle = "#b07840";
      ctx.fillRect(32 - roofW / 2, 37, roofW, 3);
      return;
    }

    // ── Zone D: Smokestack tip only (layers 14–15) ───────────────────────
    // Hollow dark circle — reads as a pipe not a silo because it appears
    // only in the topmost 2 slices with no hull shape behind it.
    const stackR = index === 14 ? 4 : 3;
    ctx.fillStyle = detailDark;
    ctx.beginPath();
    ctx.arc(32, 30, stackR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#555f6a";
    ctx.beginPath();
    ctx.arc(32, 30, stackR - 1.5, 0, Math.PI * 2);
    ctx.fill();
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
