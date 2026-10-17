import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(width, height, drawFn) {
  // RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);

  // set pixel helper
  const setPixel = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    buffer[idx] = r;
    buffer[idx + 1] = g;
    buffer[idx + 2] = b;
    buffer[idx + 3] = a;
  };

  drawFn(width, height, setPixel);

  // PNG building with zlib
  // Filter byte 0 for each scanline
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    rawData[y * scanlineLength] = 0; // Filter None
    buffer.copy(rawData, y * scanlineLength + 1, y * width * 4, (y + 1) * width * 4);
  }

  const deflated = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      for (let j = 0; j < 8; j++) {
        const bit = (crc ^ byte) & 1;
        crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0);
        byte >>>= 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const typeAndData = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bit depth
  ihdrData[9] = 6; // color type 6: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  const idat = makeChunk('IDAT', deflated);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function drawCryptoIcon(width, height, setPixel) {
  // Background: Deep dark #0b0e14 with slight radial tint
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.hypot(x - cx, y - cy) / (width * 0.7);
      const bgR = Math.max(10, Math.floor(11 + (1 - dist) * 15));
      const bgG = Math.max(14, Math.floor(14 + (1 - dist) * 20));
      const bgB = Math.max(20, Math.floor(20 + (1 - dist) * 35));
      setPixel(x, y, bgR, bgG, bgB, 255);
    }
  }

  // Draw chart grid or circular glow
  const s = width / 192; // scale factor

  // Draw 4 Candlesticks in center
  // Candle 1: green (left)
  // Candle 2: red (middle left)
  // Candle 3: green (middle right)
  // Candle 4: strong green (right)
  const candles = [
    { x: 45 * s, w: 14 * s, high: 60 * s, low: 140 * s, open: 110 * s, close: 75 * s, green: true },
    { x: 75 * s, w: 14 * s, high: 70 * s, low: 135 * s, open: 85 * s, close: 120 * s, green: false },
    { x: 105 * s, w: 14 * s, high: 45 * s, low: 125 * s, open: 110 * s, close: 65 * s, green: true },
    { x: 135 * s, w: 16 * s, high: 28 * s, low: 105 * s, open: 70 * s, close: 38 * s, green: true },
  ];

  for (const c of candles) {
    const col = c.green ? [16, 185, 129] : [239, 68, 68]; // emerald-500 or red-500
    // wick
    const wickX = Math.round(c.x + c.w / 2);
    for (let y = Math.round(c.high); y <= Math.round(c.low); y++) {
      setPixel(wickX, y, col[0], col[1], col[2], 255);
      setPixel(wickX + 1, y, col[0], col[1], col[2], 255);
    }
    // body
    const bodyTop = Math.round(Math.min(c.open, c.close));
    const bodyBottom = Math.round(Math.max(c.open, c.close));
    for (let x = Math.round(c.x); x < Math.round(c.x + c.w); x++) {
      for (let y = bodyTop; y <= bodyBottom; y++) {
        setPixel(x, y, col[0], col[1], col[2], 255);
      }
    }
  }

  // Draw overlay arrow / signal line in cyan/gold
  // From bottom-left to top-right
  const points = [
    { x: 30 * s, y: 130 * s },
    { x: 60 * s, y: 100 * s },
    { x: 85 * s, y: 115 * s },
    { x: 120 * s, y: 65 * s },
    { x: 160 * s, y: 35 * s },
  ];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const steps = Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)) * 2;
    for (let st = 0; st <= steps; st++) {
      const t = st / steps;
      const px = Math.round(p1.x + (p2.x - p1.x) * t);
      const py = Math.round(p1.y + (p2.y - p1.y) * t);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          setPixel(px + ox, py + oy, 14, 165, 233, 230); // cyan accent
        }
      }
    }
  }
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write 192x192
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, drawCryptoIcon));
// Write 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, drawCryptoIcon));
// Write apple-touch-icon 180x180
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, drawCryptoIcon));
// Write maskable 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, drawCryptoIcon));

console.log('PWA icons created successfully in public/');
