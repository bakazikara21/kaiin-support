import TopBar from "@/components/TopBar";
import ClientOnly from "@/components/ClientOnly";
import AssistantChat from "./AssistantChat";

export default function AssistantPage() {
  return (
    <main className="page">
      <TopBar />
      <h1>AIに聞く</h1>
      <ClientOnly fallback={<p>読み込み中…</p>}>
        <AssistantChat />
      </ClientOnly>
    </main>
  );
}
