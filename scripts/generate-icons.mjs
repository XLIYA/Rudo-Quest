import fs from "node:fs/promises";
import sharp from "sharp";

const svg = await fs.readFile("src/assets/brand/rudo-mark.svg", "utf8");
await fs.mkdir("public/icons", { recursive: true });
await sharp(Buffer.from(svg)).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(svg)).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
await sharp(Buffer.from(svg)).resize(32, 32).png().toFile("public/favicon.ico");
console.log("Generated Rudo Quest icons.");
