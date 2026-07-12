import type { ProfileSummary } from "@/types/domain";
import { AppAvatar } from "./app-avatar";

export type AppAvatarStackProps = {
  users: ProfileSummary[];
};

/**
 * Purpose: Render a compact member avatar stack.
 * Inputs: Profile summaries.
 * Output: Overlapped avatars with accessible labels.
 * Side effects: None.
 */
export function AppAvatarStack({ users }: AppAvatarStackProps) {
  return (
    <div className="flex -space-x-2" aria-label={`${users.length} members`}>
      {users.slice(0, 5).map((user) => (
        <AppAvatar
          key={user.id}
          name={user.displayName}
          src={user.avatarUrl}
          className="ring-2 ring-surface"
        />
      ))}
    </div>
  );
}
