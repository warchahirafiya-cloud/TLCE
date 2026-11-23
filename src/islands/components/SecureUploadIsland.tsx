import { useState } from "preact/hooks";
import { uploadFileToQuarantine } from "../../services/worker-api";

export function SecureUploadIsland() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("اختر ملف PNG أو JPEG أو PDF بحجم لا يتجاوز 5 MiB.");

  const upload = async () => {
    if (!file || busy) return;
    setBusy(true);
    setMessage("جارٍ رفع الملف إلى منطقة الحجر الأمني…");
    try {
      const result = await uploadFileToQuarantine(file);
      setMessage(
        result.status === "quarantined"
          ? "تم استلام الملف ووضعه في الحجر الأمني. لم يُعتمد كملف آمن أو قابل للتنزيل."
          : "لم يتم تأكيد حالة الملف.",
      );
      setFile(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر رفع الملف. تحقق من جلسة Cloudflare Access.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="grid gap-3 rounded-xl border border-tlce-accent/30 bg-tlce-cosmic p-4 text-white">
      <div>
        <h2 class="text-lg font-semibold">رفع ملف آمن</h2>
        <p class="mt-1 text-sm text-slate-300">يُرفع الملف إلى R2 الخاص ويبقى في الحجر بانتظار الفحص الأمني</p>
      </div>
      <input
        class="block w-full rounded-lg border border-slate-600 bg-tlce-ink p-2 text-sm"
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        disabled={busy}
        onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
      />
      <button
        class="rounded-lg bg-tlce-accent px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={!file || busy}
        onClick={upload}
      >
        {busy ? "جارٍ الرفع…" : "رفع إلى الحجر"}
      </button>
      <p class="text-sm text-slate-300" role="status" aria-live="polite">{message}</p>
    </section>
  );
}
