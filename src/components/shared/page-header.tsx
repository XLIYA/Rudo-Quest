import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  inlineAction?: boolean;
};

/**
 * Purpose: Render consistent page headers for app screens.
 * Inputs: Title, optional description, and optional action.
 * Output: Responsive header row.
 * Side effects: None.
 */
export function PageHeader({
  title,
  description,
  action,
  compact,
  inlineAction,
}: PageHeaderProps) {
  return (
    <header
      className={
        inlineAction
          ? "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"
          : "flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      }
    >
      <div className={inlineAction ? "contents" : "min-w-0"}>
        <h1
          title={title}
          className={`min-w-0 font-display font-semibold tracking-[-0.03em] text-text-primary ${compact ? "truncate text-xl sm:text-2xl" : "text-3xl sm:text-4xl"}`}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={`${inlineAction ? "col-span-2 row-start-2" : "mt-1"} ${compact ? "truncate" : "max-w-2xl"} text-sm leading-6 text-text-secondary`}
            title={description}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className={inlineAction ? "col-start-2 row-start-1" : "shrink-0"}>
          {action}
        </div>
      ) : null}
    </header>
  );
}
