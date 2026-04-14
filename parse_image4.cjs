const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const img = new Image();
img.src = fs.readFileSync('public/ship/tile000.png');
const w = img.width;
const h = img.height;
const canvas = createCanvas(w, h);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const imgData = ctx.getImageData(0, 0, w, h);
const data = imgData.data;

for (let y = 0; y < 20; y += 4) {
    let row = '';
    for (let x = 0; x < 20; x += 4) {
        const idx = (y * w + x) * 4;
        row += `(${data[idx]},${data[idx+1]},${data[idx+2]}) `;
    }
    console.log(row);
}
