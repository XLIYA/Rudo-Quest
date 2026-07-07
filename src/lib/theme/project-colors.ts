import type { ProjectColorKey } from "@/types/domain";

export type ProjectColorToken = {
  main: string;
  soft: string;
  dark: string;
  text: string;
  focus: string;
};

export const projectColors: Record<ProjectColorKey, ProjectColorToken> = {
  orange: { main: "#FF5A1F", soft: "#FFF0EA", dark: "#FF6A35", text: "#7A2600", focus: "#FF8A5B" },
  red: { main: "#D94841", soft: "#FDEDEC", dark: "#FF8A80", text: "#7A1712", focus: "#EF9A9A" },
  rose: { main: "#C43C72", soft: "#FCECF3", dark: "#F48FB1", text: "#6F1238", focus: "#F06292" },
  violet: { main: "#7357D8", soft: "#F0EDFF", dark: "#B7A8FF", text: "#342073", focus: "#9B87F5" },
  blue: { main: "#2563EB", soft: "#EAF1FF", dark: "#93B4FF", text: "#113A8A", focus: "#7AA2FF" },
  cyan: { main: "#008CA8", soft: "#E5F8FB", dark: "#65D9EE", text: "#00505F", focus: "#3BC4DE" },
  green: { main: "#198754", soft: "#EAF7F0", dark: "#6ED7A5", text: "#0B4C2E", focus: "#54C58F" },
  yellow: { main: "#B7791F", soft: "#FFF6DF", dark: "#F4C76E", text: "#674100", focus: "#E9B84E" },
};

/**
 * Purpose: Return token values for a project color key.
 * Inputs: Project color key.
 * Output: Color token object.
 * Side effects: None.
 */
export function getProjectColor(key: ProjectColorKey): ProjectColorToken {
  return projectColors[key];
}
