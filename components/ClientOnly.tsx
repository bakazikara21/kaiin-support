"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

// ブラウザに保存した情報（localStorage）は、サーバー側では読めません。
// そのため、ブラウザで表示されたあとにだけ中身を表示するための部品です。
export default function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return <>{isClient ? children : fallback}</>;
}
