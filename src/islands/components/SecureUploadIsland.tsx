import { useState } from "preact/hooks";

type PreviewStatus = "idle" | "invalid" | "ready" | "processing" | "complete";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "application/pdf"]);
const ACCEPTED_EXTENSIONS = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".pdf", "application/pdf"],
]);

function isAcceptedFile(candidate: File): boolean {
  const reportedType = candidate.type.trim().toLowerCase();

  // Trust a reported MIME type for client-side filtering; use the filename
  // extension only when the browser provides no MIME type (common on mobile).
  if (reportedType) return ACCEPTED_TYPES.has(reportedType);

  const extension = candidate.name.toLowerCase().match(/\\.[^.]+$/)?.[0] ?? "";
  return ACCEPTED_EXTENSIONS.has(extension);
}

function getFileTypeLabel(candidate: File): string {
  if (candidate.type) return candidate.type;
  const extension = candidate.name.toLowerCase().match(/\\.[^.]+$/)?.[0] ?? "";
  return ACCEPTED_EXTENSIONS.get(extension) ?? "نوع غير محدد";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SecureUploadIsland() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [message, setMessage] = useState("اسحب ملفاً إلى المنطقة أو اختره من جهازك.");
  const [progress, setProgress] = useState(0);

  const selectFile = (candidate: File | null) => {
    setProgress(0);
    if (!candidate) {
      setFile(null);
      setStatus("idle");
      setMessage("اسحب ملفاً إلى المنطقة أو اختره من جهازك.");
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      setFile(null);
      setStatus("invalid");
      setMessage("حجم الملف يتجاوز الحد المسموح وهو 5 MiB.");
      return;
    }
    if (!isAcceptedFile(candidate)) {
      setFile(null);
      setStatus("invalid");
      setMessage("نوع الملف غير مدعوم. الأنواع المسموحة: PNG وJPEG وPDF.");
      return;
    }
    setFile(candidate);
    setStatus("ready");
    setMessage("اجتاز الملف التحقق المبدئي من النوع والحجم داخل المتصفح.");
  };

  const simulateUpload = async () => {
    if (!file || status !== "ready") return;
    setStatus("processing");
    setMessage("محاكاة محلية: التحقق من بيانات الملف…");
    setProgress(24);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setMessage("محاكاة محلية: تجهيز مسار الحجر الأمني…");
    setProgress(68);
    await new Promise((resolve) => window.setTimeout(resolve, 550));
    setProgress(100);
    setStatus("complete");
    setMessage("اكتملت المحاكاة بنجاح. لم يُرسل الملف إلى أي خادم ولم يُحفظ في R2.");
  };

  const reset = () => selectFile(null);

  return (
    <section class="grid gap-5 rounded-2xl border border-tlce-accent/40 bg-tlce-cosmic p-5 text-white shadow-xl sm:p-7" aria-labelledby="secure-upload-title">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="grid gap-1">
          <p class="text-xs font-semibold tracking-[0.18em] text-tlce-glow">SECURE FILE INTAKE · LOCAL PREVIEW</p>
          <h2 id="secure-upload-title" class="text-xl font-bold sm:text-2xl">بوابة استقبال الملفات الآمنة</h2>
          <p class="max-w-2xl text-sm leading-6 text-slate-300">واجهة اختبار لمسار اختيار الملف والتحقق المبدئي ومحاكاة الانتقال إلى الحجر الأمني.</p>
        </div>
        <span class="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
          <span class="size-2 rounded-full bg-amber-300" aria-hidden="true"></span>
          اختبار محلي فقط
        </span>
      </div>

      <div class="grid gap-2 sm:grid-cols-3" aria-label="مراحل الرفع">
        <div class="rounded-xl border border-white/10 bg-white/5 p-3"><span class="text-xs text-slate-400">01 · اختيار</span><p class="mt-1 font-semibold">تحديد الملف</p></div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-3"><span class="text-xs text-slate-400">02 · تحقق مبدئي</span><p class="mt-1 font-semibold">النوع والحجم</p></div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-3"><span class="text-xs text-slate-400">03 · حجر تجريبي</span><p class="mt-1 font-semibold">محاكاة محلية</p></div>
      </div>

      <label class="grid min-h-44 cursor-pointer place-items-center gap-3 rounded-xl border-2 border-dashed border-tlce-accent/50 bg-tlce-ink/70 p-5 text-center transition hover:border-tlce-glow focus-within:ring-2 focus-within:ring-tlce-glow"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {\n          event.preventDefault();\n          const files = event.dataTransfer?.files;\n          if (!files || files.length === 0) return;\n          selectFile(files[0] ?? null);\n        }}>
        <input class="sr-only" type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" disabled={status === "processing"}
          onChange={(event) => {
            const input = event.currentTarget;
            selectFile(input.files?.[0] ?? null);
            // Clearing the native input allows selecting the same file again.
            input.value = "";
          }} />
        <span class="grid size-12 place-items-center rounded-2xl bg-tlce-accent/20 text-2xl text-tlce-glow" aria-hidden="true">↑</span>
        <span class="grid gap-1"><strong class="text-base">اسحب الملف هنا أو اضغط للاختيار</strong><span class="text-xs text-slate-400">PNG · JPEG · PDF — الحد الأقصى 5 MiB</span></span>
      </label>

      {file && <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-tlce-ink/70 p-4">
        <div class="min-w-0"><p class="truncate font-semibold">{file.name}</p><p class="mt-1 text-xs text-slate-400">{getFileTypeLabel(file)} · {formatBytes(file.size)}</p></div>
        <button class="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50" type="button" onClick={reset} disabled={status === "processing"}>إزالة الملف</button>
      </div>}

      {(status === "processing" || status === "complete") && <div class="grid gap-2">
        <div class="flex justify-between text-xs text-slate-300"><span>تقدم المحاكاة</span><span>{progress}%</span></div>
        <div class="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="تقدم المحاكاة المحلية" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div class="h-full rounded-full bg-tlce-glow transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
      </div>}

      <div class="flex flex-wrap items-center gap-3">
        <button class="rounded-xl bg-tlce-accent px-5 py-3 text-sm font-bold text-white shadow-lg shadow-tlce-accent/20 transition hover:bg-tlce-glow disabled:cursor-not-allowed disabled:opacity-40"
          type="button" disabled={!file || status !== "ready"} onClick={simulateUpload}>
          {status === "processing" ? "جارٍ تنفيذ المحاكاة…" : status === "complete" ? "اكتملت المحاكاة" : "محاكاة مسار الرفع"}
        </button>
        {status === "complete" && <button class="rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200 hover:bg-white/10" type="button" onClick={reset}>اختبار ملف آخر</button>}
      </div>

      <p class={`rounded-xl border p-3 text-sm leading-6 ${status === "invalid" ? "border-rose-300/30 bg-rose-300/10 text-rose-200" : status === "complete" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"}`} role="status" aria-live="polite">{message}</p>

      <div class="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-6 text-amber-100/90">
        <strong class="block text-sm">حدود هذه المعاينة</strong>
        <ul class="mt-2 list-disc space-y-1 pr-5">
          <li>الملف يبقى داخل جلسة المتصفح؛ لا توجد طلبات شبكة أو عمليات رفع فعلية.</li>
          <li>فحص النوع والحجم مبدئي فقط، وليس فحصاً ضد البرمجيات الخبيثة.</li>
          <li>لا تُنشأ سجلات حجر حقيقية ولا تُمنح الملفات حالة آمنة أو قابلة للتنزيل.</li>
        </ul>
      </div>
    </section>
  );
}
