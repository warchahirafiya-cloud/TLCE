const encoder = new TextEncoder();
const AWS_REGION = "auto";
const SERVICE = "s3";

function bufferSource(bytes: Uint8Array): ArrayBuffer {\n  return new Uint8Array(bytes).buffer as ArrayBuffer;\n}\nfunction hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}
function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", bufferSource(encoder.encode(value)));
}
async function hmac(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey("raw", key instanceof Uint8Array ? bufferSource(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", imported, bufferSource(encoder.encode(value)));
}
async function signingKey(secret: string, date: string): Promise<ArrayBuffer> {
  const dateKey = await hmac(encoder.encode(`AWS4${secret}`), date);
  const regionKey = await hmac(dateKey, AWS_REGION);
  const serviceKey = await hmac(regionKey, SERVICE);
  return hmac(serviceKey, "aws4_request");
}
export async function createR2PresignedPut(input: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  contentType: string;
  ownerHash: string;
  expiresSeconds?: number;
}): Promise<string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const expires = Math.min(Math.max(input.expiresSeconds ?? 300, 60), 600);
  const host = `${input.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encode(input.bucket)}/${input.key.split("/").map(encode).join("/")}`;
  const scope = `${dateStamp}/${AWS_REGION}/${SERVICE}/aws4_request`;
  const params: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${input.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expires)],
    ["X-Amz-SignedHeaders", "content-type;host;x-amz-meta-ownerhash;x-amz-meta-status"],
  ];
  const canonicalQuery = params
    .map(([key, value]) => [encode(key), encode(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const canonicalHeaders = [
    `content-type:${input.contentType.trim()}\n`,
    `host:${host}\n`,
    `x-amz-meta-ownerhash:${input.ownerHash}\n`,
    "x-amz-meta-status:quarantined\n",
  ].join("");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "content-type;host;x-amz-meta-ownerhash;x-amz-meta-status",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    hex(await sha256(canonicalRequest)),
  ].join("\n");
  const key = await signingKey(input.secretAccessKey, dateStamp);
  const signature = hex(await hmac(key, stringToSign));
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
