import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NotificationDto } from "@/types/domain";
import { NotificationPreview } from "./notification-preview";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} onClick={onClick}>
      {children}
    </a>
  ),
}));

const notification: NotificationDto = {
  id: "notification-1",
  type: "TASK_ASSIGNED",
  title: "Review project brief",
  body: "A task was assigned to you.",
  href: "/weekly?task=task-1",
  readAt: null,
  createdAt: "2026-10-30T12:00:00.000Z",
};

function renderPreview() {
  const onRead = vi.fn();
  const onNavigate = vi.fn();
  render(
    <NotificationPreview
      items={[notification]}
      unreadCount={1}
      loading={false}
      error={false}
      online
      reading={false}
      onRetry={vi.fn()}
      onRead={onRead}
      onNavigate={onNavigate}
    />,
  );
  return { onRead, onNavigate };
}

describe("NotificationPreview", () => {
  it("previews notifications, marks one read, and links to the full inbox", () => {
    const { onRead, onNavigate } = renderPreview();

    expect(screen.getByText("Review project brief")).toBeVisible();
    expect(screen.getByText("1 unread")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Mark Review project brief as read" }),
    );
    expect(onRead).toHaveBeenCalledWith("notification-1");

    const viewAll = screen.getByRole("link", { name: "View All" });
    expect(viewAll).toHaveAttribute("href", "/notifications");
    fireEvent.click(viewAll);
    expect(onNavigate).toHaveBeenCalledWith("/notifications");
  });

  it("provides a retry action when notifications fail to load", () => {
    const onRetry = vi.fn();
    render(
      <NotificationPreview
        items={[]}
        unreadCount={0}
        loading={false}
        error
        online
        reading={false}
        onRetry={onRetry}
        onRead={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
