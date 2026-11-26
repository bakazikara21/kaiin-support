"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import AccessCodeForm from "@/components/AccessCodeForm";
import { apiFetch, useAccessCode } from "@/lib/accessCode";
import { buildBookmarklet } from "@/lib/bookmarklet";
import { copyText } from "@/lib/copy";
import { missingItems } from "@/lib/profile";
import { useProfile } from "@/lib/useProfile";
import { loadDevice, readStep, saveDevice, writeStep, type Device } from "@/lib/device";

const TAKASHIMAYA_REGISTER_URL = "https://www.takashimaya.co.jp/customer/member/apply.html";
const BOOKMARK_NAME = "高島屋おてつだい";
// 「ブックマークから高島屋おてつだいを押す」方法（スマホの種類ごと）
function HowToRun({ device }: { device: Device }) {
  if (device === "iphone") {
    return (
      <ol className="howto">
        <li>画面の下にある「本のマーク（ブックマーク）」をタップします。</li>
        <li>一覧から「{BOOKMARK_NAME}」をタップします。</li>
        <li>本のマークが見当たらないときは、アドレス欄（URLの欄）をタップして「{BOOKMARK_NAME}」と入力し、候補に出たブックマークをタップします。</li>
      </ol>
    );
  }
  if (device === "android") {
    return (
      <ol className="howto">
        <li>画面の上のアドレス欄（URLが書いてある所）をタップします。</li>
        <li>「{BOOKMARK_NAME}」と入力すると、下に☆マークの候補が出るので、それをタップします。</li>
      </ol>
    );
  }
  return (
    <ol className="howto">
      <li>ブックマークバーにある「{BOOKMARK_NAME}」をクリックします。</li>
    </ol>
  );
}

