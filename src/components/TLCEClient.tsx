import React, { useRef, useState } from "react";

type UploadPhase =
  | "idle"
  | "requesting"
  | "uploading"
  | "queueing"
  | "quarantined"
  | "error";

type UploadResult = {
  uploadUrl: string;
  objectKey: string;
  requiredHeaders: Record<string, string>;
  maxBytes: number;
};

type Props = {
  /** Public Worker origin, e.g. https://api.example.workers.dev. Never put secrets here. */
  apiBaseUrl: string;
  /** Optional class name for embedding in the host application. */
  className?: string;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "application/pdf"]);

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

export function TLCEPlatformUI({ apiBaseUrl, className }: Props) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [fileName, setFileName] = useState("");
  const [uploadMessage, setUploadMessage] = useState("جاهز للرفع");
  const [objectKey, setObjectKey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiError, setAiError] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const api = apiBaseUrl.replace(/\/$/, "");

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setObjectKey(null);
    setPhase("requesting");
    setUploadMessage("جارٍ التحقق من الملف وطلب رابط رفع آمن...");

    try {
      if (!ALLOWED_TYPES.has(file.type)) {
        throw new Error("الأنواع المسموحة: PNG وJPEG وPDF فقط.");
      }
      if (file.size < 1 || file.size > MAX_FILE_BYTES) {
        throw new Error("حجم الملف يجب ألا يتجاوز 5 ميغابايت.");
      }

      // Cloudflare Access authenticates the browser session. Never send a Worker
      // API secret from public JavaScript.
      const grantResponse = await fetch(`${api}/api/files/presign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      const grant = await readJson<UploadResult>(grantResponse);

      setPhase("uploading");
      setUploadMessage("جارٍ رفع الملف مباشرة إلى مساحة الحجر الخاصة...");

      const putResponse = await fetch(grant.uploadUrl, {
        method: "PUT",
        credentials: "omit",
        headers: grant.requiredHeaders,
        body: file,
      });
      if (!putResponse.ok) {
        throw new Error(`فشل نقل الملف إلى R2 (${putResponse.status}). تحقق من إعداد CORS للحاوية.`);
      }

      setPhase("queueing");
      setUploadMessage("وصل الملف إلى الحجر. جارٍ تسجيله في طابور الفحص...");
      const completeResponse = await fetch(`${api}/api/files/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey: grant.objectKey }),
      });
      const completed = await readJson<{ status?: string; scanStatus?: string; objectKey?: string }>(completeResponse);
      setObjectKey(completed.objectKey ?? grant.objectKey);
      setPhase("quarantined");
      setUploadMessage(
        "تم استلام الملف ووضعه في الحجر بنجاح. الفحص الأمني لم يصدر حكماً نهائياً بعد؛ الملف غير معتمد وغير متاح للإنتاج."
      );
    } catch (error) {
      setPhase("error");
      setUploadMessage(error instanceof Error ? error.message : "تعذر إكمال عملية الرفع.");
    } finally {
      // Permit selecting the same file again after a failed or completed attempt.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleAskAI() {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || loadingAI) return;

    setLoadingAI(true);
    setAnswer("");
    setAiError("");
    try {
      const response = await fetch(`${api}/api/ai/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt }),
      });
      const payload = await readJson<{ response?: unknown; text?: string; error?: string }>(response);
      const result = payload.response ?? payload.text ?? payload;
      if (typeof result === "string") {
        setAnswer(result);
      } else if (result && typeof result === "object" && "response" in result &&
                 typeof (result as { response?: unknown }).response === "string") {
        setAnswer((result as { response: string }).response);
      } else {
        setAnswer(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "تعذر الاتصال بالمساعد الذكي.");
    } finally {
      setLoadingAI(false);
    }
  }

  const busy = phase === "requesting" || phase === "uploading" || phase === "queueing";

  return (
    <main className={className} dir="rtl" lang="ar"
      style={{ maxWidth: 680, margin: "40px auto", padding: 20, fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
      <h2>منصة TLCE — لوحة التحكم</h2>

      <section aria-labelledby="tlce-upload-heading"
        style={{ marginBottom: 24, padding: 18, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 }}>
        <h3 id="tlce-upload-heading">رفع الملفات الآمن</h3>
        <p>الملفات المقبولة: PNG وJPEG وPDF — الحد الأقصى 5 ميغابايت.</p>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,application/pdf"
          disabled={busy} onChange={handleFileUpload} aria-label="اختر ملفاً لرفعه" />
        {fileName && <p><strong>الملف:</strong> {fileName}</p>}
        <p role="status" aria-live="polite"><strong>الحالة:</strong> {uploadMessage}</p>
        {phase === "quarantined" && (
          <p style={{ color: "#92400e" }}>
            قيد الحجر والفحص — لا يعني نجاح الاستلام أن الملف نظيف أو معتمد.
          </p>
        )}
        {phase === "error" && <p style={{ color: "#b91c1c" }}>لم يكتمل الرفع.</p>}
        {objectKey && <small>معرّف الحجر: {objectKey}</small>}
      </section>

      <section aria-labelledby="tlce-ai-heading"
        style={{ padding: 18, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 12 }}>
        <h3 id="tlce-ai-heading">المساعد الذكي</h3>
        <label htmlFor="tlce-ai-prompt">اكتب سؤالك</label>
        <textarea id="tlce-ai-prompt" rows={4} maxLength={8000} value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="اكتب سؤالك أو طلبك هنا..." disabled={loadingAI}
          style={{ display: "block", boxSizing: "border-box", width: "100%", margin: "10px 0", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1" }} />
        <button type="button" onClick={handleAskAI} disabled={loadingAI || !prompt.trim()}
          style={{ background: "#0f172a", color: "#fff", padding: "10px 18px", border: 0, borderRadius: 6, cursor: loadingAI ? "wait" : "pointer" }}>
          {loadingAI ? "جارٍ التفكير..." : "إرسال للمساعد"}
        </button>
        {aiError && <p role="alert" style={{ color: "#b91c1c" }}>{aiError}</p>}
        {answer && <div aria-live="polite" style={{ marginTop: 16, padding: 12, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6 }}>
          <strong>الرد:</strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{answer}</p>
        </div>}
      </section>
    </main>
  );
}
