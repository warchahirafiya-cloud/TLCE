const APPROVED_PLATFORMS = new Set(["web", "android", "tool"]);
const APPROVED_CATEGORIES = new Set(["productivity", "ai", "developer", "learning", "utilities"]);

export function isApprovedStoreItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  if (item.status !== "published" || item.reviewStatus !== "approved" || item.developerApproved !== true) return false;
  if (typeof item.id !== "string" || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(item.id)) return false;
  if (typeof item.name !== "string" || !item.name.trim()) return false;
  if (typeof item.description !== "string" || !item.description.trim()) return false;
  if (!APPROVED_PLATFORMS.has(item.platform) || !APPROVED_CATEGORIES.has(item.category)) return false;
  if (typeof item.developerName !== "string" || !item.developerName.trim()) return false;
  if (typeof item.version !== "string" || !/^\\d+\\.\\d+\\.\\d+$/.test(item.version)) return false;
  if (item.platform === "web") {
    if (typeof item.launchPath !== "string" || !item.launchPath.startsWith("../") || item.launchPath.startsWith("//")) return false;
  } else {
    // Android binaries and external tools remain disabled until the signed distribution pipeline exists.
    if (item.downloadUrl || item.packageUrl || item.launchPath) return false;
  }
  return true;
}

export function filterApprovedApps(items, filters = {}) {
  if (!Array.isArray(items)) return [];
  const needle = String(filters.search ?? "").trim().toLocaleLowerCase();
  return items.filter((item) => {
    if (!isApprovedStoreItem(item)) return false;
    if (filters.platform && item.platform !== filters.platform) return false;
    if (filters.category && item.category !== filters.category) return false;
    const haystack = [item.name, item.description, item.developerName].join(" ").toLocaleLowerCase();
    return !needle || haystack.includes(needle);
  });
}

export function escapeStoreText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}