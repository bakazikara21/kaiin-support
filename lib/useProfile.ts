"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getProfileSnapshot, parseProfile, subscribeProfile, type Profile } from "./profile";

// いま保存されている情報を読み出します。
// 保存し直したり消したりすると、この画面にもすぐに反映されます。
export function useProfile(): Profile | null {
  const raw = useSyncExternalStore(subscribeProfile, getProfileSnapshot, () => null);
  return useMemo(() => parseProfile(raw), [raw]);
}
