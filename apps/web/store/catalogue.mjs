const APPROVED_PLATFORMS = new Set(["web", "android", "tool"]);
const APPROVED_CATEGORIES = new Set(["productivity", "ai", "developer", "learning", "utilities"]);

// Store links must resolve to a simple HTML entry point inside the parent apps/web tree.
// Only one leading ../ segment is allowed; traversal, protocol URLs, encoded paths and backslashes are rejected.
export function isSafeStoreLaunchPath(value) {
  return typeof value === "string"
    && /^\.\.\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.html?$/.test(value);
}

export function isApprovedStoreItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  if (item.status !== "published" || item.reviewStatus !== "approved" || item.developerApproved !== true) return false;
  if (typeof item.id !== "string" || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(item.id)) return false;
  if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 100) return false;
  if (typeof item.description !== "string" || !item.description.trim() || item.description.length > 2000) return false;
  if (!APPROVED_PLATFORMS.has(item.platform) || !APPROVED_CATEGORIES.has(item.category)) return false;
  if (typeof item.developerName !== "string" || !item.developerName.trim() || item.developerName.length > 120) return false;
  if (typeof item.version !== "string" || !/^\d+\.\d+\.\d+$/.test(item.version)) return false;
  if (item.platform === "web") {
    if (!isSafeStoreLaunchPath(item.launchPath)) return false;
  } else {
    // Android binaries and external tools remain disabled until the signed distribution pipeline exists.
    if (item.downloadUrl || item.packageUrl || item.launchPath) return false;
  }
  return true;
}

export function filterApprovedApps(items, filters = {}) {
  if (!Array.isArray(items)) return [];
  const needle = String(filters.search ?? "").trim().toLocaleLowerCase();
  const seen = new Set();
  return items.filter((item) => {
    if (!isApprovedStoreItem(item) || seen.has(item.id)) return false;
    if (filters.platform && item.platform !== filters.platform) return false;
    if (filters.category && item.category !== filters.category) return false;
    const haystack = [item.name, item.description, item.developerName].join(" ").toLocaleLowerCase();
    if (needle && !haystack.includes(needle)) return false;
    seen.add(item.id);
    return true;
  });
}

export function escapeStoreText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}