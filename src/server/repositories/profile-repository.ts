import { and, eq, ilike, ne, or, sql } from "drizzle-orm";
import { profiles, projectMemberships } from "@/db/schema";
import { getDb } from "@/lib/db/client";
import { createProfileAssetUrlMap, profileAssetUrl } from "@/server/profile-assets";
import type { BannerPresetKey, ProfileSummary, ThemePreference } from "@/types/domain";

/**
 * Purpose: Find a profile by user ID.
 * Inputs: Profile UUID.
 * Output: Profile row or null.
 * Side effects: Opens the database connection lazily.
 */
export async function findProfileById(id: string) {
  const rows = await getDb().select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Purpose: Insert a profile for a verified Supabase user when it does not exist.
 * Inputs: Auth user ID, email, display name, handle, timezone.
 * Output: Created or existing profile row.
 * Side effects: Writes to profiles on first sign-in.
 */
export async function upsertProfile(input: {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  timeZone: string;
}) {
  const existing = await findProfileById(input.id);
  if (existing) return existing;
  const [created] = await getDb()
    .insert(profiles)
    .values({
      id: input.id,
      email: input.email.toLowerCase(),
      handle: input.handle,
      displayName: input.displayName,
      timeZone: input.timeZone,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const raced = await findProfileById(input.id);
  if (!raced) throw new Error("Profile insert conflicted with another identity.");
  return raced;
}

/**
 * Purpose: Update profile identity fields.
 * Inputs: User ID and mutable profile fields.
 * Output: Updated profile row.
 * Side effects: Writes updated_at and changed fields.
 */
export async function updateProfileIdentity(
  userId: string,
  values: { displayName?: string; handle?: string },
) {
  const [updated] = await getDb()
    .update(profiles)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(profiles.id, userId))
    .returning();
  return updated ?? null;
}

/**
 * Purpose: Update profile preferences and notification settings.
 * Inputs: User ID and preference values.
 * Output: Updated profile row.
 * Side effects: Writes updated_at and changed fields.
 */
export async function updateProfilePreferences(
  userId: string,
  values: {
    themePreference?: ThemePreference;
    timeZone?: string;
    notificationsEnabled?: boolean;
    dailyReminderEnabled?: boolean;
    dailyReminderTime?: string | null;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  },
) {
  const [updated] = await getDb()
    .update(profiles)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(profiles.id, userId))
    .returning();
  return updated ?? null;
}

/**
 * Purpose: Store profile asset paths after signed Supabase Storage uploads.
 * Inputs: User ID and avatar/banner path changes.
 * Output: Updated profile row.
 * Side effects: Persists asset path and updated_at.
 */
export async function updateProfileAssets(
  userId: string,
  values: {
    avatarPath?: string | null;
    bannerPath?: string | null;
    bannerPresetKey?: BannerPresetKey | null;
  },
) {
  const [updated] = await getDb()
    .update(profiles)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(profiles.id, userId))
    .returning();
  return updated ?? null;
}

/**
 * Purpose: Search public user profile suggestions by handle and display name.
 * Inputs: Query text, optional project ID whose existing members are excluded.
 * Output: Up to eight public profile summaries.
 * Side effects: Reads profiles and memberships.
 * Business rule: Raw email is never searched or returned.
 */
export async function suggestUsers(input: {
  q: string;
  excludeProjectId?: string;
  memberProjectId?: string;
}): Promise<ProfileSummary[]> {
  const query = `%${input.q}%`;
  const db = getDb();
  const excluded = input.excludeProjectId
    ? db
        .select({ userId: projectMemberships.userId })
        .from(projectMemberships)
        .where(eq(projectMemberships.projectId, input.excludeProjectId))
    : null;
  const members = input.memberProjectId
    ? db
        .select({ userId: projectMemberships.userId })
        .from(projectMemberships)
        .where(eq(projectMemberships.projectId, input.memberProjectId))
    : null;
  const rows = await db
    .select({
      id: profiles.id,
      handle: profiles.handle,
      displayName: profiles.displayName,
      avatarPath: profiles.avatarPath,
    })
    .from(profiles)
    .where(
      and(
        or(ilike(profiles.handle, query), ilike(profiles.displayName, query)),
        excluded ? sql`${profiles.id} not in ${excluded}` : undefined,
        members ? sql`${profiles.id} in ${members}` : undefined,
      ),
    )
    .orderBy(profiles.handle)
    .limit(8);
  const avatarUrls = await createProfileAssetUrlMap(rows.map((row) => row.avatarPath));
  return rows.map((row) => ({
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    avatarUrl: profileAssetUrl(row.avatarPath, avatarUrls),
  }));
}

/**
 * Purpose: Ensure a handle is unique before update.
 * Inputs: Candidate handle and user ID to exclude.
 * Output: True when no other profile uses the handle.
 * Side effects: Reads profiles.
 */
export async function isHandleAvailable(
  handle: string,
  userId: string,
): Promise<boolean> {
  const rows = await getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.handle, handle), ne(profiles.id, userId)))
    .limit(1);
  return rows.length === 0;
}
