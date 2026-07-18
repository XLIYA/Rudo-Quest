import fs from "node:fs/promises";
import sharp from "sharp";

function createIcoFromPngs(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + images.length * 16;
  const directories = images.map(({ png, size }) => {
    const directory = Buffer.alloc(16);
    directory.writeUInt8(size === 256 ? 0 : size, 0);
    directory.writeUInt8(size === 256 ? 0 : size, 1);
    directory.writeUInt8(0, 2);
    directory.writeUInt8(0, 3);
    directory.writeUInt16LE(1, 4);
    directory.writeUInt16LE(32, 6);
    directory.writeUInt32LE(png.length, 8);
    directory.writeUInt32LE(offset, 12);
    offset += png.length;
    return directory;
  });

  return Buffer.concat([header, ...directories, ...images.map(({ png }) => png)]);
}

const svg = await fs.readFile("src/assets/brand/rudo-mark.svg", "utf8");
const roundedBackground =
  '<rect x="4" y="4" width="88" height="88" rx="28" fill="#C8613F"/>';
const fullBleedSvg = svg.replace(
  roundedBackground,
  '<rect width="96" height="96" fill="#C8613F"/>',
);
if (fullBleedSvg === svg) {
  throw new Error("Rudo mark background could not be prepared for install icons.");
}

await fs.mkdir("public/icons", { recursive: true });
await sharp(Buffer.from(svg)).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(fullBleedSvg))
  .resize(192, 192)
  .png()
  .toFile("public/icons/icon-maskable-192.png");
await sharp(Buffer.from(fullBleedSvg))
  .resize(512, 512)
  .png()
  .toFile("public/icons/icon-maskable-512.png");

const appleIconSizes = [120, 152, 167, 180];
await Promise.all(
  appleIconSizes.map((size) =>
    sharp(Buffer.from(fullBleedSvg))
      .resize(size, size)
      .png()
      .toFile(`public/icons/apple-touch-icon-${size}.png`),
  ),
);
const appleTouchIcon = await sharp(Buffer.from(fullBleedSvg))
  .resize(180, 180)
  .png()
  .toBuffer();
await fs.writeFile("public/apple-touch-icon.png", appleTouchIcon);
await fs.writeFile("public/icons/apple-touch-icon.png", appleTouchIcon);

const faviconImages = await Promise.all(
  [16, 32, 48].map(async (size) => ({
    size,
    png: await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer(),
  })),
);
const favicon = createIcoFromPngs(faviconImages);
await fs.writeFile("public/favicon.ico", favicon);
await fs.writeFile("src/app/favicon.ico", favicon);
console.log("Generated Rudo Quest icons.");
