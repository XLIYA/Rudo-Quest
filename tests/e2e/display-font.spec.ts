import { expect, test } from "./fixtures";

test("pixel headings paint full glyphs and follow both theme colors", async ({
  page,
}) => {
  await page.goto("/offline");
  const heading = page.getByRole("heading", { name: "Offline", exact: true });
  await expect(heading).toBeVisible();

  for (const dark of [false, true]) {
    await page.evaluate((enabled) => {
      document.documentElement.classList.toggle("dark", enabled);
    }, dark);

    const result = await heading.evaluate(async (element) => {
      const style = getComputedStyle(element);
      const fonts = await document.fonts.load('600 32px "Bitcount"', "H");
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.font = '600 32px "Bitcount"';
      context.fillText("H", 8, 40);
      const { data } = context.getImageData(0, 0, 64, 64);
      const rows = new Set<number>();
      const columns = new Set<number>();
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          if ((data[(y * 64 + x) * 4 + 3] ?? 0) > 32) {
            rows.add(y);
            columns.add(x);
          }
        }
      }
      const reference = document.createElement("span");
      reference.style.color = "var(--text-primary)";
      element.append(reference);
      const themeColor = getComputedStyle(reference).color;
      reference.remove();
      return {
        loaded: fonts.some((font) => font.status === "loaded"),
        family: style.fontFamily,
        filter: style.filter,
        color: style.color,
        themeColor,
        rows: rows.size,
        columns: columns.size,
      };
    });

    expect(result.loaded).toBe(true);
    expect(result.family).toContain("Bitcount");
    expect(result.filter).toBe("none");
    expect(result.color).toBe(result.themeColor);
    // A successful FontFace load alone does not prove its glyphs paint:
    // unsupported color fonts may paint only a dot or an empty placeholder.
    expect(result.rows).toBeGreaterThan(12);
    expect(result.columns).toBeGreaterThan(10);
  }
});

test("Persian text uses Vazirmatn while English keeps its configured font", async ({
  page,
}) => {
  await page.goto("/offline");
  await page.evaluate(async () => {
    const samples = document.createElement("div");
    samples.innerHTML = `
      <p id="persian-sans" class="font-sans">فارسی پچژگکی</p>
      <p id="persian-mono" class="font-mono">فارسی پچژگکی</p>
      <h2 id="persian-display" class="font-display">فارسی پچژگکی</h2>
      <p id="english-mono" class="font-mono">English text 123</p>
      <input id="persian-input" class="font-sans" value="فارسی پچژگکی" />
    `;
    document.body.append(samples);
    await Promise.all([
      document.fonts.load('400 24px "Vazirmatn"', "فارسی پچژگکی"),
      document.fonts.load('400 24px "JetBrains Mono"', "English text 123"),
    ]);
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = (await cdp.send("DOM.getDocument")) as {
    root: { nodeId: number };
  };
  const getPlatformFonts = async (selector: string) => {
    const { nodeId } = (await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector,
    })) as { nodeId: number };
    const { fonts } = (await cdp.send("CSS.getPlatformFontsForNode", {
      nodeId,
    })) as {
      fonts: Array<{ familyName: string; glyphCount: number }>;
    };
    return fonts.map((font) => font.familyName);
  };

  for (const selector of ["#persian-sans", "#persian-mono", "#persian-display"]) {
    expect(await getPlatformFonts(selector)).toContain("Vazirmatn");
  }
  expect(await getPlatformFonts("#english-mono")).toContain("JetBrains Mono");
  await expect(page.locator("#persian-input")).toHaveCSS(
    "font-family",
    /JetBrains Mono.*Vazirmatn/,
  );
  await cdp.detach();
});
