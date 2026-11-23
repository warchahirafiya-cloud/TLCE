import { useState } from "preact/hooks";
import { sendAiChat } from "../../services/worker-api";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function AIChatIsland() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = prompt.trim();
    if (!text || busy) return;

    setMessages((current) => [...current, { role: "user", text }]);
    setPrompt("");
    setBusy(true);
    try {
      const response = await sendAiChat(text);
      setMessages((current) => [...current, { role: "assistant", text: response.answer }]);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "تعذر الاتصال بخدمة الذكاء الاصطناعي. تحقق من جلسة Cloudflare Access.";
      setMessages((current) => [...current, { role: "assistant", text: message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="grid gap-3 rounded-xl border border-tlce-accent/30 bg-tlce-cosmic p-4 text-white">
      <div>
        <h2 class="text-lg font-semibold">مساعد TLCE الذكي</h2>
        <p class="mt-1 text-sm text-slate-300">يتطلب جلسة Cloudflare Access صالحة</p>
      </div>
      <div class="grid max-h-80 gap-2 overflow-y-auto rounded-lg bg-tlce-ink p-3" aria-live="polite">
        {messages.length === 0
          ? <p class="text-sm text-slate-400">ابدأ بكتابة سؤالك.</p>
          : messages.map((message, index) => (
            <p key={index} class={message.role === "user" ? "text-sm text-tlce-glow" : "text-sm text-slate-100"}>
              <strong>{message.role === "user" ? "أنت: " : "TLCE AI: "}</strong>{message.text}
            </p>
          ))}
      </div>
      <textarea
        class="min-h-24 w-full rounded-lg border border-slate-600 bg-tlce-ink p-3 text-sm text-white"
        value={prompt}
        maxLength={8000}
        placeholder="اكتب رسالتك…"
        disabled={busy}
        onInput={(event) => setPrompt(event.currentTarget.value)}
      />
      <button
        class="rounded-lg bg-tlce-accent px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={!prompt.trim() || busy}
        onClick={send}
      >
        {busy ? "جارٍ التفكير…" : "إرسال"}
      </button>
    </section>
  );
}
