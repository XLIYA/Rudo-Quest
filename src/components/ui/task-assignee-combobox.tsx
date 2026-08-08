"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import type { ProfileSummary } from "@/types/domain";
import { AppCombobox } from "./app-combobox";

export type TaskAssigneeComboboxProps = {
  value: string | null;
  currentAssignee: ProfileSummary | null;
  projectId: string | null;
  onChange: (value: string | null, profile?: ProfileSummary) => void;
  disabled: boolean;
};

/**
 * Purpose: Search, select, or clear one active member for a project task.
 * Inputs: Controlled assignee, current profile, project scope, and disabled state.
 * Output: Debounced accessible member combobox or personal-task guidance.
 * Side effects: Fetches project-member suggestions and invokes controlled changes.
 */
export function TaskAssigneeCombobox({
  value,
  currentAssignee,
  projectId,
  onChange,
  disabled,
}: TaskAssigneeComboboxProps) {
  const [search, setSearch] = useState(
    currentAssignee ? `${currentAssignee.displayName} (@${currentAssignee.handle})` : "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const suggestions = useQuery({
    queryKey: ["user-suggestions", debouncedSearch, projectId],
    queryFn: ({ signal }) =>
      apiGet<ProfileSummary[]>(
        `/api/users/suggest?q=${encodeURIComponent(debouncedSearch)}&memberProjectId=${projectId}`,
        signal,
      ),
    enabled: !disabled && Boolean(projectId) && debouncedSearch.trim().length >= 2,
  });
  const options =
    suggestions.data?.map((profile) => ({
      value: profile.id,
      label: `${profile.displayName} (@${profile.handle})`,
    })) ?? [];

  if (!projectId) {
    return (
      <p className="text-xs text-text-tertiary">Personal tasks stay assigned to you.</p>
    );
  }
  return (
    <div className="grid gap-2">
      <AppCombobox
        label="Assignee"
        value={search}
        onChange={(next) => {
          setSearch(next);
          onChange(null);
        }}
        onOptionSelect={(option) => {
          const profile = suggestions.data?.find(
            (candidate) => candidate.id === option.value,
          );
          setSearch(option.label);
          onChange(option.value, profile);
        }}
        options={options}
        placeholder="Search project members"
        disabled={disabled}
      />
      {value ? (
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-3 text-left text-xs text-text-secondary hover:bg-surface-muted"
          onClick={() => {
            setSearch("");
            onChange(null);
          }}
          disabled={disabled}
        >
          Clear assignee
        </button>
      ) : (
        <span className="text-xs text-text-tertiary">
          Leave unassigned or choose an active project member.
        </span>
      )}
    </div>
  );
}
