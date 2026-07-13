import { beforeEach, describe, expect, it, vi } from "vitest";
import { countDueTasksForDate, insertNotification } from "./notification-repository";

const dbMock = vi.hoisted(() => {
  const captured = {
    wherePredicate: undefined as unknown,
  };
  const query: {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    leftJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(),
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.from.mockReturnValue(query);
  query.leftJoin.mockReturnValue(query);
  query.where.mockImplementation((predicate: unknown) => {
    captured.wherePredicate = predicate;
    return Promise.resolve([{ id: "task-1" }]);
  });
  return { captured, query };
});

vi.mock("@/lib/db/client", () => ({
  getDb: () => dbMock.query,
}));

function collectPredicateTokens(value: unknown): string[] {
  const tokens: string[] = [];
  const seen = new WeakSet<object>();

  function walk(item: unknown): void {
    if (!item || typeof item !== "object") return;
    if (seen.has(item)) return;
    seen.add(item);

    if (Array.isArray(item)) {
      for (const child of item) walk(child);
      return;
    }

    const record = item as Record<string, unknown>;
    if (item.constructor?.name === "StringChunk" && Array.isArray(record.value)) {
      tokens.push(...record.value.map(String));
    }
    if (item.constructor?.name === "Param") {
      tokens.push(`PARAM:${String(record.value)}`);
    }

    for (const child of Object.values(record)) walk(child);
  }

  walk(value);
  return tokens;
}

describe("notification repository", () => {
  beforeEach(() => {
    dbMock.captured.wherePredicate = undefined;
    vi.clearAllMocks();
  });

  it("excludes completed tasks from daily due counts", async () => {
    await expect(countDueTasksForDate("user-1", "2026-07-10")).resolves.toBe(1);

    const tokens = collectPredicateTokens(dbMock.captured.wherePredicate);
    expect(tokens).toContain(" <> ");
    expect(tokens).toContain("PARAM:DONE");
  });

  it("uses targetless conflict handling for the partial dedupe index", async () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000001",
      recipientId: "00000000-0000-4000-8000-000000000002",
      type: "TASK_ASSIGNED",
      title: "Task assigned",
      body: "Review the release",
      href: "/weekly?date=2026-07-10",
      dedupeKey: null,
      readAt: null,
      createdAt: new Date("2026-07-10T00:00:00.000Z"),
    };
    const returning = vi.fn().mockResolvedValue([row]);
    const onConflictDoNothing = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));

    await expect(
      insertNotification(
        {
          recipientId: row.recipientId,
          type: "TASK_ASSIGNED",
          title: row.title,
          body: row.body,
          href: row.href,
        },
        { insert } as never,
      ),
    ).resolves.toMatchObject({ id: row.id, type: "TASK_ASSIGNED" });

    expect(onConflictDoNothing).toHaveBeenCalledWith();
  });
});
