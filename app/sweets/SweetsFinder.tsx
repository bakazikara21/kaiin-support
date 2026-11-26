"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AccessCodeForm from "@/components/AccessCodeForm";
import { apiFetch } from "@/lib/accessCode";
import { DISLIKES, isDisliked, type DislikeKey } from "@/lib/dislikes";
import type { OverviewResponse, Sweet, SweetCategory, SweetCategoryName, TypeResponse } from "@/lib/sweets";

const DB_KEY = "kaiin-support:sweets-db";
const DISLIKE_KEY = "kaiin-support:sweets-dislikes";
const ALL_CATS: SweetCategoryName[] = ["洋菓子", "和菓子", "果物"];

type BudgetKey = "b2000" | "b3000" | "b5000" | "bover";
const BUDGETS: { key: BudgetKey; label: string; min: number; max: number | null }[] = [
  { key: "b2000", label: "〜2,000円", min: 0, max: 2000 },
  { key: "b3000", label: "2,001〜3,000円", min: 2001, max: 3000 },
  { key: "b5000", label: "3,001〜5,000円", min: 3001, max: 5000 },
  { key: "bover", label: "5,001円〜", min: 5001, max: null },
];

// ブラウザに保存してある一覧（前回取得した分）を読み込みます
function loadDb(): OverviewResponse | null {
  try {
    const raw = localStorage.getItem(DB_KEY);
    const d = raw ? (JSON.parse(raw) as OverviewResponse) : null;
    // 以前の版の形（果物がない）は使いません
    return d && Array.isArray(d.categories) && d.categories.some((c) => c.category === "果物") ? d : null;
  } catch {
    return null;
  }
}

function saveDb(d: OverviewResponse) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(d));
  } catch {
    /* 保存できなくても表示はできます */
  }
}

// 「苦手・ダメなもの」は、このスマホに覚えておきます
function loadDislikes(): DislikeKey[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISLIKE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((k) => DISLIKES.some((d) => d.key === k)) : [];
  } catch {
    return [];
  }
}

