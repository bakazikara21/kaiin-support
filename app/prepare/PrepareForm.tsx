"use client";

import Link from "next/link";
import { useState } from "react";
import { copyText } from "@/lib/copy";
import {
  PREFECTURES,
  clearProfile,
  emptyProfile,
  loadProfile,
  missingItems,
  saveProfile,
  type Profile,
} from "@/lib/profile";

type TextKey = {
  [K in keyof Profile]: Profile[K] extends string ? K : never;
}[keyof Profile];

// 文字を入れる欄＋「コピー」ボタンの1行分
function TextField(props: {
  label: string;
  hint?: string;
  name: TextKey;
  value: string;
  onChange: (name: TextKey, v: string) => void;
  type?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  autoComplete?: string;
  placeholder?: string;
}) {
  const [copied, setCopied] = useState(false);
  const id = `f-${props.name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      {props.hint && <span className="hint">{props.hint}</span>}
      <div className="input-row">
        <input
          id={id}
          className="input"
          type={props.type ?? "text"}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete ?? "off"}
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange(props.name, e.target.value)}
        />
        <button
          type="button"
          className={`copy-btn${copied ? " done" : ""}`}
          onClick={async () => {
            if (await copyText(props.value)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
          disabled={!props.value}
          aria-label={`${props.label}をコピー`}
        >
          {copied ? "✓済" : "コピー"}
        </button>
      </div>
    </div>
  );
}

function Choice<T extends string>(props: {
  label: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span className="label">{props.label}</span>
      <div className="choice-row" role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <label key={o.value} className={`choice${props.value === o.value ? " selected" : ""}`}>
            <input
              type="radio"
              name={props.name}
              value={o.value}
              checked={props.value === o.value}
              onChange={() => props.onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function PrepareForm() {
  const [p, setP] = useState<Profile>(() => loadProfile() ?? emptyProfile);
  const [message, setMessage] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);

  const set = (name: TextKey, v: string) => {
    setP((prev) => ({ ...prev, [name]: v }));
    setMessage(null);
  };

  const onSave = () => {
    if (!saveProfile(p)) {
      setMessage({ kind: "warn", text: "保存できませんでした。ブラウザの設定（プライベートブラウズなど）を確認してください。" });
      return;
    }
    const miss = missingItems(p);
    setMessage(
      miss.length
        ? { kind: "warn", text: `保存しました。まだ入っていない項目があります：${miss.join("、")}` }
        : { kind: "ok", text: "保存しました。次は「高島屋で会員登録する」に進みましょう。" },
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onClear = () => {
    if (!window.confirm("保存した情報をすべて消します。よろしいですか？")) return;
    clearProfile();
    setP(emptyProfile);
    setMessage({ kind: "ok", text: "保存した情報を消しました。" });
  };

  return (
    <>
      {message && (
        <div className={`notice ${message.kind}`} role="status">
          {message.text}
          {message.kind === "ok" && message.text.includes("次は") && (
            <div style={{ marginTop: 12 }}>
              <Link href="/register" className="btn">
                会員登録の案内へ進む →
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="notice info">
        この情報は、このスマートフォンの中だけに保存されます。ほかの人に見られないよう、スマートフォンには画面ロックをかけてください。
      </div>

      <section className="card">
        <h2>お名前</h2>
        <TextField label="姓（みょうじ）" name="lastName" value={p.lastName} onChange={set} placeholder="例：高島" />
        <TextField label="名（なまえ）" name="firstName" value={p.firstName} onChange={set} placeholder="例：花子" />
        <TextField label="セイ（カタカナ）" name="lastNameKana" value={p.lastNameKana} onChange={set} placeholder="例：タカシマ" />
        <TextField label="メイ（カタカナ）" name="firstNameKana" value={p.firstNameKana} onChange={set} placeholder="例：ハナコ" />
      </section>

      <section className="card">
        <h2>ご住所</h2>
        <TextField
          label="郵便番号"
          hint="7ケタの数字（ハイフンはあってもなくても大丈夫）"
          name="postalCode"
          value={p.postalCode}
          onChange={set}
          inputMode="numeric"
          placeholder="例：260-0000"
        />
        <div className="field">
          <label htmlFor="f-prefecture">都道府県</label>
          <select
            id="f-prefecture"
            className="input"
            value={p.prefecture}
            onChange={(e) => set("prefecture", e.target.value)}
          >
            {PREFECTURES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <TextField label="市区町村" name="city" value={p.city} onChange={set} placeholder="例：千葉市中央区" />
        <TextField label="町名・番地" name="street" value={p.street} onChange={set} placeholder="例：中央1-2-3" />
        <TextField
          label="建物名・部屋番号"
          hint="ない場合は空のままで大丈夫です"
          name="building"
          value={p.building}
          onChange={set}
          placeholder="例：〇〇マンション101"
        />
      </section>

      <section className="card">
        <h2>連絡先</h2>
        <TextField
          label="電話番号"
          hint="ハイフン（-）で区切って入れてください"
          name="phone"
          value={p.phone}
          onChange={set}
          type="tel"
          inputMode="tel"
          placeholder="例：090-1234-5678"
        />
        <TextField
          label="メールアドレス"
          hint="高島屋からの確認メールが届くアドレスです"
          name="email"
          value={p.email}
          onChange={set}
          type="email"
          inputMode="email"
          placeholder="例：hanako@example.com"
        />
      </section>

      <section className="card">
        <h2>そのほか</h2>
        <Choice
          label="性別"
          name="gender"
          value={p.gender}
          onChange={(v) => setP((prev) => ({ ...prev, gender: v }))}
          options={[
            { value: "female", label: "女性" },
            { value: "male", label: "男性" },
            { value: "none", label: "回答しない" },
          ]}
        />
        <div className="field">
          <span className="label">生年月日</span>
          <div className="input-row">
            <input
              className="input"
              inputMode="numeric"
              placeholder="1960"
              aria-label="生まれた年（西暦）"
              value={p.birthYear}
              onChange={(e) => set("birthYear", e.target.value)}
            />
            <span style={{ alignSelf: "center" }}>年</span>
            <input
              className="input"
              inputMode="numeric"
              placeholder="4"
              aria-label="生まれた月"
              value={p.birthMonth}
              onChange={(e) => set("birthMonth", e.target.value)}
            />
            <span style={{ alignSelf: "center" }}>月</span>
            <input
              className="input"
              inputMode="numeric"
              placeholder="1"
              aria-label="生まれた日"
              value={p.birthDay}
              onChange={(e) => set("birthDay", e.target.value)}
            />
            <span style={{ alignSelf: "center" }}>日</span>
          </div>
          <span className="hint">年は西暦（例：1960）で入れてください</span>
        </div>
        <Choice
          label="高島屋のメールマガジン（お知らせメール）"
          name="mailmag"
          value={p.mailmag}
          onChange={(v) => setP((prev) => ({ ...prev, mailmag: v }))}
          options={[
            { value: "yes", label: "受け取る" },
            { value: "no", label: "受け取らない" },
          ]}
        />
      </section>

      <section className="card">
        <h2>パスワード</h2>
        <p>
          パスワードは<b>ここには保存しません</b>。
        </p>
        <p>
          会員登録のとき、パスワードの欄をタップすると、iPhone（またはAndroid・パソコン）が自動で「強力なパスワード」を作り、そのまま覚えてくれます。
          サイトごとに違うパスワードになるので安心です。
        </p>
        <p className="small-text">次にログインするときも、iPhoneやパソコンが覚えたパスワードを自動で入れてくれます。</p>
      </section>

      <div className="sticky-save">
        <button type="button" className="btn" onClick={onSave}>
          保存する
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        <button type="button" className="btn danger" onClick={onClear}>
          保存した情報をすべて消す
        </button>
      </div>
    </>
  );
}
