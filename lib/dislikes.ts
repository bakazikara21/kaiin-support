// 「苦手・ダメなもの」の見分け方
// 商品名と種類（例：羊羹、チョコレート）に、次の言葉が入っているかで判断します。
// ※ 原材料までは分からないため、商品名に出てこないもの（例：生地に入ったバターやナッツ）は見分けられません。
//   アレルギーがある場合は、必ず高島屋の商品ページで原材料を確かめてください。

export type DislikeKey = "apple" | "strawberry" | "melon" | "mango" | "peach" | "nuts" | "anko" | "chestnut" | "dairy" | "choco";

export const DISLIKES: { key: DislikeKey; label: string; pattern: RegExp }[] = [
  { key: "apple", label: "りんご", pattern: /りんご|リンゴ|林檎|アップル|ポム|ふじ林|サンふじ|王林|紅玉/i },
  { key: "strawberry", label: "いちご", pattern: /いちご|イチゴ|苺|ストロベリー|あまおう|とちおとめ|スカイベリー|紅ほっぺ|ゆめのか|さがほのか/i },
  { key: "melon", label: "メロン", pattern: /メロン|めろん/i },
  { key: "mango", label: "マンゴー", pattern: /マンゴ/i },
  { key: "peach", label: "もも", pattern: /桃|ピーチ|白鳳|川中島|あかつき|(?<!す)もも|(?<!ス)モモ/i },
  {
    key: "nuts",
    label: "ナッツ",
    pattern: /ナッツ|アーモンド|くるみ|クルミ|胡桃|ピスタチオ|マカダミア|カシュー|ヘーゼル|ピーカン|ピーナッツ|落花生|プラリネ|ジャンドゥーヤ|マジパン|ヌガー|フロランタン|ダックワーズ/i,
  },
  {
    key: "anko",
    label: "あんこ系",
    pattern:
      /餡|あんこ|つぶあん|こしあん|粒あん|白あん|小倉|小豆|あずき|羊羹|ようかん|最中|もなか|饅頭|まんじゅう|どら焼|どらやき|大福|ぜんざい|おしるこ|汁粉|甘納豆|あんみつ|あんぱん|きんつば|鹿の子|練切/i,
  },
  { key: "chestnut", label: "くり", pattern: /栗|マロン|モンブラン|くり(?!ーむ|すます)/i },
  {
    key: "dairy",
    label: "乳製品",
    pattern: /乳|ミルク|チーズ|バター|クリーム|ヨーグルト|カスタード|ジェラート|アイス|ソフトクリーム|生チョコ|ショコラ・オ・レ|ラテ|フロマージュ|マスカルポーネ|プリン/i,
  },
  { key: "choco", label: "チョコ", pattern: /チョコ|ショコラ|カカオ|ガナッシュ|ガトーショコラ|ブラウニー|ザッハ/i },
];

export function isDisliked(text: string, keys: DislikeKey[]): boolean {
  if (keys.length === 0) return false;
  return DISLIKES.some((d) => keys.includes(d.key) && d.pattern.test(text));
}
