// 使っている機械（iPhone / Android / パソコン）と、会員登録の案内のステップを覚えておく処理
export type Device = "iphone" | "android" | "pc";

const DEVICE_KEY = "kaiin-support:device";
export const STEP_KEY = "kaiin-support:register-step";

export function guessDevice(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iphone";
  if (/Android/.test(ua)) return "android";
  return "pc";
}

export function loadDevice(): Device {
  try {
    const d = localStorage.getItem(DEVICE_KEY);
    if (d === "iphone" || d === "android" || d === "pc") return d;
  } catch {
    /* 読めなければ推測します */
  }
  return guessDevice();
}

export function saveDevice(d: Device) {
  try {
    localStorage.setItem(DEVICE_KEY, d);
  } catch {
    /* 保存できなくても動きます */
  }
}

export function readStep(): number {
  try {
    return Number(localStorage.getItem(STEP_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function writeStep(n: number) {
  try {
    localStorage.setItem(STEP_KEY, String(n));
  } catch {
    /* 保存できなくても動きます */
  }
}

// 会員登録の案内のステップ名（AIに「いまどこにいるか」を伝えるのに使います）
export const REGISTER_STEP_TITLES = [
  "自動入力のボタン（ブックマーク）を登録する",
  "パスワードを覚えてもらう設定を確かめる",
  "高島屋の会員登録ページを開く",
  "メールアドレスを入れて送信する",
  "届いたメールを開く",
  "会員情報を自動で入れる",
  "内容を確かめて登録する",
];

// このステップ以降は、画面に個人情報が出ている可能性があるので、AIに画面の写真を送れなくします
export const PHOTO_LOCK_STEP = 4;
