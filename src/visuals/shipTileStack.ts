import { ImageLoader } from "three";

/** One PNG per vertical slice, accepts `tile000.png` and `tile_boat000.png` naming. */
const TILE_PATHS = (index: number) => {
  const id = String(index).padStart(3, "0");
  return [`/ship/tile_boat${id}.png`, `/ship/tile${id}.png`] as const;
};

/** Skip corrupt or placeholder exports (e.g. 1×512 strips). */
const MIN_SLICE_WIDTH = 8;
const MIN_SLICE_HEIGHT = 8;

const MAX_TILE_INDEX = 127;

/** Stop loading after this many 404s in a row (allows gaps like missing `tile005.png`). */
const MAX_CONSECUTIVE_MISSES = 3;

/**
 * Max RGB Euclidean distance between adjacent pixels for edge flood to continue.
 * Exports without an alpha channel (everything A=255) get a cut-out silhouette from the border.
 */
const EDGE_FLOOD_COLOR_STEP = 22;

function isFullyOpaqueRgba(imageData: ImageData): boolean {
  const { data } = imageData;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return false;
    }
  }
  return true;
}

function colorDistSq(data: Uint8ClampedArray, ia: number, ib: number): number {
  const ao = ia * 4;
  const bo = ib * 4;
  const dr = data[ao] - data[bo];
  const dg = data[ao + 1] - data[bo + 1];
  const db = data[ao + 2] - data[bo + 2];
  return dr * dr + dg * dg + db * db;
}
/**
 * Clears alpha on pixels connected to the image border through steps of at most
 * `EDGE_FLOOD_COLOR_STEP` in RGB space (handles flat fills where alpha was not exported).
 */
function applyEdgeFloodTransparency(source: HTMLImageElement): HTMLCanvasElement {
  const w = source.naturalWidth;
  const h = source.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Unable to create 2D context for ship tile transparency.");
  }
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;
  if (!isFullyOpaqueRgba(imageData)) {
    return canvas;
  }

  const tolSq = EDGE_FLOOD_COLOR_STEP * EDGE_FLOOD_COLOR_STEP;
  const n = w * h;
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qt = 0;

  const push = (idx: number) => {
    if (visited[idx]) {
      return;
    }
    visited[idx] = 1;
    queue[qt++] = idx;
  };

  for (let x = 0; x < w; x += 1) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    push(y * w);
    push(y * w + (w - 1));
  }

  for (let qh = 0; qh < qt; qh += 1) {
    const idx = queue[qh]!;
    const x = idx % w;
    const y = (idx / w) | 0;
    if (y > 0) {
      const ni = idx - w;
      if (!visited[ni] && colorDistSq(data, idx, ni) <= tolSq) {
        push(ni);
      }
    }
    if (y < h - 1) {
      const ni = idx + w;
      if (!visited[ni] && colorDistSq(data, idx, ni) <= tolSq) {
        push(ni);
      }
    }
    if (x > 0) {
      const ni = idx - 1;
      if (!visited[ni] && colorDistSq(data, idx, ni) <= tolSq) {
        push(ni);
      }
    }
    if (x < w - 1) {
      const ni = idx + 1;
      if (!visited[ni] && colorDistSq(data, idx, ni) <= tolSq) {
        push(ni);
      }
    }
  }

  for (let i = 0; i < n; i += 1) {
    if (visited[i]) {
      data[i * 4 + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export type ShipStackSliceSource = HTMLImageElement | HTMLCanvasElement;

/**
 * Loads ship stack slices in order (bottom → top). Skips missing indices (gaps in numbering)
 * and stops after several consecutive misses. Fully opaque PNGs are passed through
 * `applyEdgeFloodTransparency` so stacked layers are not solid rectangles.
 */
export async function loadShipStackSliceImages(): Promise<ShipStackSliceSource[]> {
  const loader = new ImageLoader();
  const slices: ShipStackSliceSource[] = [];
  let consecutiveMisses = 0;

  for (let i = 0; i <= MAX_TILE_INDEX; i += 1) {
    let loaded = false;
    for (const tilePath of TILE_PATHS(i)) {
      try {
        const image = await loader.loadAsync(tilePath);
        loaded = true;
        consecutiveMisses = 0;
        if (image.naturalWidth >= MIN_SLICE_WIDTH && image.naturalHeight >= MIN_SLICE_HEIGHT) {
          slices.push(applyEdgeFloodTransparency(image));
        }
        break;
      } catch {
        // Try the next naming variant.
      }
    }

    if (!loaded) {
      if (i === 0) {
        return [];
      }
      consecutiveMisses += 1;
      if (consecutiveMisses >= MAX_CONSECUTIVE_MISSES) {
        break;
      }
    }
  }

  return slices;
}
