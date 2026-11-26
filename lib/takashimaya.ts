// 高島屋オンラインストアの「洋菓子」「和菓子」のページから、商品名・種別・価格・URLを読み取ります。
// （サーバー側でだけ動きます。ブラウザから直接ほかのサイトを読むことはできないためです）
//
// 読み方は2通りあります。
// 1) 売り場トップ：人気ランキングなど約100件と、細かい種類（チョコレート 216件 など）の一覧
// 2) 細かい種類の一覧：その種類の全商品を「価格が安い順」に1ページ180件ずつ読みます。
//    予算が決まっているときは、予算を超えたところで読むのをやめ、高島屋へのアクセスを減らします。
import type { OverviewResponse, Sweet, SweetCategory, SweetCategoryName, TypeResponse } from "./sweets";

const BASE = "https://www.takashimaya.co.jp";
// onlyTypes：その売り場のうち、この種類だけを使います（「フルーツ・野菜」売り場の「フルーツ」だけを果物とする）
export const CATEGORY_PAGES: { category: SweetCategoryName; code: string; onlyTypes?: string[] }[] = [
  { category: "洋菓子", code: "0400000001" },
  { category: "和菓子", code: "0400000014" },
  { category: "果物", code: "0400000052", onlyTypes: ["フルーツ"] },
];

const PAGE_SIZE = 180; // 高島屋の一覧で1ページに出せる最大の件数
const MAX_PAGES = 10; // 念のための上限（180件×10ページ＝1,800件）
const CACHE_MS = 6 * 60 * 60 * 1000; // 6時間は同じ結果を使います

