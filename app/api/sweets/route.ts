// 「/api/sweets」にアクセスすると、高島屋のスイーツ一覧をJSON形式で返します
//   /api/sweets                         … 売り場トップの一覧と、細かい種類の一覧
//   /api/sweets?cat=…&type=…&max=2000   … その種類の商品を安い順に（予算の上限まで）
import { checkAccess, denied } from "@/lib/access";
import { getOverview, getTypeItems } from "@/lib/takashimaya";

export async function GET(request: Request) {
  // 合言葉を知っている人だけが使えます（高島屋に何度もアクセスされないようにするため）
  if (!checkAccess(request)) return denied();
  const q = new URL(request.url).searchParams;
  const force = q.get("refresh") === "1";
  const cat = q.get("cat");
  const type = q.get("type");
  const maxRaw = q.get("max");
  const max = maxRaw && /^\d+$/.test(maxRaw) ? Number(maxRaw) : null;

  try {
    if (cat && type) {
      if (!/^\d{10}$/.test(cat) || !/^\d{10}$/.test(type)) {
        return Response.json({ error: "種類の指定が正しくありません" }, { status: 400 });
      }
      return Response.json(await getTypeItems(cat, type, max, force));
    }
    return Response.json(await getOverview(force));
  } catch (e) {
    const message = e instanceof Error ? e.message : "読み込みに失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
