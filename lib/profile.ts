// 会員登録に使う情報（プロフィール）の形と、ブラウザ（localStorage）への保存・読み込み
//
// パスワードは保存しません。登録するときに、iPhoneやパソコンのブラウザに
// 「強力なパスワード」を作ってもらい、そのまま覚えてもらいます。

export type Profile = {
  lastName: string; // 姓
  firstName: string; // 名
  lastNameKana: string; // セイ
  firstNameKana: string; // メイ
  postalCode: string; // 郵便番号
  prefecture: string; // 都道府県
  city: string; // 市区町村
  street: string; // 番地
  building: string; // 建物名・部屋番号
  phone: string; // 電話番号
  email: string; // メールアドレス
  gender: "" | "male" | "female" | "none"; // 性別
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  mailmag: "" | "yes" | "no"; // メールマガジンを受け取るか
};

export const emptyProfile: Profile = {
  lastName: "",
  firstName: "",
  lastNameKana: "",
  firstNameKana: "",
  postalCode: "",
  prefecture: "千葉県",
  city: "",
  street: "",
  building: "",
  phone: "",
  email: "",
  gender: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  mailmag: "",
};

const STORAGE_KEY = "kaiin-support:profile";

// 保存した中身（文字列）をそのまま返します。ない場合は null
function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    // 以前の版で保存したパスワードが残っていても使いません
    delete obj.password;
    return { ...emptyProfile, ...obj };
  } catch {
    return null;
  }
}

export function loadProfile(): Profile | null {
  const raw = readRaw();
  // 以前の版でパスワードを保存していた場合は、ここで消しておきます
  if (raw && raw.includes('"password"')) {
    const p = parseProfile(raw);
    if (p) saveProfile(p);
    return p;
  }
  return parseProfile(raw);
}

// ===== 保存した情報が変わったことを、ほかの画面に知らせるしくみ =====
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeProfile(fn: () => void): () => void {
  listeners.add(fn);
  // 別のタブで保存したときにも知らせを受け取ります
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function getProfileSnapshot(): string | null {
  return readRaw();
}

export function saveProfile(p: Profile): boolean {
  try {
    const { ...data } = p as Profile & { password?: string };
    delete data.password;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    notify();
    return true;
  } catch {
    return false;
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 何もしない */
  }
  notify();
}

// 全角数字を半角に、ハイフンなどの記号を取りのぞいて数字だけにします
export function digitsOnly(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, "");
}

// 登録に必ず必要な項目のうち、まだ入っていないものの名前を返します
export function missingItems(p: Profile): string[] {
  const need: [keyof Profile, string][] = [
    ["lastName", "お名前（姓）"],
    ["firstName", "お名前（名）"],
    ["lastNameKana", "フリガナ（セイ）"],
    ["firstNameKana", "フリガナ（メイ）"],
    ["postalCode", "郵便番号"],
    ["prefecture", "都道府県"],
    ["city", "市区"],
    ["street", "町村・丁目・番地"],
    ["phone", "電話番号"],
    ["email", "メールアドレス"],
  ];
  return need.filter(([k]) => !String(p[k]).trim()).map(([, label]) => label);
}

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];
