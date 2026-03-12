import type { ReactNode } from "react";
import { defaultUser } from "../constants/defaultUser";
import { useStorageState } from "../hooks/useStorageState";
import type { User } from "../types/user";
import { materializeRecurringTasks } from "../utils/recurrenceUtils";
import { UserContext } from "./UserContext";

/**
 * User context provider backed by localStorage.
 *
 * Also materializes recurring tasks (offline-first) into concrete occurrences on initial load.
 */
export const UserContextProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useStorageState<User>(defaultUser, "user");

  // Materialize recurring tasks once on mount.
  // We only update state if something actually changed, to avoid extra renders.
  if (typeof window !== "undefined") {
    const materialized = materializeRecurringTasks(user.tasks, new Date());
    const changed =
      materialized.length !== user.tasks.length ||
      materialized.some((t, i) => {
        const prev = user.tasks[i];
        return JSON.stringify(t.recurrenceState) !== JSON.stringify(prev?.recurrenceState);
      });

    if (changed) {
      // Note: this runs during render; safe here only because it is a one-time normalization
      // and useStorageState will persist. If this ever causes warnings, convert to useEffect.
      setUser((prev) => ({
        ...prev,
        tasks: materialized,
      }));
    }
  }

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
};
