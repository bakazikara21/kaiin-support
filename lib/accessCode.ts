"use client";

// 合言葉（ブラウザ側）：このスマホに覚えておき、AIやスイーツの読み込みのときに一緒に送ります
import { useSyncExternalStore } from "react";

const KEY = "kaiin-support:access-code";
const listeners = new Set<() => void>();

export function getAccessCode(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessCode(code: string) {
  try {
    localStorage.setItem(KEY, code.trim());
  } catch {
    /* 保存できなくても、この画面の間は使えます */
  }
  listeners.forEach((fn) => fn());
}

export function useAccessCode(): string {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getAccessCode,
    () => "",
  );
}

// 合言葉をつけて、アプリのサーバーに問い合わせます
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const code = getAccessCode();
  if (code) headers.set("x-access-code", code);
  return fetch(input, { ...init, headers });
}
