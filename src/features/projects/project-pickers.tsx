"use client";

import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Bug,
  CalendarCheck,
  CheckCircle2,
  Code2,
  Compass,
  Database,
  FileText,
  FlaskConical,
  GraduationCap,
  Hammer,
  HeartHandshake,
  Lightbulb,
  Map,
  Megaphone,
  PackageCheck,
  Palette,
  Rocket,
  ShieldCheck,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import { createElement } from "react";
import {
  projectColorKeys,
  projectIconKeys,
  type ProjectColorKey,
  type ProjectIconKey,
} from "@/types/domain";
import { getProjectColor } from "@/lib/theme/project-colors";
import { cn } from "@/lib/utils/cn";

export { getProjectColor };

type IconComponent = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const iconMap: Record<ProjectIconKey, IconComponent> = {
  Compass,
  CheckCircle2,
  Rocket,
  BookOpen,
  Code2,
  Palette,
  BriefcaseBusiness,
  Megaphone,
  Wrench,
  FlaskConical,
  HeartHandshake,
  Map,
  Target,
  CalendarCheck,
  FileText,
  Bug,
  ShieldCheck,
  Lightbulb,
  Hammer,
  Users,
  GraduationCap,
  BarChart3,
  Database,
  PackageCheck,
};

/**
 * Purpose: Resolve an allowlisted Lucide project icon.
 * Inputs: Icon key.
 * Output: Lucide icon component.
 * Side effects: None.
 */
export function resolveProjectIcon(iconKey: ProjectIconKey): IconComponent {
  return iconMap[iconKey];
}

/**
 * Purpose: Render an allowlisted project icon without creating ad hoc components in callers.
 * Inputs: Project icon key and className.
 * Output: Lucide icon element.
 * Side effects: None.
 */
export function ProjectIconGlyph({
  iconKey,
  className,
}: {
  iconKey: ProjectIconKey;
  className?: string;
}) {
  return createElement(resolveProjectIcon(iconKey), {
    className,
    "aria-hidden": true,
  });
}

/**
 * Purpose: Render an accessible fixed project color picker.
 * Inputs: Selected color key and change handler.
 * Output: Button grid.
 * Side effects: Calls onChange on selection.
 */
export function ProjectColorPicker({
  value,
  onChange,
}: {
  value: ProjectColorKey;
  onChange: (value: ProjectColorKey) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">Color</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {projectColorKeys.map((key) => {
          const color = getProjectColor(key);
          const label = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
          return (
            <button
              type="button"
              key={key}
              onClick={() => onChange(key)}
              aria-label={`${label} project color`}
              aria-pressed={value === key}
              title={label}
              className={cn(
                "flex min-h-11 min-w-0 items-center justify-center rounded-md border bg-surface p-1 transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-surface-muted motion-reduce:transform-none",
                value === key
                  ? "border-brand shadow-[inset_0_0_0_2px_var(--brand-soft)]"
                  : "border-border",
              )}
            >
              <span
                className="size-6 shrink-0 rounded-sm border border-border"
                style={{ background: color.main }}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Purpose: Render an accessible fixed Lucide icon picker.
 * Inputs: Selected icon key and change handler.
 * Output: Button grid.
 * Side effects: Calls onChange on selection.
 */
export function ProjectIconPicker({
  value,
  onChange,
}: {
  value: ProjectIconKey;
  onChange: (value: ProjectIconKey) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">Icon</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {projectIconKeys.map((key) => {
          return (
            <button
              type="button"
              key={key}
              onClick={() => onChange(key)}
              aria-label={key}
              aria-pressed={value === key}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-md border",
                value === key ? "border-brand bg-brand-soft text-brand" : "border-border",
              )}
            >
              <ProjectIconGlyph iconKey={key} className="size-5" />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
