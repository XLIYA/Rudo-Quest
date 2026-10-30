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

const logo = await fs.readFile("public/branding/rudo-logo.png");
const brandOrange = { r: 200, g: 97, b: 63, alpha: 1 };

async function createLogo(size) {
  return sharp(logo).resize(size, size, { fit: "fill" }).ensureAlpha().png().toBuffer();
}

async function createTransparentLogo() {
  const { data, info } = await sharp(logo)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const background = [brandOrange.r, brandOrange.g, brandOrange.b];
  const backgroundDifferences = [
    background[0] - background[1],
    background[1] - background[2],
  ];
  const backgroundDifferenceLength = backgroundDifferences.reduce(
    (sum, channel) => sum + channel ** 2,
    0,
  );

  // Recover antialias coverage from the orange-to-neutral blend in the source.
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const remainingBackground =
      ((data[offset] - data[offset + 1]) * backgroundDifferences[0] +
        (data[offset + 1] - data[offset + 2]) * backgroundDifferences[1]) /
      backgroundDifferenceLength;
    const opacity = Math.min(1, Math.max(0, 1 - remainingBackground));

    data[offset + 3] = Math.round(opacity * 255);
    if (opacity > 0) {
      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = Math.min(
          255,
          Math.max(
            0,
            Math.round(
              (data[offset + channel] - background[channel] * (1 - opacity)) / opacity,
            ),
          ),
        );
      }
    } else {
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
    }
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

async function createMaskableLogo(size) {
  const insetSize = Math.round(size * 0.68);
  const inset = await sharp(logo)
    .resize(insetSize, insetSize, { fit: "fill" })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: brandOrange,
    },
  })
    .composite([
      {
        input: inset,
        left: Math.floor((size - insetSize) / 2),
        top: Math.floor((size - insetSize) / 2),
      },
    ])
    .png()
    .toBuffer();
}

await fs.mkdir("public/icons", { recursive: true });
await fs.writeFile(
  "public/branding/rudo-logo-transparent.png",
  await createTransparentLogo(),
);
await fs.writeFile("public/icons/icon-192.png", await createLogo(192));
await fs.writeFile("public/icons/icon-512.png", await createLogo(512));
await fs.writeFile("public/icons/icon-maskable-192.png", await createMaskableLogo(192));
await fs.writeFile("public/icons/icon-maskable-512.png", await createMaskableLogo(512));

const appleIconSizes = [120, 152, 167, 180];
await Promise.all(
  appleIconSizes.map((size) =>
    createLogo(size).then((icon) =>
      fs.writeFile(`public/icons/apple-touch-icon-${size}.png`, icon),
    ),
  ),
);
const appleTouchIcon = await createLogo(180);
await fs.writeFile("public/apple-touch-icon.png", appleTouchIcon);
await fs.writeFile("public/icons/apple-touch-icon.png", appleTouchIcon);

const faviconImages = await Promise.all(
  [16, 32, 48].map(async (size) => ({
    size,
    png: await createLogo(size),
  })),
);
const favicon = createIcoFromPngs(faviconImages);
await fs.writeFile("public/favicon.ico", favicon);
await fs.writeFile("src/app/favicon.ico", favicon);
console.log("Generated Rudo Quest PWA and light/dark iOS icons.");
