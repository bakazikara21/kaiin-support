// スイーツ商品の形（サーバーとブラウザの両方で使います）
export type SweetCategoryName = "洋菓子" | "和菓子";

export type Sweet = {
  id: string; // 商品ページのURLから作る番号
  name: string; // 商品名
  category: SweetCategoryName;
  type: string; // 種別（例：チョコレート、羊羹）
  price: number; // 税込価格（円）
  url: string; // 高島屋の商品ページ
};

// 細かい種類（例：チョコレート 216件）
export type SweetType = { code: string; name: string; count: number };

export type SweetCategory = { category: SweetCategoryName; code: string; types: SweetType[] };

// 売り場トップ（人気ランキングなど）から読んだ一覧と、細かい種類の一覧
export type OverviewResponse = {
  fetchedAt: string;
  categories: SweetCategory[];
  items: Sweet[];
};

// 細かい種類を1つ選んだときの一覧（安い順）
export type TypeResponse = {
  fetchedAt: string;
  category: SweetCategoryName;
  type: SweetType;
  items: Sweet[];
  total: number; // 高島屋でのその種類の全件数
  complete: boolean; // 全件を読み終わったか（予算で途中まで読んだ場合は false）
};
