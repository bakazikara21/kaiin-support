"use client";

import { useState } from "react";
import { setAccessCode } from "@/lib/accessCode";

// 「合言葉が違う」と言われたときに出す入力欄
export default function AccessCodeForm({ onSaved }: { onSaved?: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="notice warn">
      <p style={{ fontWeight: 700 }}>合言葉を入れてください</p>
      <p className="small-text">
        このアプリのAIとスイーツの読み込みは、合言葉を知っている人だけが使えます。合言葉はご家族に聞いてください。一度入れると、このスマートフォンが覚えます。
      </p>
      <div className="input-row">
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          aria-label="合言葉"
          placeholder="合言葉"
        />
        <button
          type="button"
          className="copy-btn"
          disabled={!value.trim()}
          onClick={() => {
            setAccessCode(value);
            onSaved?.();
          }}
        >
          決定
        </button>
      </div>
    </div>
  );
}
