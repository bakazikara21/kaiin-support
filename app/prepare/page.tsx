import TopBar from "@/components/TopBar";
import ClientOnly from "@/components/ClientOnly";
import PrepareForm from "./PrepareForm";

export default function PreparePage() {
  return (
    <main className="page">
      <TopBar />
      <h1>登録する情報を準備する</h1>
      <p className="lead">高島屋の会員登録で入力する内容を、ここに入れて「保存する」を押してください。あとで自動入力に使います。</p>
      <ClientOnly fallback={<p>読み込み中…</p>}>
        <PrepareForm />
      </ClientOnly>
    </main>
  );
}