// HTMLの特殊な書き方（&amp; など）を元の文字に戻します
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(path: string): Promise<string> {
  const res = await fetch(BASE + path, {
    headers: {
      "User-Agent": "Mozilla/5.0 (personal sweets recommendation app)",
      "Accept-Language": "ja",
    },
    signal: AbortSignal.timeout(60000), // 高島屋のページは大きく、時間がかかることがあります
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`高島屋のページを読めませんでした（${res.status}）`);
  return res.text();
}

function idOf(url: string): string {
  const m = url.match(/p_cd=(\d+)(?:.*sub_cd=(\d+))?/);
  return m ? `${m[1]}-${m[2] ?? "001"}` : url;
}

// ===== 1) 売り場トップ =====

type RawItem = { id: string; name: string; price: number; url: string };

// 売り場トップの商品カード（c-productitembox）1つ分を読み取ります
function parseItemBox(chunk: string): RawItem | null {
  const link = chunk.match(/href="(\/shopping\/product\.html\?p_cd=\d+[^"]*)"/);
  const name = chunk.match(/c-productitembox__detail__name[^>]*>([^<]+)</);
  const price = chunk.match(/c-price__text__strong">([\d,]+)</);
  if (!link || !name || !price) return null;
  const url = BASE + decode(link[1]);
  return { id: idOf(url), name: decode(name[1]), price: Number(price[1].replace(/,/g, "")), url };
}

export function parseCategoryPage(
  html: string,
  category: SweetCategoryName,
  code: string,
  onlyTypes?: string[],
): { items: Sweet[]; cat: SweetCategory } {
  // 細かい種類の一覧（例：チョコレート（216））
  const typeRe = new RegExp(`href="/shopping/food/${code}/(\\d{10})"[^>]*>\\s*([^<（]+)（(\\d+)）`, "g");
  const types = [...html.matchAll(typeRe)]
    .map((m) => ({ code: m[1], name: decode(m[2]), count: Number(m[3]) }))
    .filter((t) => !onlyTypes || onlyTypes.includes(t.name));

  // ランキングの「種別タブ」と商品の対応
  const typeById = new Map<string, string>();
  const navAt = html.indexOf("js-productslidernav__content");
  if (navAt > 0) {
    const tags = [...html.matchAll(/-navbtn"><span class="c-tag -strong">([^<]+)</g)].map((m) => decode(m[1]));
    const groups = html.slice(navAt).split('<li class="c-productslider--content__item">').slice(1);
    tags.forEach((tag, i) => {
      if (i === 0 || !groups[i]) return; // 最初のタブは売り場全体（「洋菓子」など）なので、種別として使いません
      groups[i]
        .split('class="c-productitembox"')
        .slice(1, 6)
        .forEach((chunk) => {
          const it = parseItemBox(chunk);
          if (it && !typeById.has(it.id)) typeById.set(it.id, tag);
        });
    });
  }

  const seen = new Map<string, Sweet>();
  for (const chunk of html.split('class="c-productitembox"').slice(1)) {
    const it = parseItemBox(chunk);
    if (!it || seen.has(it.id)) continue;
    const type = typeById.get(it.id) ?? `その他の${category}`;
    if (onlyTypes && !onlyTypes.includes(type)) continue; // 果物の売り場の野菜などは除きます
    seen.set(it.id, { ...it, category, type });
  }
  return { items: [...seen.values()], cat: { category, code, types } };
}

let overviewCache: { at: number; data: OverviewResponse } | null = null;

export async function getOverview(force = false): Promise<OverviewResponse> {
  if (!force && overviewCache && Date.now() - overviewCache.at < CACHE_MS) return overviewCache.data;
  const results = [];
  for (const { category, code, onlyTypes } of CATEGORY_PAGES) {
    results.push(parseCategoryPage(await fetchHtml(`/shopping/food/${code}/`), category, code, onlyTypes));
  }
  const items = results.flatMap((r) => r.items);
  if (items.length === 0) throw new Error("商品が見つかりませんでした（高島屋のページの作りが変わった可能性があります）");
  const data: OverviewResponse = {
    fetchedAt: new Date().toISOString(),
    categories: results.map((r) => r.cat),
    items,
  };
  overviewCache = { at: Date.now(), data };
  return data;
}

// ===== 2) 細かい種類の一覧（安い順） =====

// 検索結果ページの商品（<article class="p-searchitem">）を読み取ります
export function parseSearchPage(html: string, category: SweetCategoryName, typeName: string): { items: Sweet[]; total: number } {
  // 「全217件」の件数（ページの中に data-cnt はいくつもあるので、一覧の件数のものを選びます）
  const total = Number(html.match(/id="searchedItemsCount_\d+" data-cnt="(\d+)"/)?.[1] ?? html.match(/全(\d+)件/)?.[1] ?? 0);
  const items: Sweet[] = [];
  for (const art of html.split('<article class="p-searchitem">').slice(1)) {
    const name = art.match(/class="-name"><a[^>]*href="([^"]+)"[^>]*>([^<]+)</);
    const price = art.match(/c-price__text__strong">([\d,]+)</);
    if (!name || !price) continue;
    const url = BASE + decode(name[1]);
    items.push({
      id: idOf(url),
      name: decode(name[2]),
      category,
      type: typeName,
      price: Number(price[1].replace(/,/g, "")),
      url,
    });
  }
  return { items, total };
}

type TypeCacheEntry = { at: number; items: Sweet[]; total: number; pages: number; complete: boolean };
const typeCache = new Map<string, TypeCacheEntry>();

// 同じ種類を同時に読みに行かないよう、種類ごとに順番待ちをします
const locks = new Map<string, Promise<unknown>>();

export function getTypeItems(categoryCode: string, typeCode: string, maxPrice: number | null, force = false): Promise<TypeResponse> {
  const key = `${categoryCode}/${typeCode}`;
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => loadTypeItems(categoryCode, typeCode, maxPrice, force));
  locks.set(key, next);
  return next;
}

async function loadTypeItems(categoryCode: string, typeCode: string, maxPrice: number | null, force: boolean): Promise<TypeResponse> {
  const overview = await getOverview();
  const cat = overview.categories.find((c) => c.code === categoryCode);
  const type = cat?.types.find((t) => t.code === typeCode);
  if (!cat || !type) throw new Error("その種類は見つかりませんでした");

  const key = `${categoryCode}/${typeCode}`;
  let entry = typeCache.get(key);
  if (force || !entry || Date.now() - entry.at > CACHE_MS) {
    entry = { at: Date.now(), items: [], total: type.count, pages: 0, complete: false };
    typeCache.set(key, entry);
  }

  // 予算の上限を超える商品が出てくるまで（または最後のページまで）、安い順に読み進めます
  const enough = () => {
    if (entry!.complete) return true;
    if (maxPrice === null) return false;
    const last = entry!.items[entry!.items.length - 1];
    return !!last && last.price > maxPrice;
  };
  while (!enough() && entry.pages < MAX_PAGES) {
    if (entry.pages > 0) await wait(400); // 高島屋に負担をかけないよう、少し間をあけます
    const page = entry.pages + 1;
    const html = await fetchHtml(
      `/shopping/food/${categoryCode}/${typeCode}/search.html?display_count=${PAGE_SIZE}&display_order=2&current_page_number=${page}`,
    );
    const { items, total } = parseSearchPage(html, cat.category, type.name);
    const known = new Set(entry.items.map((s) => s.id));
    entry.items.push(...items.filter((s) => !known.has(s.id)));
    entry.pages = page;
    if (total) entry.total = total;
    if (items.length < PAGE_SIZE || entry.items.length >= entry.total) entry.complete = true;
  }

  return {
    fetchedAt: new Date(entry.at).toISOString(),
    category: cat.category,
    type,
    items: entry.items,
    total: entry.total,
    complete: entry.complete,
  };
}
