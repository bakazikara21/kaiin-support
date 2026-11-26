import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// 同じWi-Fiにつないだスマートフォンから開発中のアプリを開けるように、
// このパソコンのIPアドレス（例: 192.168.x.x）を許可リストに入れます。
const localIps = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: localIps,
};

export default nextConfig;
