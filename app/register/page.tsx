import TopBar from "@/components/TopBar";
import ClientOnly from "@/components/ClientOnly";
import RegisterGuide from "./RegisterGuide";

export default function RegisterPage() {
  return (
    <main className="page">
      <TopBar />
      <ClientOnly fallback={<p>読み込み中…</p>}>
        <RegisterGuide />
      </ClientOnly>
    </main>
  );
}
