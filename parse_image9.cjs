const fs = require('fs');
const { createCanvas, Image } = require('canvas');

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
  let allOpaque = true;
  for(let j=3; j<data.length; j+=4) {
    if(data[j] < 255) { allOpaque = false; break; }
  }
  console.log(`${file}: allOpaque=${allOpaque}`);
}
