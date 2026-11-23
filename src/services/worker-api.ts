export interface AiChatResponse {
  provider: string;
  answer: string;
}

export interface UploadPresignResponse {
  uploadUrl: string;
  method: "PUT";
  objectKey: string;
  expiresInSeconds: number;
  requiredHeaders: Record<string, string>;
  maxBytes: number;
  status: "quarantine_upload_authorized";
}

export interface QuarantineUploadResponse {
  status: "quarantined";
  scanStatus?: string;
  objectKey?: string;
  uploadId?: string;
  message?: string;
  sha256?: string;
  etag?: string;
}

interface ApiError {
  error?: string;
}

function apiUrl(path: string): URL {
  const configuredBase = import.meta.env.VITE_TLCE_API_BASE?.trim();
  const base = new URL(configuredBase || window.location.origin, window.location.origin);
  const url = new URL(path, base);
  if (url.origin !== window.location.origin) {
    throw new Error("TLCE API must be same-origin so the Cloudflare Access session is not exposed cross-origin");
  }
  return url;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? String((payload as ApiError).error ?? `HTTP ${response.status}`)
      : `TLCE API request failed (HTTP ${response.status})`;
    throw new Error(message);
  }
  if (!contentType.includes("application/json")) {
    throw new Error("TLCE API returned a non-JSON response; check Cloudflare Access and API routing");
  }
  return payload as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

/** Calls the authenticated Worker route. Access cookies are sent by the browser. */
export function sendAiChat(prompt: string): Promise<AiChatResponse> {
  const normalized = prompt.trim();
  if (!normalized || normalized.length > 8000) {
    throw new Error("Prompt must contain between 1 and 8000 characters");
  }
  return postJson<AiChatResponse>("/api/ai/chat", { prompt: normalized });
}

/** Creates a short-lived R2 upload URL; the file remains in quarantine. */
export function createUploadPresign(file: File): Promise<UploadPresignResponse> {
  if (!file.size || file.size > 5 * 1024 * 1024) {
    throw new Error("File must be between 1 byte and 5 MiB");
  }
  if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type)) {
    throw new Error("Only PNG, JPEG and PDF files are accepted");
  }
  return postJson<UploadPresignResponse>("/api/files/presign", {
    contentType: file.type,
    size: file.size,
  });
}

/**
 * Worker-proxy upload: sends raw bytes, not multipart/form-data.
 * The Worker validates file signatures and queues the object for inspection.
 */
export async function uploadFileToQuarantine(file: File): Promise<QuarantineUploadResponse> {
  if (!file.size || file.size > 5 * 1024 * 1024) {
    throw new Error("File must be between 1 byte and 5 MiB");
  }
  const response = await fetch(apiUrl("/api/files/upload"), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    headers: {
      accept: "application/json",
      "content-type": "application/octet-stream",
    },
    body: file,
  });
  return parseResponse<QuarantineUploadResponse>(response);
}

/** Completes a presigned R2 upload and enqueues the object for quarantine inspection. */
export function completePresignedUpload(objectKey: string): Promise<QuarantineUploadResponse> {
  if (!objectKey.startsWith("quarantine/") || objectKey.includes("..")) {
    throw new Error("Invalid quarantine object key");
  }
  return postJson<QuarantineUploadResponse>("/api/files/complete", { objectKey });
}

/**
 * Optional direct-to-R2 flow. The signed URL is a short-lived capability:
 * never attach Cloudflare Access cookies or any other credentials to this request.
 * The R2 bucket must explicitly allow the site origin and required headers in CORS.
 */
export async function uploadFileViaPresignedUrl(file: File): Promise<QuarantineUploadResponse> {
  const session = await createUploadPresign(file);
  const signedUrl = new URL(session.uploadUrl);
  if (signedUrl.protocol !== "https:") throw new Error("R2 presigned URL must use HTTPS");

  const putResponse = await fetch(signedUrl, {
    method: session.method,
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: session.requiredHeaders,
    body: file,
  });
  if (!putResponse.ok) throw new Error(`R2 upload failed (HTTP ${putResponse.status})`);
  return completePresignedUpload(session.objectKey);
}
