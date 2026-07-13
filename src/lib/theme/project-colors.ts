import type { ProjectColorKey } from "@/types/domain";

export type ProjectColorToken = {
  main: string;
  soft: string;
  dark: string;
  text: string;
  focus: string;
};

export const projectColors: Record<ProjectColorKey, ProjectColorToken> = {
  orange: {
    main: "var(--project-orange-main)",
    soft: "var(--project-orange-soft)",
    dark: "var(--project-orange-dark)",
    text: "var(--project-orange-text)",
    focus: "var(--project-orange-focus)",
  },
  red: {
    main: "var(--project-red-main)",
    soft: "var(--project-red-soft)",
    dark: "var(--project-red-dark)",
    text: "var(--project-red-text)",
    focus: "var(--project-red-focus)",
  },
  rose: {
    main: "var(--project-rose-main)",
    soft: "var(--project-rose-soft)",
    dark: "var(--project-rose-dark)",
    text: "var(--project-rose-text)",
    focus: "var(--project-rose-focus)",
  },
  violet: {
    main: "var(--project-violet-main)",
    soft: "var(--project-violet-soft)",
    dark: "var(--project-violet-dark)",
    text: "var(--project-violet-text)",
    focus: "var(--project-violet-focus)",
  },
  blue: {
    main: "var(--project-blue-main)",
    soft: "var(--project-blue-soft)",
    dark: "var(--project-blue-dark)",
    text: "var(--project-blue-text)",
    focus: "var(--project-blue-focus)",
  },
  cyan: {
    main: "var(--project-cyan-main)",
    soft: "var(--project-cyan-soft)",
    dark: "var(--project-cyan-dark)",
    text: "var(--project-cyan-text)",
    focus: "var(--project-cyan-focus)",
  },
  green: {
    main: "var(--project-green-main)",
    soft: "var(--project-green-soft)",
    dark: "var(--project-green-dark)",
    text: "var(--project-green-text)",
    focus: "var(--project-green-focus)",
  },
  yellow: {
    main: "var(--project-yellow-main)",
    soft: "var(--project-yellow-soft)",
    dark: "var(--project-yellow-dark)",
    text: "var(--project-yellow-text)",
    focus: "var(--project-yellow-focus)",
  },
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
