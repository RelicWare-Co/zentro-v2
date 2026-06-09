#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noBitwiseOperators: PNG CRC32 encoding requires bitwise operations.
/**
 * Generates Microsoft Store tile assets from desktop/assets/logo-icon.svg.
 *
 * The source SVG is intentionally simple: a solid square background plus one
 * polygonal Z mark. Keeping this script dependency-free prevents Store builds
 * from failing because ImageMagick or Playwright browsers are not installed.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const outputDir = path.join(desktopRoot, "msix", "assets");

const viewBoxSize = 1024;
const background = [0xd6, 0xff, 0x00, 0xff];
const foreground = [0x0a, 0x0e, 0x14, 0xff];
const supersample = 3;

const zentroMark = [
  [287.89, 355.33],
  [570.48, 355.33],
  [287.89, 666.96],
  [287.89, 778.8],
  [736.11, 778.8],
  [736.11, 666.96],
  [451.81, 666.96],
  [736.11, 348.5],
  [736.11, 245.2],
  [287.89, 245.2],
];

const assets = [
  ["StoreLogo.png", 50, 50],
  ["Square44x44Logo.png", 44, 44],
  ["Square150x150Logo.png", 150, 150],
  ["icon.png", 256, 256],
  ["Wide310x150Logo.png", 310, 150],
];

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

const crc32 = (buffer) => {
  let c = 0xff_ff_ff_ff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xff_ff_ff_ff) >>> 0;
};

const pngChunk = (type, data = Buffer.alloc(0)) => {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
};

const encodePng = (width, height, rgba) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const lineStart = y * (1 + width * 4);
    scanlines[lineStart] = 0;
    rgba.copy(scanlines, lineStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(scanlines)),
    pngChunk("IEND"),
  ]);
};

const isInsidePolygon = (x, y, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
};

const renderAsset = (width, height) => {
  const pixels = Buffer.alloc(width * height * 4);
  const sourceSize = Math.max(width, height);
  const offsetX = (width - sourceSize) / 2;
  const offsetY = (height - sourceSize) / 2;
  const sampleCount = supersample * supersample;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let coverage = 0;

      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const sampleX = x + (sx + 0.5) / supersample;
          const sampleY = y + (sy + 0.5) / supersample;
          const svgX = ((sampleX - offsetX) / sourceSize) * viewBoxSize;
          const svgY = ((sampleY - offsetY) / sourceSize) * viewBoxSize;

          if (isInsidePolygon(svgX, svgY, zentroMark)) {
            coverage += 1;
          }
        }
      }

      const alpha = coverage / sampleCount;
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        pixels[index + channel] = Math.round(
          background[channel] * (1 - alpha) + foreground[channel] * alpha
        );
      }
    }
  }

  return encodePng(width, height, pixels);
};

await fs.mkdir(outputDir, { recursive: true });

for (const [filename, width, height] of assets) {
  await fs.writeFile(
    path.join(outputDir, filename),
    renderAsset(width, height)
  );
}

console.log("MSIX assets generated from logo-icon.svg");
