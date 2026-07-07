import { getDashboardAggregate } from "@/server/repositories/dashboard-repository";

/**
 * Purpose: Return dashboard aggregates for the authenticated user.
 * Inputs: User ID and validated date range.
 * Output: Dashboard aggregate DTO.
 * Side effects: Reads repositories.
 */
export async function getDashboard(userId: string, from: string, to: string) {
  return getDashboardAggregate({ userId, from, to });
}
