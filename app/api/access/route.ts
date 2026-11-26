// 「/api/access」：合言葉が必要か、このスマホの合言葉が合っているかを返します
import { checkAccess } from "@/lib/access";

export function GET(request: Request) {
  return Response.json({ required: !!process.env.ACCESS_CODE, ok: checkAccess(request) });
}
