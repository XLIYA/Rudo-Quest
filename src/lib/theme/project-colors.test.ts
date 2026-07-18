import { describe, expect, it } from "vitest";
import { projectColorKeys } from "@/types/domain";
import { getProjectColor, projectColors } from "@/lib/theme/project-colors";

describe("project color palette", () => {
  it("provides exactly 24 unique project colors", () => {
    expect(projectColorKeys).toHaveLength(24);
    expect(new Set(projectColorKeys)).toHaveLength(24);
  });

  it("provides every semantic token for every project color", () => {
    for (const key of projectColorKeys) {
      const color = getProjectColor(key);

      expect(projectColors[key]).toBe(color);
      expect(color).toEqual({
        main: `var(--project-${key}-main)`,
        soft: `var(--project-${key}-soft)`,
        dark: `var(--project-${key}-dark)`,
        text: `var(--project-${key}-text)`,
        focus: `var(--project-${key}-focus)`,
      });
    }
  });
});
