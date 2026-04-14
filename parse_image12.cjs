const fs = require('fs');
const { createCanvas, Image } = require('canvas');

let shipHas83 = false;
for(let i=0; i<11; i++) {
  const file = `public/ship/tile${String(i).padStart(3, '0')}.png`;
  if(!fs.existsSync(file)) continue;
  const img = new Image();
  img.src = fs.readFileSync(file);
  const w = img.width;
  const h = img.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  
  let gridPixels = 0;
  for(let j=0; j<data.length; j+=4) {
    if(data[j] === 83 && data[j+1] === 83 && data[j+2] === 83) {
      gridPixels++;
    }
  }
  console.log(`${file}: found ${gridPixels} pixels of (83,83,83)`);
}
