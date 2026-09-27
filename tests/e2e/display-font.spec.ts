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
      const fonts = await document.fonts.load(`600 32px ${style.fontFamily}`, "H");
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.font = `600 32px ${style.fontFamily}`;
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
