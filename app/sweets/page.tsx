import TopBar from "@/components/TopBar";
import ClientOnly from "@/components/ClientOnly";
import SweetsFinder from "./SweetsFinder";

export default function SweetsPage() {
  return (
    <main className="page">
      <TopBar />
      <h1>今日のおすすめスイーツ</h1>
      <p className="lead">高島屋オンラインストアの洋菓子・和菓子から、条件に合うものをおすすめします。</p>
      <ClientOnly fallback={<p>読み込み中…</p>}>
        <SweetsFinder />
      </ClientOnly>
    </main>
  );
}