export default function RegisterGuide() {
  // 保存した情報をいつも最新の状態で読み出します（準備画面で保存すると、すぐに反映されます）
  const profile = useProfile();
  const [step, setStepState] = useState(readStep);
  const [device, setDeviceState] = useState<Device>(loadDevice);
  const setDevice = (d: Device) => {
    setDeviceState(d);
    saveDevice(d); // AIアシスタントにも、使っている機械を伝えるために覚えておきます
  };
  const [copied, setCopied] = useState(false);

  // ブックマークには、このアプリのアドレス（AIの問い合わせ先）と合言葉も入れます
  const accessCode = useAccessCode();
  const bookmarklet = useMemo(
    () => (profile ? buildBookmarklet(profile, { api: window.location.origin, code: accessCode }) : ""),
    [profile, accessCode],
  );
  const httpsOk = window.location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  // 合言葉が必要か、このスマホの合言葉が合っているかを確かめます
  const [access, setAccess] = useState<{ required: boolean; ok: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    apiFetch("/api/access")
      .then((r) => r.json())
      .then((j) => {
        if (alive) setAccess(j);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [accessCode]);
  const missing = profile ? missingItems(profile) : null;

  const setStep = (n: number) => {
    setStepState(n);
    writeStep(n);
    window.scrollTo({ top: 0 });
  };

  // 情報がまだ準備されていない場合は、先に準備画面へ案内します
  if (!profile || (missing && missing.length > 0)) {
    return (
      <>
        <h1>高島屋で会員登録する</h1>
        <div className="notice warn">
          {profile
            ? `まだ入っていない項目があります：${missing!.join("、")}`
            : "まだ登録する情報が保存されていません。"}
        </div>
        <p>先に「登録する情報を準備する」で、情報を入れて保存してください。</p>
        <Link href="/prepare" className="btn">
          情報を準備する →
        </Link>
      </>
    );
  }

  const steps: { title: string; body: ReactNode }[] = [
    {
      title: "自動入力のボタンを登録する（はじめの1回だけ）",
      body: (
        <>
          <p>
            高島屋の画面で自動入力するために、ブラウザの「ブックマーク（お気に入り）」に「{BOOKMARK_NAME}」を登録します。
            <b>少しむずかしいので、ご家族に手伝ってもらうと安心です。</b>
          </p>
          {access?.required && !access.ok && (
            <AccessCodeForm />
          )}
          {access?.ok && (
            <p className="small-text">
              このブックマークには、高島屋の画面でAIに聞くための設定も入ります。高島屋の画面の案内で「AIに聞く」を押すと使えます。
            </p>
          )}
          {!httpsOk && (
            <div className="notice info">
              いまのアドレス（http://）では、高島屋の画面でAIに聞く機能は使えません。「https://」で始まるアドレスでこのアプリを開いてから、ブックマークを登録してください。
            </div>
          )}
          {device === "pc" ? (
            <>
              <ol className="howto">
                <li>ブックマークバーを表示します（Chrome：Ctrl+Shift+B、Mac は ⌘+Shift+B ／ Mac の Safari：メニューの「表示」→「お気に入りバーを表示」）。</li>
                <li>下の枠のボタンを、マウスでブックマークバーまでドラッグ（つかんで移動）します。</li>
              </ol>
              <p>
                <a
                  className="bookmarklet-link"
                  ref={(el) => {
                    // Reactは安全のため「javascript:」のリンクを直接書けないので、ここで設定します
                    if (el && bookmarklet) el.setAttribute("href", bookmarklet);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("このボタンは、ここではなく高島屋のページで使います。ブックマークバーにドラッグしてください。");
                  }}
                >
                  {BOOKMARK_NAME}
                </a>
              </p>
            </>
          ) : (
            <>
              <p>まず、下のボタンで自動入力のコードをコピーします。</p>
              <button
                type="button"
                className={`btn${copied ? " secondary" : ""}`}
                onClick={async () => {
                  if (await copyText(bookmarklet)) {
                    setCopied(true);
                  } else {
                    alert("コピーできませんでした。もう一度押してください。");
                  }
                }}
              >
                {copied ? "✓ コピーしました" : "自動入力のコードをコピー"}
              </button>
              <p style={{ marginTop: 16 }}>つぎに、以下の手順でブックマークを作ります。</p>
              {device === "iphone" ? (
                <ol className="howto">
                  <li>Safariで、このページを開いたまま、画面の下の「共有ボタン（□に↑のマーク）」をタップします。</li>
                  <li>「ブックマークを追加」をタップします。</li>
                  <li>名前を「{BOOKMARK_NAME}」に書きかえて「保存」をタップします。</li>
                  <li>画面の下の「本のマーク」→ 右下の「編集」をタップします。</li>
                  <li>「{BOOKMARK_NAME}」をタップします。</li>
                  <li>下の段のアドレス（http…）を全部消して、長押しして「ペースト」します。</li>
                  <li>「完了」をタップします。これで登録できました。</li>
                </ol>
              ) : (
                <ol className="howto">
                  <li>Chromeで、このページを開いたまま、右上の「︙」をタップし、「☆」をタップします。</li>
                  <li>下に出る「編集」をタップします。</li>
                  <li>名前を「{BOOKMARK_NAME}」に書きかえます。</li>
                  <li>URLの欄を全部消して、長押しして「貼り付け」ます。</li>
                  <li>左上の「←」で戻ります。これで登録できました。</li>
                </ol>
              )}
            </>
          )}
          <div className="notice info">
            準備画面で情報を書きかえたときは、この手順でブックマークを登録し直してください。
          </div>
          <p>登録できたら、本番の前に練習ページで試してみましょう。練習ページを開いて「{BOOKMARK_NAME}」を押すと、自動入力の案内が出ます。</p>
          <a className="btn secondary" href="/practice.html" target="_blank" rel="noopener">
            練習ページで試す
          </a>
        </>
      ),
    },
    {
      title: "パスワードを覚えてもらう設定を確かめる（はじめの1回だけ）",
      body: (
        <>
          <p>
            パスワードは、iPhone（またはAndroid・パソコン）に作ってもらい、覚えてもらいます。そのための設定がオンになっているか確かめます。
          </p>
          {device === "iphone" && (
            <ol className="howto">
              <li>「設定」アプリを開きます。</li>
              <li>いちばん上の、ご自分の名前をタップします。</li>
              <li>「iCloud」→「パスワード」（または「パスワードとキーチェーン」）をタップします。</li>
              <li>「このiPhoneを同期」がオンになっていればOKです。</li>
            </ol>
          )}
          {device === "android" && (
            <ol className="howto">
              <li>Chromeの右上の「︙」→「設定」をタップします。</li>
              <li>「Google パスワード マネージャー」をタップします。</li>
              <li>右上の歯車（設定）で「パスワードを保存するか確認する」がオンになっていればOKです。</li>
            </ol>
          )}
          {device === "pc" && (
            <ol className="howto">
              <li>Chromeの右上の「︙」→「パスワードと自動入力」→「Google パスワード マネージャー」を開きます。</li>
              <li>「設定」で「パスワードを保存するか確認する」がオンになっていればOKです。</li>
              <li>MacのSafariを使う場合は、「システム設定」→ ご自分の名前 →「iCloud」→「パスワード」がオンになっていればOKです。</li>
            </ol>
          )}
          <div className="notice info">
            覚えたパスワードは、次に高島屋にログインするとき自動で入ります。iPhoneでは「パスワード」アプリ（または「設定」→「パスワード」）で、あとから確かめることもできます。
          </div>
        </>
      ),
    },
    {
      title: "高島屋の会員登録ページを開く",
      body: (
        <>
          <p>下のボタンを押すと、高島屋の「会員登録申し込み」のページが新しく開きます。</p>
          <a className="btn" href={TAKASHIMAYA_REGISTER_URL} target="_blank" rel="noopener noreferrer">
            高島屋の会員登録ページを開く
          </a>
          <p className="small-text" style={{ marginTop: 12 }}>
            開いたら、そのまま次の手順に進みます。この案内に戻るときは、ブラウザのタブを切りかえてください。
          </p>
          <div className="notice info">
            高島屋の画面で、どこを押せばいいか分からないときは、ブックマーク「{BOOKMARK_NAME}」を押して、出てきた案内の「<b>AIに聞く</b>」を押してください。AIが答えて、押す場所をオレンジの枠で光らせます。（ページが変わったら、もう一度ブックマークを押します。）
          </div>
        </>
      ),
    },
    {
      title: "メールアドレスを入れて送信する",
      body: (
        <>
          <p>高島屋のページで、ブックマークの「{BOOKMARK_NAME}」を押します。</p>
          <HowToRun device={device} />
          <p>
            画面の下に「何をしますか？」と出たら「<b>自動入力</b>」を押し、続けて「<b>入力する</b>」を押します。メールアドレスが自動で入ります。
          </p>
          <ol className="howto">
            <li>「会員規約」を読み、「同意する」にチェックが入っていることを確かめます。</li>
            <li>「送信」などのボタンを押します。</li>
          </ol>
        </>
      ),
    },
    {
      title: "届いたメールを開く",
      body: (
        <>
          <p>
            少し待つと、<b>{profile.email}</b> に高島屋からメールが届きます。
          </p>
          <ol className="howto">
            <li>メールのアプリを開きます。</li>
            <li>高島屋からのメールを開き、中に書いてあるリンク（青い文字）をタップします。</li>
            <li>会員情報を入れるページが開きます。</li>
          </ol>
          <div className="notice info">
            メールが届かないときは、「迷惑メール」のフォルダも見てください。リンクには使える時間が決まっていることがあります。
          </div>
        </>
      ),
    },
    {
      title: "会員情報を自動で入れる",
      body: (
        <>
          <p>会員情報を入れるページで、もう一度「{BOOKMARK_NAME}」を押します。</p>
          <HowToRun device={device} />
          <p>
            画面の下に「何をしますか？」と出たら「<b>自動入力</b>」を押します。「次は〇〇です」と案内が出るので、オレンジの枠を確かめて「<b>入力する</b>」を押すと1つずつ、「<b>まとめて入力</b>」を押すと残りがまとめて入ります。
          </p>
          <div className="notice info">
            <b>パスワードのところでは</b>、案内が画面の上に移ります。オレンジの枠の欄をタップして、iPhoneが出す「強力なパスワードを使用」を選んでください（Android・パソコンでは「パスワードの候補」）。
          </div>
          <div className="notice info">
            自動で入らなかった項目は、最後に一覧で出ます。「欄をタップして入れる」を押してから入れたい欄をタップするか、「コピー」して貼り付けてください。
          </div>
        </>
      ),
    },
    {
      title: "内容を確かめて登録する",
      body: (
        <>
          <ol className="howto">
            <li>入った内容に間違いがないか、上から順番に見ます。</li>
            <li>「確認」ボタンを押し、確認画面でもう一度見ます。</li>
            <li>「登録」ボタンを押します。</li>
          </ol>
          <div className="notice ok">「登録が完了しました」と出たら、会員登録はおしまいです。おつかれさまでした！</div>
          <Link href="/sweets" className="btn secondary">
            今日のおすすめスイーツを見る
          </Link>
        </>
      ),
    },
  ];

  const current = Math.min(step, steps.length - 1);
  const s = steps[current];

  return (
    <>
      <h1>高島屋で会員登録する</h1>
      <div className="progress" aria-hidden="true">
        {steps.map((_, k) => (
          <span key={k} className={k <= current ? "on" : ""} />
        ))}
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <span className="label" style={{ fontSize: 16 }}>お使いの機械</span>
        <div className="tabs" role="tablist" aria-label="お使いの機械">
          {(
            [
              ["iphone", "iPhone"],
              ["android", "Android"],
              ["pc", "パソコン"],
            ] as const
          ).map(([d, label]) => (
            <button key={d} type="button" className={device === d ? "on" : ""} onClick={() => setDevice(d)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <section className="card">
        <div className="step-label">
          ステップ {current + 1} / {steps.length}
        </div>
        <h2>{s.title}</h2>
        {s.body}
      </section>
      <div className="btn-row">
        <button type="button" className="btn secondary" onClick={() => setStep(current - 1)} disabled={current === 0}>
          ← 前へ
        </button>
        {current < steps.length - 1 ? (
          <button type="button" className="btn" onClick={() => setStep(current + 1)}>
            次へ →
          </button>
        ) : (
          <button type="button" className="btn secondary" onClick={() => setStep(0)}>
            最初から
          </button>
        )}
      </div>
      <Link href="/assistant" className="btn secondary" style={{ marginTop: 16 }}>
        わからないときは AI に聞く
      </Link>
    </>
  );
}
