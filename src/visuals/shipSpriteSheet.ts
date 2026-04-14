import { CanvasTexture, NearestFilter, RGBAFormat, SRGBColorSpace } from "three";

/** Grid layout of `public/sprites/player_ship_stack.png` (columns × rows). */
export const PLAYER_SHIP_SHEET_GRID = { cols: 5, rows: 3 } as const;

/** Top row of the sheet: hull bottom → deck top (left → right). */
export const PLAYER_SHIP_HULL_CELLS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
];

/** Middle row: cabin / stack (left → right). */
export const PLAYER_SHIP_CABIN_CELLS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
];

/**
 * Bottom row on the sheet: usually a hull variation / duplicate slices.
 * Placed after the main hull row and before the cabin row when doubling is enabled.
 */
export const PLAYER_SHIP_HULL_ALT_CELLS: readonly (readonly [number, number])[] = [
  [2, 0],
  [2, 1],
  [2, 2],
  [2, 3],
  [2, 4],
];

export function getPlayerShipStackCells(includeAltHullRow: boolean): readonly (readonly [number, number])[] {
  if (includeAltHullRow) {
    return [...PLAYER_SHIP_HULL_CELLS, ...PLAYER_SHIP_HULL_ALT_CELLS, ...PLAYER_SHIP_CABIN_CELLS];
  }
  return [...PLAYER_SHIP_HULL_CELLS, ...PLAYER_SHIP_CABIN_CELLS];
}

export function buildStackTexturesFromSheet(
  image: HTMLImageElement,
  cells: readonly (readonly [number, number])[],
  grid: { cols: number; rows: number } = PLAYER_SHIP_SHEET_GRID,
): CanvasTexture[] {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const cellW = iw / grid.cols;
  const cellH = ih / grid.rows;

  const textures: CanvasTexture[] = [];
  for (const [row, col] of cells) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(cellW));
    canvas.height = Math.max(1, Math.round(cellH));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create 2D context for sprite sheet cell.");
    }
    ctx.imageSmoothingEnabled = false;
    const sx = col * cellW;
    const sy = row * cellH;
    ctx.drawImage(image, sx, sy, cellW, cellH, 0, 0, canvas.width, canvas.height);

    const texture = new CanvasTexture(canvas);
    texture.format = RGBAFormat;
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.premultiplyAlpha = false;
    texture.needsUpdate = true;
    textures.push(texture);
  }

  return textures;
}

export function disposeCanvasTextures(textures: CanvasTexture[]): void {
  for (const texture of textures) {
    texture.dispose();
  }
  textures.length = 0;
}
