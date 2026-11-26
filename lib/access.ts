// 合言葉のチェック（サーバー側）
// アプリをインターネットに公開すると、だれでもアドレスに来られます。
// AIの利用料がほかの人に使われないよう、合言葉を知っている人だけがAIやスイーツの読み込みを使えるようにします。
import { timingSafeEqual } from "node:crypto";

export const ACCESS_HEADER = "x-access-code";

export function checkAccess(request: Request): boolean {
  const expected = process.env.ACCESS_CODE;
  if (!expected) return true; // 合言葉を設定していない場合（手元で動かすとき）は、チェックしません
  const given = request.headers.get(ACCESS_HEADER) ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function denied(extraHeaders: HeadersInit = {}) {
  return Response.json(
    { error: "合言葉が違うか、まだ入っていません。", needCode: true },
    { status: 401, headers: extraHeaders },
  );
}

// 高島屋のページの上で動く案内（ブックマーク）から、AIを呼べるようにする設定
const ALLOWED_ORIGINS = ["https://www.takashimaya.co.jp"];

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": `content-type, ${ACCESS_HEADER}`,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
