import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskClassification } from "./task-classification";

describe("TaskClassification", () => {
  it("communicates task type and priority with visible text", () => {
    render(<TaskClassification taskType="BUG" priority="URGENT" />);

    expect(screen.getByText("Bug")).toBeVisible();
    expect(screen.getByText("Urgent")).toBeVisible();
    expect(screen.getByLabelText("Bug, Urgent priority")).toBeVisible();
  });

  it("omits the neutral priority badge while retaining the task type", () => {
    render(<TaskClassification taskType="TASK" priority="NONE" />);

    expect(screen.getByText("Task")).toBeVisible();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
  });
});
