"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import AccessCodeForm from "@/components/AccessCodeForm";
import { apiFetch } from "@/lib/accessCode";
import { PHOTO_LOCK_STEP, REGISTER_STEP_TITLES, loadDevice, readStep } from "@/lib/device";
import { digitsOnly, type Profile } from "@/lib/profile";
import { redactPatterns } from "@/lib/redact";
import { useProfile } from "@/lib/useProfile";

type Msg = { role: "user" | "model"; text: string; photo?: boolean };
type Photo = { previewUrl: string; mimeType: string; data: string };

const QUICK_QUESTIONS = [
  "高島屋の新規会員登録の画面へは、どうやって行けばいいですか？",
  "ブックマーク「高島屋入力」の開き方を教えてください",
  "ブックマークの登録のしかたを、もう一度やさしく教えてください",
  "確認のメールが届きません",
];

// 保存した個人情報が文章に入っていたら、AIに送る前に伏せ字にします
// 名字が「高島」のときに「高島屋」まで伏せ字にしないよう、守る言葉です
const PROTECTED_WORDS = ["高島屋入力", "高島屋", "タカシマヤ", "たかしまや", "Takashimaya", "takashimaya"];

function redactProfile(text: string, p: Profile | null): string {
  let out = text;
  if (p) {
    // 守る言葉を、いったん目印（\u0000番号\u0000）に置きかえておきます
    PROTECTED_WORDS.forEach((w, i) => {
      out = out.split(w).join(`\u0000${i}\u0000`);
    });
    const values = [
      p.lastName, p.firstName, p.lastNameKana, p.firstNameKana,
      `${p.lastName}${p.firstName}`, `${p.lastName} ${p.firstName}`, `${p.lastName}　${p.firstName}`,
      p.city, p.street, p.building, p.email, p.phone, p.postalCode,
      digitsOnly(p.phone), digitsOnly(p.postalCode),
    ]
      .map((v) => v.trim())
      .filter((v) => v.length >= 2)
      .sort((a, b) => b.length - a.length); // 長いものから順に置きかえます
    for (const v of values) out = out.split(v).join("［個人情報］");
    // 目印を元の言葉に戻します
    out = out.replace(/\u0000(\d+)\u0000/g, (_, n) => PROTECTED_WORDS[Number(n)]);
  }
  return redactPatterns(out);
}

// 写真を小さくして（長い辺を最大1280ピクセルに）、送れる形にします
async function shrinkPhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("画像を読めませんでした"));
      i.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { previewUrl: dataUrl, mimeType: "image/jpeg", data: dataUrl.split(",")[1] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// AIの答えの中のURLを、押せるリンクにします
function withLinks(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s、。）)」]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function AssistantChat() {
  const profile = useProfile();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoChecked, setPhotoChecked] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const send = async (rawText: string) => {
    const text = rawText.trim() || (photo ? "この画面で、次に何をすればいいですか？" : "");
    if (!text || sending) return;
    if (photo && !photoChecked) {
      setError("写真を送る前に、個人情報が写っていないことを確かめて、チェックを入れてください。");
      return;
    }
    const safeText = redactProfile(text, profile);
    const next: Msg[] = [...messages, { role: "user", text: safeText, photo: !!photo }];
    setMessages(next);
    setInput("");
    setError(null);
    setSending(true);
    const sentPhoto = photo;
    setPhoto(null);
    setPhotoChecked(false);
    try {
      const step = readStep();
      const res = await apiFetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, text: m.photo ? `${m.text}\n（画面の写真を送りました）` : m.text })),
          image: sentPhoto ? { mimeType: sentPhoto.mimeType, data: sentPhoto.data } : null,
          device: loadDevice(),
          step: REGISTER_STEP_TITLES[step] ?? null,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        setNeedCode(true);
        throw new Error("合言葉を入れてから、もう一度送ってください。");
      }
      if (!res.ok) throw new Error(json.error ?? "AIから返事をもらえませんでした");
      setMessages((m) => [...m, { role: "model", text: json.text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AIから返事をもらえませんでした");
    } finally {
      setSending(false);
    }
  };

  const onPhotoButton = () => {
    // 自動入力のあとは、画面に個人情報が出ているので写真は送れません
    if (readStep() >= PHOTO_LOCK_STEP) {
      setPhotoNotice(
        "自動入力のあとの画面には、名前や住所などの個人情報が写るため、AIに写真は送れません。困っていることを文章で書いてください。",
      );
      return;
    }
    setPhotoNotice(null);
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await shrinkPhoto(file));
      setPhotoChecked(false);
      setError(null);
    } catch {
      setError("写真を読み込めませんでした。別の写真で試してください。");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <div className="notice info">
        AIは、高島屋の会員登録の画面までの行き方と、ブックマーク「高島屋入力」の使い方をお手伝いします。
        <b>名前・住所・電話番号・メールアドレス・パスワードは書かないでください。</b>（保存した情報は、AIには送りません。）
      </div>

      <div className="chat">
        <div className="bubble model">
          こんにちは。会員登録のお手伝いをします。分からないことを、下の欄に書くか、よくある質問のボタンを押してください。
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === "model" ? withLinks(m.text) : m.text}
            {m.photo && <div className="small-text">（画面の写真を送りました）</div>}
          </div>
        ))}
        {sending && <div className="bubble model thinking">考えています…</div>}
        <div ref={bottomRef} />
      </div>

      {error && <div className="notice warn">{error}</div>}
      {needCode && (
        <AccessCodeForm
          onSaved={() => {
            setNeedCode(false);
            setError(null);
          }}
        />
      )}

      {messages.length === 0 && (
        <div className="stack" style={{ marginBottom: 16 }}>
          <span className="label">よくある質問</span>
          {QUICK_QUESTIONS.map((q) => (
            <button key={q} type="button" className="btn secondary small" style={{ width: "100%", textAlign: "left" }} onClick={() => send(q)} disabled={sending}>
              {q}
            </button>
          ))}
        </div>
      )}

      <section className="card">
        <label htmlFor="ask" className="label" style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
          AIに聞きたいこと
        </label>
        <textarea
          id="ask"
          className="input"
          rows={3}
          placeholder="例：「新規会員登録」のボタンが見つかりません"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ resize: "vertical" }}
        />

        {photo && (
          <div className="photo-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.previewUrl} alt="送る画面の写真" />
            <label className="choice" style={{ justifyContent: "flex-start", marginTop: 8 }}>
              <input type="checkbox" checked={photoChecked} onChange={(e) => setPhotoChecked(e.target.checked)} />
              この写真に、名前・住所・メールアドレスなどの個人情報が写っていないことを確かめました
            </label>
            <button type="button" className="btn danger small" style={{ width: "100%", marginTop: 8 }} onClick={() => setPhoto(null)}>
              写真をやめる
            </button>
          </div>
        )}
        {photoNotice && <div className="notice warn" style={{ marginTop: 12 }}>{photoNotice}</div>}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn secondary small" onClick={onPhotoButton} disabled={sending}>
            画面の写真を送る
          </button>
          <button type="button" className="btn small" onClick={() => send(input)} disabled={sending || (!input.trim() && !photo)}>
            送る
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <p className="small-text" style={{ marginTop: 8, marginBottom: 0 }}>
          写真は、高島屋の画面のスクリーンショット（画面を撮ったもの）を送れます。自動入力のあとの画面は送れません。
        </p>
      </section>

      {messages.length > 0 && (
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            setMessages([]);
            setError(null);
          }}
          disabled={sending}
        >
          会話を消して最初から
        </button>
      )}
    </>
  );
}
