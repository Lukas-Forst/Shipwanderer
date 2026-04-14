const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const file = 'public/ship/tile000.png';
const img = new Image(); img.src = fs.readFileSync(file);
const w = img.width; const h = img.height;
const canvas = createCanvas(w, h); const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0); const data = ctx.getImageData(0, 0, w, h).data;

const img1 = new Image(); img1.src = fs.readFileSync('public/ship/tile001.png');
const c1 = createCanvas(w, h); const ctx1 = c1.getContext('2d');
ctx1.drawImage(img1, 0, 0); const d1 = ctx1.getImageData(0, 0, w, h).data;

// Threshold 20 (tolSq = 400)
const tolSq = 20 * 20;

function testTile(imgData) {
  const bgPalette = [];
  function addPalette(r, g, b) {
    if(r===0&&g===0&&b===0) return; // Ignore absolute black if it's outside bounds and we want to allow it? No, if the image has a black border we MUST include it!
    for (const p of bgPalette) {
      const dr = p[0] - r; const dg = p[1] - g; const db = p[2] - b;
      if (dr * dr + dg * dg + db * db < 100) return; // Very strict deduplication
    }
    bgPalette.push([r, g, b]);
  }
  const pts = [
    0, w - 1, (h - 1) * w, (h - 1) * w + w - 1,
    ((h / 2) | 0) * w, ((h / 2) | 0) * w + w - 1,
    (w / 2) | 0, (h - 1) * w + ((w / 2) | 0)
  ];
  for (const pt of pts) addPalette(imgData[pt * 4], imgData[pt * 4 + 1], imgData[pt * 4 + 2]);
  
  // Magic: If we find 148,144,141 or 132,131,129 on the border, we assume it's the magica voxel grid!
  // And we hard-inject the grid line color (83,83,83) into the palette!
  let hasMagicaVoxelGrid = false;
  for(const p of bgPalette) {
    if(Math.abs(p[0]-148)<15 && Math.abs(p[1]-144)<15 && Math.abs(p[2]-141)<15) hasMagicaVoxelGrid = true;
    if(Math.abs(p[0]-132)<15 && Math.abs(p[1]-131)<15 && Math.abs(p[2]-129)<15) hasMagicaVoxelGrid = true;
  }
  if(hasMagicaVoxelGrid) {
    addPalette(83,83,83);
    addPalette(150,146,143);
    addPalette(148,144,141);
    addPalette(132,131,129);
  } else {
    // If not, just ensure 0,0,0 is added if the border was entirely 0,0,0
    let allBlack = true;
    for(const pt of pts) if(imgData[pt*4]!==0 || imgData[pt*4+1]!==0 || imgData[pt*4+2]!==0) allBlack = false;
    if(allBlack) addPalette(0,0,0);
  }

  function isBgColor(idx) {
    for (const p of bgPalette) {
      const dr = imgData[idx * 4] - p[0]; const dg = imgData[idx * 4 + 1] - p[1]; const db = imgData[idx * 4 + 2] - p[2];
      if (dr * dr + dg * dg + db * db <= tolSq) return true;
    }
    return false;
  }

  const visited = new Uint8Array(w * h); const queue = new Int32Array(w * h); let qt = 0;
  const push = (idx) => { if (visited[idx]) return; visited[idx] = 1; queue[qt++] = idx; };
  for (let x = 0; x < w; x += 1) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y += 1) { push(y * w); push(y * w + (w - 1)); }

  for (let qh = 0; qh < qt; qh += 1) {
    const idx = queue[qh]; const x = idx % w; const y = (idx / w) | 0;
    if (y > 0) { const ni = idx - w; if (!visited[ni] && isBgColor(ni)) push(ni); }
    if (y < h - 1) { const ni = idx + w; if (!visited[ni] && isBgColor(ni)) push(ni); }
    if (x > 0) { const ni = idx - 1; if (!visited[ni] && isBgColor(ni)) push(ni); }
    if (x < w - 1) { const ni = idx + 1; if (!visited[ni] && isBgColor(ni)) push(ni); }
  }

  let uncleared = 0;
  for (let i = 0; i < w * h; i++) if (!visited[i]) uncleared++;
  return uncleared;
}

console.log(" tile000 config small_tol:", testTile(data));
console.log(" tile001 config small_tol:", testTile(d1));

