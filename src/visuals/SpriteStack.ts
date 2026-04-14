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
      this.drawHullLayer(ctx, index);
    } else {
      this.drawEnemyLayer(ctx, index, totalLayers);
    }

    return canvas;
  }

  private drawHullLayer(ctx: CanvasRenderingContext2D, index: number): void {
    if (index <= 2) {
      this.drawSteamboatHullBase(ctx, index);
      return;
    }

    if (index <= 6) {
      this.drawSteamboatDeck(ctx, index);
      return;
    }

    this.drawSteamboatTopCap(ctx, index);
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

  private drawSteamboatHullBase(ctx: CanvasRenderingContext2D, index: number): void {
    const radiusY = 17 - index * 1.1;
    const radiusX = 25 - index * 0.4;

    ctx.fillStyle = "#5a3921";
    ctx.beginPath();
    ctx.ellipse(32, 36, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    this.drawIntegratedBow(ctx, "#4e311b", 14, 24);

    ctx.fillRect(20, 40, 24, 6);
  }

  private drawSteamboatDeck(ctx: CanvasRenderingContext2D, index: number): void {
    ctx.fillStyle = "#a36a3f";
    ctx.beginPath();
    ctx.ellipse(32, 33, 21, 14 - (index - 3) * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    this.drawIntegratedBow(ctx, "#91582f", 15, 24);

    // Deck planks.
    ctx.strokeStyle = "#5f3b22";
    ctx.lineWidth = 1;
    for (let y = 24; y <= 42; y += 6) {
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.lineTo(48, y);
      ctx.stroke();
    }

    // Side paddle-wheel housing, shifted toward stern.
    ctx.fillStyle = "#7e4e2c";
    ctx.fillRect(11, 34, 6, 10);
    ctx.fillRect(47, 34, 6, 10);
    ctx.fillStyle = "#c08a5a";
    ctx.fillRect(12, 36, 4, 6);
    ctx.fillRect(48, 36, 4, 6);
  }

  private drawSteamboatTopDetails(ctx: CanvasRenderingContext2D, index: number): void {
    // Cabin block, moved toward stern so bow stays cleaner.
    ctx.fillStyle = "#cdcdcd";
    ctx.fillRect(21, 34, 22, 14);
    ctx.fillStyle = "#979797";
    ctx.fillRect(24, 37, 4, 4);
    ctx.fillRect(30, 37, 4, 4);
    ctx.fillRect(36, 37, 4, 4);

    // Smokestack sits forward of cabin, not at very bow.
    if (index >= 8) {
      ctx.fillStyle = "#333333";
      ctx.fillRect(29, 26, 6, 10);
      ctx.fillStyle = "#555555";
      ctx.fillRect(28, 24, 8, 3);
    }

    // Steam puff cap at very top.
    if (index === 9) {
      ctx.fillStyle = "#efefef";
      ctx.beginPath();
      ctx.arc(31, 21, 3.2, 0, Math.PI * 2);
      ctx.arc(35, 20, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  public generateCabinOverlayCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create 2D context for cabin overlay.");
    }

    ctx.clearRect(0, 0, 64, 64);
    this.drawSteamboatTopDetails(ctx, 9);
    return canvas;
  }

  public generateSmokeOverlayCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create 2D context for smoke overlay.");
    }

    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = "#f0f0f0";
    ctx.beginPath();
    ctx.arc(30, 19, 3.2, 0, Math.PI * 2);
    ctx.arc(34, 18, 2.5, 0, Math.PI * 2);
    ctx.arc(37, 16.8, 1.8, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
  }

  private drawSteamboatTopCap(ctx: CanvasRenderingContext2D, index: number): void {
    ctx.fillStyle = "#b6784a";
    ctx.beginPath();
    ctx.ellipse(32, 33, 17 - (index - 7) * 1.3, 10 - (index - 7) * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    this.drawIntegratedBow(ctx, "#a56a3f", 17, 25);
  }

  private drawIntegratedBow(
    ctx: CanvasRenderingContext2D,
    color: string,
    tipY: number,
    baseY: number,
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(32, tipY);
    ctx.lineTo(39.5, baseY);
    ctx.lineTo(24.5, baseY);
    ctx.closePath();
    ctx.fill();
  }
}
