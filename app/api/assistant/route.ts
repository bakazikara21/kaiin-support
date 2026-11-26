// 「/api/assistant」：AIアシスタントの質問を受け取り、Gemini に聞いて答えを返します
//   - アプリの「AIに聞く」画面から（文章・画面の写真）
//   - 高島屋のページの上の案内から（ページの作り＝ボタンや見出しの文字。入力欄の中身は送られてきません）
import { ThinkingLevel, Type } from "@google/genai";
import { checkAccess, corsHeaders, denied } from "@/lib/access";
import { GEMINI_MODEL, getGemini, pageInstruction, systemInstruction, type PageOutline } from "@/lib/gemini";
import { redactPatterns } from "@/lib/redact";

type ChatMessage = { role: "user" | "model"; text: string };
type Body = {
  messages?: ChatMessage[];
  image?: { mimeType: string; data: string } | null;
  device?: string;
  step?: string | null;
  page?: PageOutline | null;
};

const MAX_MESSAGES = 20;
const MAX_TEXT = 2000;
const MAX_IMAGE_BASE64 = 6_000_000; // 約4.5MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PAGE_ITEMS = 300;

// 高島屋のページから呼ばれるときの「事前の確認」に答えます
export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: cors });

  if (!checkAccess(request)) return denied(cors);

  const ai = getGemini();
  if (!ai) {
    return reply({ error: "AIの設定がまだです。Gemini の設定（APIキーなど）を入れてください。" }, 503);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return reply({ error: "送られた内容を読めませんでした" }, 400);
  }

  // 送られた内容のチェック（多すぎる・形がおかしいものは受け付けません）
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "model") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_TEXT) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return reply({ error: "質問が空です" }, 400);
  }
  const image = body.image;
  if (image && (!IMAGE_TYPES.includes(image.mimeType) || typeof image.data !== "string" || image.data.length > MAX_IMAGE_BASE64)) {
    return reply({ error: "画像の形式か大きさが合いません（写真は小さくしてから送ってください）" }, 400);
  }
  const device = body.device === "iphone" || body.device === "android" || body.device === "pc" ? body.device : "iphone";
  const step = typeof body.step === "string" ? body.step.slice(0, 100) : null;

  // ページの作り（高島屋のページの上から聞かれたとき）。文字は念のためサーバー側でも伏せ字にします
  let page: PageOutline | null = null;
  if (body.page && Array.isArray(body.page.items)) {
    page = {
      title: redactPatterns(String(body.page.title ?? "").slice(0, 100)),
      path: String(body.page.path ?? "").replace(/[?#].*$/, "").slice(0, 200),
      items: body.page.items.slice(0, MAX_PAGE_ITEMS).map((it) => ({
        n: Number(it.n) | 0,
        k: String(it.k ?? "").slice(0, 10),
        t: redactPatterns(String(it.t ?? "").slice(0, 80)),
        h: !!it.h,
      })),
    };
  }

  // AIに渡す会話。ユーザーの文章は、念のためサーバー側でも個人情報らしい部分を伏せ字にします
  const contents = messages.map((m, idx) => {
    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
      { text: m.role === "user" ? redactPatterns(m.text) : m.text },
    ];
    if (idx === messages.length - 1 && image && !page) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    }
    return { role: m.role, parts };
  });

  try {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemInstruction(device, step) + (page ? pageInstruction(page) : ""),
        maxOutputTokens: 2048,
        // 考える量は「少なめ」にして、速く答えます（このモデルは「最小」には対応していません）
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        // ページの上から聞かれたときは、「答え」と「光らせる場所の番号」を決まった形で返してもらいます
        ...(page
          ? {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  answer: { type: Type.STRING },
                  target: { type: Type.INTEGER, nullable: true },
                },
                required: ["answer"],
              },
            }
          : {}),
      },
    });
    const text = res.text?.trim();
    if (!text) throw new Error("empty");
    if (!page) return reply({ text });

    const parsed = JSON.parse(text) as { answer?: string; target?: number | null };
    const target = typeof parsed.target === "number" && page.items.some((it) => it.n === parsed.target) ? parsed.target : null;
    return reply({ text: String(parsed.answer ?? "").trim() || "うまく答えられませんでした。", target });
  } catch (e) {
    // 会話の中身はログに残しません（個人情報が含まれる可能性があるため）
    console.error("[assistant] Gemini error:", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return reply({ error: "AIから返事をもらえませんでした。少し待ってから、もう一度送ってください。" }, 502);
  }
}
