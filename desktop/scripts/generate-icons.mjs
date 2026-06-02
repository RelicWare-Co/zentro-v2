#!/usr/bin/env node
/**
 * Regenerates desktop app icons from desktop/assets/logo-icon.svg.
 * Requires ImageMagick (`magick`) and macOS `iconutil` for .icns.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const assetsDir = path.join(desktopRoot, "assets");
const sourceSvg = path.join(assetsDir, "logo-icon.svg");

const assertMagick = () => {
  try {
    execSync("magick -version", { stdio: "ignore" });
  } catch {
    throw new Error(
      "ImageMagick (`magick`) is required to generate desktop icons."
    );
  }
};

const renderPng = (size, outputPath) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  execSync(
    `magick -density 512 "${sourceSvg}" -resize ${size}x${size} -filter Lanczos PNG32:"${outputPath}"`,
    { stdio: "inherit" }
  );
};

const writeIconSet = (iconsetDir) => {
  const entries = [
    ["icon_16x16.png", 16],
    ["icon_16x16@2x.png", 32],
    ["icon_32x32.png", 32],
    ["icon_32x32@2x.png", 64],
    ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256],
    ["icon_256x256.png", 256],
    ["icon_256x256@2x.png", 512],
    ["icon_512x512.png", 512],
    ["icon_512x512@2x.png", 1024],
  ];

  fs.mkdirSync(iconsetDir, { recursive: true });

  for (const [filename, size] of entries) {
    renderPng(size, path.join(iconsetDir, filename));
  }
};

const writeIco = (outputPath) => {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const tempPaths = sizes.map((size) => {
    const tempPath = path.join(assetsDir, `.icon-${size}.png`);
    renderPng(size, tempPath);
    return tempPath;
  });

  execSync(
    `magick ${tempPaths.map((p) => `"${p}"`).join(" ")} "${outputPath}"`,
    {
      stdio: "inherit",
    }
  );

  for (const tempPath of tempPaths) {
    fs.unlinkSync(tempPath);
  }
};

const main = () => {
  if (!fs.existsSync(sourceSvg)) {
    throw new Error(`Missing source SVG: ${sourceSvg}`);
  }

  assertMagick();

  renderPng(1024, path.join(assetsDir, "icon.png"));

  const looseSizes = [16, 32, 48, 64, 128, 256];
  for (const size of looseSizes) {
    renderPng(size, path.join(assetsDir, "icons", `icon_${size}.png`));
  }

  const iconsetDir = path.join(assetsDir, "icons", "icon.iconset");
  fs.rmSync(iconsetDir, { force: true, recursive: true });
  writeIconSet(iconsetDir);

  const legacyIconsetDir = path.join(assetsDir, "icons", "iconset");
  fs.rmSync(legacyIconsetDir, { force: true, recursive: true });
  writeIconSet(legacyIconsetDir);

  writeIco(path.join(assetsDir, "icon.ico"));

  if (process.platform === "darwin") {
    execSync(
      `iconutil -c icns "${iconsetDir}" -o "${path.join(assetsDir, "icon.icns")}"`,
      { stdio: "inherit" }
    );
  } else {
    console.warn("Skipping icon.icns generation (iconutil is macOS-only).");
  }

  console.log("Desktop icons generated from logo-icon.svg");
};

main();