function saveDislikes(keys: DislikeKey[]) {
  try {
    localStorage.setItem(DISLIKE_KEY, JSON.stringify(keys));
  } catch {
    /* 保存できなくても使えます */
  }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// 日付をもとにした「くじ」。同じ日・同じ条件なら同じおすすめ、日が変わると別のおすすめになります
function seededPick<T>(list: T[], seedText: string, n: number): T[] {
  let seed = 0;
  for (const c of seedText) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

function yen(n: number) {
  return n.toLocaleString("ja-JP") + "円";
}

// いくつでも選べるボタンの並び。「すべて」を押すと全部選び、全部選ばれているときに押すと外します
function ChipGroup<K extends string>(props: {
  label: string;
  options: { key: K; label: string; sub?: string }[];
  selected: K[];
  onChange: (update: (prev: K[]) => K[]) => void;
}) {
  const allKeys = props.options.map((o) => o.key);
  const allOn = allKeys.length > 0 && allKeys.every((k) => props.selected.includes(k));
  return (
    <div className="field">
      <span className="label">{props.label}</span>
      <div className="chip-row">
        <button type="button" className={`chip${allOn ? " on" : ""}`} aria-pressed={allOn} onClick={() => props.onChange((prev) => (allKeys.every((k) => prev.includes(k)) ? [] : allKeys))}>
          すべて
        </button>
        {props.options.map((o) => {
          const on = props.selected.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              className={`chip${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => props.onChange((prev) => (prev.includes(o.key) ? prev.filter((k) => k !== o.key) : [...prev, o.key]))}
            >
              {o.label}
              {o.sub && <span className="small-text">{o.sub}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SweetCard({ s, today }: { s: Sweet; today?: boolean }) {
  return (
    <article className={`sweet${today ? " today" : ""}`}>
      <span className="type">
        {s.category}・{s.type}
      </span>
      <div className="name">{s.name}</div>
      <div className="price">
        {yen(s.price)}
        <span className="small-text">（税込）</span>
      </div>
      <div className="url">{s.url}</div>
      <a className="btn small secondary" href={s.url} target="_blank" rel="noopener noreferrer" style={{ width: "100%" }}>
        高島屋で見る
      </a>
    </article>
  );
}

const typeKey = (c: SweetCategory, typeCode: string) => `${c.code}/${typeCode}`;

export default function SweetsFinder() {
  const [db, setDb] = useState<OverviewResponse | null>(loadDb);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [cats, setCats] = useState<SweetCategoryName[]>([]);
  const [types, setTypes] = useState<string[]>([]); // 「売り場コード/種類コード」
  const [budgets, setBudgets] = useState<BudgetKey[]>([]);
  const [dislikes, setDislikesState] = useState<DislikeKey[]>(loadDislikes);
  const [typeData, setTypeData] = useState<Record<string, TypeResponse>>({});
  const [typeLoading, setTypeLoading] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(10);
  const inflight = useRef(new Set<string>());
  const forceNext = useRef(false);

  const setDislikes = (update: (prev: DislikeKey[]) => DislikeKey[]) => {
    setDislikesState((prev) => {
      const next = update(prev);
      saveDislikes(next);
      return next;
    });
  };

  // 売り場トップの一覧と、細かい種類の一覧を読み込みます
  const refresh = useCallback(async (force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/sweets${force ? "?refresh=1" : ""}`);
      const json = await res.json();
      if (res.status === 401) {
        setNeedCode(true);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "読み込みに失敗しました");
      setDb(json as OverviewResponse);
      saveDb(json as OverviewResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  // 保存してある一覧がない、または今日の分でなければ、新しく取りに行きます
  useEffect(() => {
    const saved = loadDb();
    const fresh = saved && new Date(saved.fetchedAt).toDateString() === new Date().toDateString();
    if (!fresh) {
      // 外部（高島屋）からデータを取ってくる処理なので、表示のあとに実行します
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refresh(false);
    }
  }, [refresh]);

  // ===== いま選ばれている条件から、何を表示するかを決めます =====
  const effCats = cats.length ? cats : ALL_CATS; // 種類を選んでいないときは「すべて」と同じ
  const catInfos = (db?.categories ?? []).filter((c) => effCats.includes(c.category));
  const maxBudget =
    budgets.length === 0 || budgets.includes("bover") ? null : Math.max(...budgets.map((b) => BUDGETS.find((x) => x.key === b)!.max!));

  // 売り場ごとに：細かい種類を選んでいればその種類の全商品／種類が1つだけ（果物）ならその全商品／それ以外は人気の品
  const typeSources: { key: string; cat: SweetCategory; name: string }[] = [];
  const overviewCats: SweetCategoryName[] = [];
  for (const c of catInfos) {
    const chosen = c.types.filter((t) => types.includes(typeKey(c, t.code)));
    const use = chosen.length ? chosen : c.types.length === 1 ? c.types : [];
    if (use.length) use.forEach((t) => typeSources.push({ key: typeKey(c, t.code), cat: c, name: t.name }));
    else overviewCats.push(c.category);
  }
  const enough = (key: string) => {
    const d = typeData[key];
    if (!d) return false;
    if (d.complete) return true;
    const last = d.items[d.items.length - 1];
    return maxBudget !== null && !!last && last.price > maxBudget;
  };
  const missing = typeSources.filter((s) => !enough(s.key));
  const missingSig = missing.map((s) => s.key).join(",");

  // 足りない種類を、高島屋から1つずつ順番に読み込みます（負担をかけないよう同時には読みません）
  useEffect(() => {
    if (!db || !missingSig || needCode) return;
    let cancelled = false;
    const run = async () => {
      for (const s of missing) {
        if (cancelled) return;
        if (inflight.current.has(s.key)) continue;
        inflight.current.add(s.key);
        setTypeLoading(`${s.cat.category}・${s.name}`);
        try {
          const [catCode, tCode] = s.key.split("/");
          const force = forceNext.current;
          const res = await apiFetch(
            `/api/sweets?cat=${catCode}&type=${tCode}${maxBudget !== null ? `&max=${maxBudget}` : ""}${force ? "&refresh=1" : ""}`,
          );
          const json = await res.json();
          if (res.status === 401) {
            setNeedCode(true);
            return;
          }
          if (!res.ok) throw new Error(json.error ?? "読み込みに失敗しました");
          setTypeData((prev) => ({ ...prev, [s.key]: json as TypeResponse }));
        } catch (e) {
          setError(e instanceof Error ? e.message : "読み込みに失敗しました");
          setTypeLoading(null);
          return;
        } finally {
          inflight.current.delete(s.key);
        }
      }
      forceNext.current = false;
      if (!cancelled) setTypeLoading(null);
    };
    void run();
    return () => {
      cancelled = true;
    };
    // missing の中身は missingSig で表しています
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, missingSig, maxBudget, needCode]);

  // 表示する商品：人気の品＋読み込んだ種類の商品（同じ商品は1つに）
  const pool = new Map<string, Sweet>();
  for (const s of (db?.items ?? []).filter((x) => overviewCats.includes(x.category))) pool.set(s.id, s);
  for (const src of typeSources) for (const s of typeData[src.key]?.items ?? []) pool.set(s.id, s);

  const inBudget = (p: number) =>
    budgets.length === 0 ||
    budgets.some((k) => {
      const b = BUDGETS.find((x) => x.key === k)!;
      return p >= b.min && (b.max === null || p <= b.max);
    });
  const filtered = [...pool.values()].filter((s) => inBudget(s.price) && !isDisliked(`${s.name} ${s.type}`, dislikes));
  const seedText = todayKey() + JSON.stringify([cats, types, budgets, dislikes]);
  const todays = seededPick(filtered, seedText, 3);
  const todayIds = new Set(todays.map((s) => s.id));
  const others = filtered.filter((s) => !todayIds.has(s.id)).sort((a, b) => a.price - b.price);
  const showResults = !!db && missing.length === 0;

  const resetCount = () => setShowCount(10);

  return (
    <>
      <section className="card">
        <h2>しぼりこみ</h2>
        <p className="small-text">
          どのグループも、いくつでも選べます。「種類」を押すと、その細かい種類が全部選ばれます（もう一度押すと外れます）。「予算」「苦手」の「すべて」は、全部選ぶボタンです。
        </p>

        <div className="field">
          <span className="label">種類</span>
          <div className="chip-row">
            {ALL_CATS.map((name) => {
              const on = cats.includes(name);
              const info = db?.categories.find((c) => c.category === name);
              const keysOfCat = info ? info.types.map((t) => typeKey(info, t.code)) : [];
              return (
                <button
                  key={name}
                  type="button"
                  className={`chip${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() => {
                    // 種類を選ぶと、その種類の細かい種類を全部選びます。外すと全部外します
                    setCats((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
                    setTypes((prev) =>
                      on ? prev.filter((k) => !keysOfCat.includes(k)) : [...new Set([...prev, ...keysOfCat])],
                    );
                    resetCount();
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {catInfos.some((c) => c.types.length > 0) && (
          <div className="field">
            <span className="label">細かい種類</span>
            {catInfos.map((c, idx) => (
              <div key={c.code} style={{ marginTop: idx === 0 ? 0 : 8 }}>
                <span className="small-text" style={{ fontWeight: 700 }}>
                  {c.category}
                </span>
                <div className="chip-row">
                  {c.types.map((t) => {
                    const k = typeKey(c, t.code);
                    const on = types.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        className={`chip${on ? " on" : ""}`}
                        aria-pressed={on}
                        onClick={() => {
                          setTypes((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
                          resetCount();
                        }}
                      >
                        {t.name}
                        <span className="small-text">（{t.count}）</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <ChipGroup
          label="予算"
          options={BUDGETS.map((b) => ({ key: b.key, label: b.label }))}
          selected={budgets}
          onChange={(update) => {
            setBudgets(update);
            resetCount();
          }}
        />

        <ChipGroup
          label="苦手・ダメなもの（選んだものを除きます）"
          options={DISLIKES.map((d) => ({ key: d.key, label: d.label }))}
          selected={dislikes}
          onChange={(update) => {
            setDislikes(update);
            resetCount();
          }}
        />
        <p className="small-text" style={{ marginBottom: 0 }}>
          苦手なものは、商品名と種類から見分けています。原材料までは分からないので、アレルギーがある場合は必ず高島屋の商品ページで原材料を確かめてください。
        </p>
      </section>

      {db && overviewCats.length > 0 && (
        <div className="notice info">
          {overviewCats.join("・")}は、いまは人気の品などから選んでいます。「細かい種類」を選ぶと、その種類のすべての商品から探せます。
        </div>
      )}

      {needCode && (
        <AccessCodeForm
          onSaved={() => {
            setNeedCode(false);
            void refresh(false);
          }}
        />
      )}

      {(loading || (db && missing.length > 0)) && !needCode && (
        <div className="notice info" role="status">
          {typeLoading
            ? `高島屋から「${typeLoading}」の商品を安い順に読み込んでいます…（残り ${missing.length} 種類。数が多いと少し時間がかかります）`
            : "高島屋から最新の商品を読み込んでいます…"}
        </div>
      )}
      {error && <div className="notice warn">{error}</div>}

      {showResults && (
        <>
          <h2>今日のおすすめ</h2>
          <p className="small-text">条件に合う商品の中から、日替わりで3つ選んでいます（同じ日・同じ条件なら同じおすすめです）。</p>
          {todays.length === 0 ? (
            <div className="notice warn">条件に合う商品がありませんでした。種類・予算・苦手なものの選び方を変えてみてください。</div>
          ) : (
            todays.map((s) => <SweetCard key={s.id} s={s} today />)
          )}

          {others.length > 0 && (
            <>
              <h2 style={{ marginTop: 24 }}>ほかの候補（安い順・{others.length}件）</h2>
              {others.slice(0, showCount).map((s) => (
                <SweetCard key={s.id} s={s} />
              ))}
              {showCount < others.length && (
                <button type="button" className="btn secondary" onClick={() => setShowCount((n) => n + 10)}>
                  もっと見る
                </button>
              )}
            </>
          )}

          <p className="small-text" style={{ marginTop: 24 }}>
            商品情報：高島屋オンラインストアより（{new Date(db!.fetchedAt).toLocaleString("ja-JP")} ごろ）。
            価格や在庫は変わることがあるので、買う前に高島屋のページで確かめてください。
          </p>
        </>
      )}

      <button
        type="button"
        className="btn secondary"
        onClick={() => {
          forceNext.current = true;
          setTypeData({});
          void refresh(true);
        }}
        disabled={loading || !!typeLoading}
        style={{ marginTop: 12 }}
      >
        最新の情報に更新する
      </button>
    </>
  );
}
