"use client";

import * as Icons from "lucide-react";
import { projectColorKeys, projectIconKeys, type ProjectColorKey, type ProjectIconKey } from "@/types/domain";
import { getProjectColor } from "@/lib/theme/project-colors";
import { cn } from "@/lib/utils/cn";

type IconComponent = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const iconMap: Record<ProjectIconKey, IconComponent> = {
  Compass: Icons.Compass,
  CheckCircle2: Icons.CheckCircle2,
  Rocket: Icons.Rocket,
  BookOpen: Icons.BookOpen,
  Code2: Icons.Code2,
  Palette: Icons.Palette,
  BriefcaseBusiness: Icons.BriefcaseBusiness,
  Megaphone: Icons.Megaphone,
  Wrench: Icons.Wrench,
  FlaskConical: Icons.FlaskConical,
  HeartHandshake: Icons.HeartHandshake,
  Map: Icons.Map,
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
export function ProjectIconGlyph({ iconKey, className }: { iconKey: ProjectIconKey; className?: string }) {
  switch (iconKey) {
    case "CheckCircle2":
      return <Icons.CheckCircle2 className={className} aria-hidden />;
    case "Rocket":
      return <Icons.Rocket className={className} aria-hidden />;
    case "BookOpen":
      return <Icons.BookOpen className={className} aria-hidden />;
    case "Code2":
      return <Icons.Code2 className={className} aria-hidden />;
    case "Palette":
      return <Icons.Palette className={className} aria-hidden />;
    case "BriefcaseBusiness":
      return <Icons.BriefcaseBusiness className={className} aria-hidden />;
    case "Megaphone":
      return <Icons.Megaphone className={className} aria-hidden />;
    case "Wrench":
      return <Icons.Wrench className={className} aria-hidden />;
    case "FlaskConical":
      return <Icons.FlaskConical className={className} aria-hidden />;
    case "HeartHandshake":
      return <Icons.HeartHandshake className={className} aria-hidden />;
    case "Map":
      return <Icons.Map className={className} aria-hidden />;
    case "Compass":
    default:
      return <Icons.Compass className={className} aria-hidden />;
  }
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
      <div className="grid grid-cols-4 gap-2">
        {projectColorKeys.map((key) => {
          const color = getProjectColor(key);
          return (
            <button
              type="button"
              key={key}
              onClick={() => onChange(key)}
              aria-pressed={value === key}
              className={cn(
                "min-h-11 rounded-md border px-2 text-xs font-semibold capitalize",
                value === key ? "border-brand" : "border-border",
              )}
              style={{ background: color.soft, color: color.text }}
            >
              {key}
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
      <div className="grid grid-cols-6 gap-2">
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
