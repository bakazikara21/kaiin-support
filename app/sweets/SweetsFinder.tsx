"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AccessCodeForm from "@/components/AccessCodeForm";
import { apiFetch } from "@/lib/accessCode";
import type { OverviewResponse, Sweet, SweetCategoryName, TypeResponse } from "@/lib/sweets";

const DB_KEY = "kaiin-support:sweets-db";

type Budget = "all" | "2000" | "3000" | "5000" | "over5000";
const BUDGETS: { value: Budget; label: string }[] = [
  { value: "all", label: "指定なし" },
  { value: "2000", label: "2,000円まで" },
  { value: "3000", label: "3,000円まで" },
  { value: "5000", label: "5,000円まで" },
  { value: "over5000", label: "5,000円より上" },
];

// 予算の上限（高島屋から安い順に読むとき、ここまで読めば足ります）
function budgetMax(b: Budget): number | null {
  return b === "2000" || b === "3000" || b === "5000" ? Number(b) : null;
}

// ブラウザに保存してある一覧（前回取得した分）を読み込みます
function loadDb(): OverviewResponse | null {
  try {
    const raw = localStorage.getItem(DB_KEY);
    const d = raw ? (JSON.parse(raw) as OverviewResponse) : null;
    // 以前の版の形（種類の一覧がない）は使いません
    return d && Array.isArray(d.categories) ? d : null;
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

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// 日付をもとにした「くじ」。同じ日なら同じおすすめ、日が変わると別のおすすめになります
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

function inBudget(price: number, b: Budget): boolean {
  if (b === "all") return true;
  if (b === "over5000") return price > 5000;
  return price <= Number(b);
}

function yen(n: number) {
  return n.toLocaleString("ja-JP") + "円";
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

export default function SweetsFinder() {
  const [db, setDb] = useState<OverviewResponse | null>(loadDb);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<"all" | SweetCategoryName>("all");
  const [typeCode, setTypeCode] = useState<string>("all");
  const [budget, setBudget] = useState<Budget>("all");
  const [typeData, setTypeData] = useState<TypeResponse | null>(null);
  const [typeLoading, setTypeLoading] = useState(false);
  const [showCount, setShowCount] = useState(10);
  const [needCode, setNeedCode] = useState(false);
  const requestNo = useRef(0);

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

  // 細かい種類を選んだとき：その種類の全商品を安い順に読み込みます
  const loadType = useCallback(async (catCode: string, tCode: string, b: Budget, force = false) => {
    const no = ++requestNo.current;
    setTypeLoading(true);
    setError(null);
    try {
      const max = budgetMax(b);
      const res = await apiFetch(`/api/sweets?cat=${catCode}&type=${tCode}${max ? `&max=${max}` : ""}${force ? "&refresh=1" : ""}`);
      const json = await res.json();
      if (res.status === 401) {
        setNeedCode(true);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "読み込みに失敗しました");
      if (no === requestNo.current) setTypeData(json as TypeResponse);
    } catch (e) {
      if (no === requestNo.current) setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      if (no === requestNo.current) setTypeLoading(false);
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

  const currentCat = db?.categories.find((c) => c.category === category) ?? null;
  const types = currentCat?.types ?? [];
  const selectedType = types.find((t) => t.code === typeCode) ?? null;

  const chooseCategory = (c: "all" | SweetCategoryName) => {
    setCategory(c);
    setTypeCode("all");
    setTypeData(null);
    requestNo.current++;
    setTypeLoading(false);
    setShowCount(10);
  };

  const chooseType = (code: string) => {
    setTypeCode(code);
    setShowCount(10);
    setTypeData(null);
    if (code === "all" || !currentCat) {
      requestNo.current++;
      setTypeLoading(false);
      return;
    }
    void loadType(currentCat.code, code, budget);
  };

  const chooseBudget = (b: Budget) => {
    setBudget(b);
    setShowCount(10);
    // 予算を上げたときなどは、足りない分を高島屋から読み足します
    if (selectedType && currentCat) {
      const have = typeData?.type.code === selectedType.code ? typeData : null;
      const max = budgetMax(b);
      const lastPrice = have?.items.at(-1)?.price ?? 0;
      if (!have || (!have.complete && (max === null || lastPrice <= max))) {
        void loadType(currentCat.code, selectedType.code, b);
      }
    }
  };

  // いま表示の元になる商品
  // （計算結果の使い回しは React Compiler が自動で行います）
  const baseItems: Sweet[] = selectedType
    ? typeData?.type.code === selectedType.code
      ? typeData.items
      : []
    : (db?.items ?? []).filter((s) => category === "all" || s.category === category);

  const filtered = baseItems.filter((s) => inBudget(s.price, budget));
  const todays = seededPick(filtered, todayKey() + category + typeCode + budget, 3);
  const todayIds = new Set(todays.map((s) => s.id));
  const others = filtered.filter((s) => !todayIds.has(s.id)).sort((a, b) => a.price - b.price);

  const showResults = !!db && (!selectedType || (typeData?.type.code === selectedType.code && !typeLoading));

  return (
    <>
      <section className="card">
        <h2>しぼりこみ</h2>
        <div className="field">
          <span className="label">種類</span>
          <div className="chip-row">
            {(["all", "洋菓子", "和菓子"] as const).map((c) => (
              <button key={c} type="button" className={`chip${category === c ? " on" : ""}`} onClick={() => chooseCategory(c)}>
                {c === "all" ? "すべて" : c}
              </button>
            ))}
          </div>
        </div>
        {category !== "all" && types.length > 0 && (
          <div className="field">
            <span className="label">細かい種類</span>
            <div className="chip-row">
              <button type="button" className={`chip${typeCode === "all" ? " on" : ""}`} onClick={() => chooseType("all")}>
                人気の品から
              </button>
              {types.map((t) => (
                <button key={t.code} type="button" className={`chip${typeCode === t.code ? " on" : ""}`} onClick={() => chooseType(t.code)}>
                  {t.name}
                  <span className="small-text">（{t.count}）</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="label">予算</span>
          <div className="chip-row">
            {BUDGETS.map((b) => (
              <button key={b.value} type="button" className={`chip${budget === b.value ? " on" : ""}`} onClick={() => chooseBudget(b.value)}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!selectedType && db && (
        <div className="notice info">
          {category === "all"
            ? "いまは、洋菓子・和菓子の人気の品などから選んでいます。「洋菓子」か「和菓子」を選んでから「細かい種類」を選ぶと、その種類のすべての商品から探せます。"
            : "いまは人気の品などから選んでいます。「細かい種類」を選ぶと、その種類のすべての商品から探せます。"}
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

      {(loading || typeLoading) && (
        <div className="notice info" role="status">
          {typeLoading && selectedType
            ? `高島屋から「${selectedType.name}」の商品を安い順に読み込んでいます…（数が多いと少し時間がかかります）`
            : "高島屋から最新の商品を読み込んでいます…"}
        </div>
      )}
      {error && (
        <div className="notice warn">
          {error}
          {db && !selectedType && <div>前回読み込んだ一覧を表示しています。</div>}
        </div>
      )}

      {showResults && (
        <>
          <h2>今日のおすすめ</h2>
          <p className="small-text">条件に合う商品の中から、日替わりで3つ選んでいます（同じ日は同じおすすめです）。</p>
          {todays.length === 0 ? (
            <div className="notice warn">条件に合うスイーツがありませんでした。予算や種類を変えてみてください。</div>
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
            {selectedType && typeData
              ? `商品情報：高島屋オンラインストア「${typeData.category}・${typeData.type.name}」全${typeData.total}件より（${new Date(typeData.fetchedAt).toLocaleString("ja-JP")} 時点）。`
              : `商品情報：高島屋オンラインストアの売り場トップより（${new Date(db!.fetchedAt).toLocaleString("ja-JP")} 時点）。`}
            価格や在庫は変わることがあるので、買う前に高島屋のページで確かめてください。
          </p>
        </>
      )}

      <button
        type="button"
        className="btn secondary"
        onClick={() => {
          void refresh(true);
          if (selectedType && currentCat) void loadType(currentCat.code, selectedType.code, budget, true);
        }}
        disabled={loading || typeLoading}
        style={{ marginTop: 12 }}
      >
        最新の情報に更新する
      </button>
    </>
  );
}
