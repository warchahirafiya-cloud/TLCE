const MAX_VERIFICATION_AGE_DAYS = 30;
const ALLOWED_CATEGORIES = new Set(["reward", "store", "discount", "contest", "loyalty", "task", "referral"]);

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isFreshDate(value, now, maxAgeDays = MAX_VERIFICATION_AGE_DAYS) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime()) || date > now) return false;
  return now.getTime() - date.getTime() <= maxAgeDays * 86400000;
}

export function isPublicOffer(offer, now = new Date()) {
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) return false;
  if (offer.status !== "published") return false;
  if (typeof offer.title !== "string" || !offer.title.trim()) return false;
  if (!isHttpsUrl(offer.url)) return false;
  if (!ALLOWED_CATEGORIES.has(offer.category)) return false;
  if (!Array.isArray(offer.countries) || offer.countries.length === 0) return false;
  if (!offer.termsUrl || !isHttpsUrl(offer.termsUrl)) return false;
  if (typeof offer.fees !== "string" || !offer.fees.trim()) return false;
  if (typeof offer.eligibility !== "string" || !offer.eligibility.trim()) return false;
  if (!isFreshDate(offer.verifiedAt, now)) return false;
  if (offer.expiresAt) {
    const expiry = new Date(offer.expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry < now) return false;
  }
  return true;
}

export function filterPublicOffers(offers, filters = {}, now = new Date()) {
  if (!Array.isArray(offers)) return [];
  const needle = String(filters.search ?? "").trim().toLocaleLowerCase();
  const country = String(filters.country ?? "").trim().toLocaleLowerCase();
  return offers.filter((offer) => {
    if (!isPublicOffer(offer, now)) return false;
    const searchable = [offer.title, offer.store, offer.description]
      .filter(Boolean).join(" ").toLocaleLowerCase();
    if (needle && !searchable.includes(needle)) return false;
    if (filters.category && offer.category !== filters.category) return false;
    if (country) {
      const countries = offer.countries.map((item) => String(item).toLocaleLowerCase());
      if (!offer.global && !countries.some((item) => item.includes(country))) return false;
    }
    return true;
  });
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
