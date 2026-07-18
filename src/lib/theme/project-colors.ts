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
  coral: {
    main: "var(--project-coral-main)",
    soft: "var(--project-coral-soft)",
    dark: "var(--project-coral-dark)",
    text: "var(--project-coral-text)",
    focus: "var(--project-coral-focus)",
  },
  red: {
    main: "var(--project-red-main)",
    soft: "var(--project-red-soft)",
    dark: "var(--project-red-dark)",
    text: "var(--project-red-text)",
    focus: "var(--project-red-focus)",
  },
  ruby: {
    main: "var(--project-ruby-main)",
    soft: "var(--project-ruby-soft)",
    dark: "var(--project-ruby-dark)",
    text: "var(--project-ruby-text)",
    focus: "var(--project-ruby-focus)",
  },
  rose: {
    main: "var(--project-rose-main)",
    soft: "var(--project-rose-soft)",
    dark: "var(--project-rose-dark)",
    text: "var(--project-rose-text)",
    focus: "var(--project-rose-focus)",
  },
  pink: {
    main: "var(--project-pink-main)",
    soft: "var(--project-pink-soft)",
    dark: "var(--project-pink-dark)",
    text: "var(--project-pink-text)",
    focus: "var(--project-pink-focus)",
  },
  magenta: {
    main: "var(--project-magenta-main)",
    soft: "var(--project-magenta-soft)",
    dark: "var(--project-magenta-dark)",
    text: "var(--project-magenta-text)",
    focus: "var(--project-magenta-focus)",
  },
  plum: {
    main: "var(--project-plum-main)",
    soft: "var(--project-plum-soft)",
    dark: "var(--project-plum-dark)",
    text: "var(--project-plum-text)",
    focus: "var(--project-plum-focus)",
  },
  violet: {
    main: "var(--project-violet-main)",
    soft: "var(--project-violet-soft)",
    dark: "var(--project-violet-dark)",
    text: "var(--project-violet-text)",
    focus: "var(--project-violet-focus)",
  },
  indigo: {
    main: "var(--project-indigo-main)",
    soft: "var(--project-indigo-soft)",
    dark: "var(--project-indigo-dark)",
    text: "var(--project-indigo-text)",
    focus: "var(--project-indigo-focus)",
  },
  blue: {
    main: "var(--project-blue-main)",
    soft: "var(--project-blue-soft)",
    dark: "var(--project-blue-dark)",
    text: "var(--project-blue-text)",
    focus: "var(--project-blue-focus)",
  },
  sky: {
    main: "var(--project-sky-main)",
    soft: "var(--project-sky-soft)",
    dark: "var(--project-sky-dark)",
    text: "var(--project-sky-text)",
    focus: "var(--project-sky-focus)",
  },
  cyan: {
    main: "var(--project-cyan-main)",
    soft: "var(--project-cyan-soft)",
    dark: "var(--project-cyan-dark)",
    text: "var(--project-cyan-text)",
    focus: "var(--project-cyan-focus)",
  },
  teal: {
    main: "var(--project-teal-main)",
    soft: "var(--project-teal-soft)",
    dark: "var(--project-teal-dark)",
    text: "var(--project-teal-text)",
    focus: "var(--project-teal-focus)",
  },
  emerald: {
    main: "var(--project-emerald-main)",
    soft: "var(--project-emerald-soft)",
    dark: "var(--project-emerald-dark)",
    text: "var(--project-emerald-text)",
    focus: "var(--project-emerald-focus)",
  },
  green: {
    main: "var(--project-green-main)",
    soft: "var(--project-green-soft)",
    dark: "var(--project-green-dark)",
    text: "var(--project-green-text)",
    focus: "var(--project-green-focus)",
  },
  lime: {
    main: "var(--project-lime-main)",
    soft: "var(--project-lime-soft)",
    dark: "var(--project-lime-dark)",
    text: "var(--project-lime-text)",
    focus: "var(--project-lime-focus)",
  },
  yellow: {
    main: "var(--project-yellow-main)",
    soft: "var(--project-yellow-soft)",
    dark: "var(--project-yellow-dark)",
    text: "var(--project-yellow-text)",
    focus: "var(--project-yellow-focus)",
  },
  amber: {
    main: "var(--project-amber-main)",
    soft: "var(--project-amber-soft)",
    dark: "var(--project-amber-dark)",
    text: "var(--project-amber-text)",
    focus: "var(--project-amber-focus)",
  },
  terracotta: {
    main: "var(--project-terracotta-main)",
    soft: "var(--project-terracotta-soft)",
    dark: "var(--project-terracotta-dark)",
    text: "var(--project-terracotta-text)",
    focus: "var(--project-terracotta-focus)",
  },
  brown: {
    main: "var(--project-brown-main)",
    soft: "var(--project-brown-soft)",
    dark: "var(--project-brown-dark)",
    text: "var(--project-brown-text)",
    focus: "var(--project-brown-focus)",
  },
  sand: {
    main: "var(--project-sand-main)",
    soft: "var(--project-sand-soft)",
    dark: "var(--project-sand-dark)",
    text: "var(--project-sand-text)",
    focus: "var(--project-sand-focus)",
  },
  slate: {
    main: "var(--project-slate-main)",
    soft: "var(--project-slate-soft)",
    dark: "var(--project-slate-dark)",
    text: "var(--project-slate-text)",
    focus: "var(--project-slate-focus)",
  },
  gray: {
    main: "var(--project-gray-main)",
    soft: "var(--project-gray-soft)",
    dark: "var(--project-gray-dark)",
    text: "var(--project-gray-text)",
    focus: "var(--project-gray-focus)",
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
