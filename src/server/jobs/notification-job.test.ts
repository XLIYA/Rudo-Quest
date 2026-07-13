import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/api/errors";

const repository = vi.hoisted(() => ({
  countDueTasksForDate: vi.fn(),
  listNotificationEligibleProfiles: vi.fn(),
}));
const notifications = vi.hoisted(() => ({
  createNotification: vi.fn(),
  retryPushDeliveries: vi.fn(),
  sendPushForNotification: vi.fn(),
}));
const profileService = vi.hoisted(() => ({
  cleanupExpiredProfileAssetUploads: vi.fn(),
}));

vi.mock("@/server/repositories/notification-repository", () => repository);
vi.mock("@/server/services/notification-service", () => notifications);
vi.mock("@/server/jobs/profile-upload-cleanup", () => profileService);

const profile = {
  id: "00000000-0000-4000-8000-000000000001",
  timeZone: "Asia/Tokyo",
  dailyReminderTime: "09:00:00",
  notificationsEnabled: true,
  dailyReminderEnabled: true,
  quietHoursStart: "22:00:00",
  quietHoursEnd: "07:00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  repository.listNotificationEligibleProfiles.mockResolvedValue([profile]);
  repository.countDueTasksForDate.mockResolvedValue(2);
  notifications.retryPushDeliveries.mockResolvedValue({ attempted: 0, sent: 0 });
  profileService.cleanupExpiredProfileAssetUploads.mockResolvedValue({ removed: 0 });
  notifications.createNotification.mockImplementation(
    async (input: { type: string }) => ({
      id: input.type,
      type: input.type,
      title: input.type,
      body: null,
      href: null,
      readAt: null,
      createdAt: new Date().toISOString(),
    }),
  );
  notifications.sendPushForNotification.mockResolvedValue({ sent: 1 });
});

describe("notification cron eligibility", () => {
  it("evaluates reminder time in the user's timezone", async () => {
    const { runNotificationCron } = await import("./notification-job");
    await runNotificationCron(new Date("2026-07-12T00:00:00.000Z"));

    expect(repository.countDueTasksForDate).toHaveBeenCalledWith(
      profile.id,
      "2026-07-12",
    );
    expect(notifications.createNotification).toHaveBeenCalledTimes(2);
  });

  it("suppresses delivery during quiet hours and still retries old failures separately", async () => {
    const { runNotificationCron } = await import("./notification-job");
    await runNotificationCron(new Date("2026-07-12T13:00:00.000Z"));

    expect(notifications.retryPushDeliveries).toHaveBeenCalled();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it("creates a daily digest even when there are no due tasks", async () => {
    repository.countDueTasksForDate.mockResolvedValue(0);
    const { runNotificationCron } = await import("./notification-job");
    await runNotificationCron(new Date("2026-07-12T00:00:00.000Z"));

    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
    expect(notifications.createNotification.mock.calls[0]?.[0].type).toBe("DAILY_DIGEST");
  });
});

describe("cron authorization", () => {
  it("rejects missing or incorrect bearer credentials", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const { assertCronAuthorized } = await import("./notification-job");
    expect(() => assertCronAuthorized(null)).toThrow(AppError);
    expect(() => assertCronAuthorized("Bearer wrong")).toThrow(AppError);
    expect(() => assertCronAuthorized("Bearer cron-secret")).not.toThrow();
    vi.unstubAllEnvs();
  });
});
