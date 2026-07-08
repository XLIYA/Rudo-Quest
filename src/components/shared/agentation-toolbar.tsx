"use client";

import dynamic from "next/dynamic";
import type { AgentationProps } from "agentation";

const Agentation = dynamic<AgentationProps>(
  () => import("agentation").then((mod) => mod.Agentation),
  { ssr: false },
);

export function AgentationToolbar() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Agentation
      endpoint={process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT ?? "http://localhost:4747"}
    />
  );
}
