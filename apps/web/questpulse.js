import { escapeHtml, filterPublicOffers } from "./questpulse-catalogue.mjs";

export function mountQuestPulse(root) {
  const $ = (selector) => root.querySelector(selector);
  const list = $("#offer-list");
  const count = $("#result-count");
  const status = $("#catalogue-status");
  const form = $("#offer-filters");
  const guideList = $("#guide-list");
  const savedCount = $("#saved-count");
  const savedToggle = $("#show-saved");
  const guideSearch = $("#guide-search");
  const storageKey = "tlce.questpulse.saved-guides.v1";
  const controller = new AbortController();
  const { signal } = controller;
  const view = root.ownerDocument.defaultView;

  for (const [name, element] of Object.entries({
    "offer-list": list,
    "result-count": count,
    "catalogue-status": status,
    "offer-filters": form,
    "guide-list": guideList,
    "saved-count": savedCount,
    "show-saved": savedToggle,
    "guide-search": guideSearch,
  })) {
    if (!element) throw new Error(`QuestPulse frontend is missing #${name}`);
  }

  function readSaved() {
    try {
      const value = JSON.parse(view?.localStorage.getItem(storageKey) || "[]");
      return new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
    } catch { return new Set(); }
  }

  let saved = readSaved();
  let catalogue = [];
  let guides = [];
  let savedOnly = false;

  function persistSaved() {
    try {
      view?.localStorage.setItem(storageKey, JSON.stringify([...saved]));
      return true;
    } catch {
      savedCount.textContent = "تعذر الحفظ";
      return false;
    }
  }

  function renderOffers() {
    const visible = filterPublicOffers(catalogue, {
      search: $("#search").value,
      country: $("#country").value,
      category: $("#category").value,
    });
    count.textContent = visible.length === 1 ? "فرصة واحدة منشورة" : `${visible.length} فرص منشورة`;
    list.setAttribute("aria-busy", "false");
    if (!visible.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">◎</span><h3>لا توجد عروض منشورة مستوفية للشروط</h3><p>لم نعثر على سجلات حديثة ومكتملة. جرّب تغيير عوامل البحث أو راجع مركز المعرفة.</p></div>';
      return;
    }
    list.innerHTML = visible.map((offer) => {
      const countries = offer.global ? "عالمي" : offer.countries.join("، ");
      return `<article class="offer-card"><div class="offer-tags"><span>${escapeHtml(offer.category)}</span><span>${escapeHtml(countries)}</span></div><h3>${escapeHtml(offer.title)}</h3><p>${escapeHtml(offer.description || "")}</p><p>الأهلية: ${escapeHtml(offer.eligibility)}</p><p>الرسوم: ${escapeHtml(offer.fees)}</p><p>آخر تحقق: ${escapeHtml(offer.verifiedAt)}</p><a href="${escapeHtml(offer.url)}" target="_blank" rel="noopener noreferrer">المصدر الرسمي ↗</a></article>`;
    }).join("");
  }

  function renderGuides() {
    const needle = (guideSearch.value || "").trim().toLocaleLowerCase();
    const visible = guides.filter((guide) => {
      const matchesText = !needle || [guide.title, guide.summary, ...(guide.tags || [])].join(" ").toLocaleLowerCase().includes(needle);
      return matchesText && (!savedOnly || saved.has(guide.id));
    });
    savedCount.textContent = `${saved.size} محفوظ`;
    guideList.innerHTML = visible.length ? visible.map((guide) => {
      const isSaved = saved.has(guide.id);
      return `<article class="guide-card"><div class="guide-card-top"><span class="guide-icon">${escapeHtml(guide.icon)}</span><button class="save-guide" type="button" data-guide-id="${escapeHtml(guide.id)}" aria-pressed="${isSaved}" aria-label="${isSaved ? "إزالة من المحفوظات" : "حفظ الدليل"}">${isSaved ? "★ محفوظ" : "☆ حفظ"}</button></div><p class="guide-kicker">${escapeHtml(guide.level)} · ${escapeHtml(guide.readTime)}</p><h3>${escapeHtml(guide.title)}</h3><p>${escapeHtml(guide.summary)}</p><ul>${guide.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul><div class="guide-tags">${guide.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div></article>`;
    }).join("") : '<div class="empty-state"><h3>لا توجد أدلة مطابقة</h3><p>غيّر عبارة البحث أو ألغِ خيار عرض المحفوظ فقط.</p></div>';
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); renderOffers(); }, { signal });
  form.addEventListener("reset", () => queueMicrotask(renderOffers), { signal });
  guideSearch.addEventListener("input", renderGuides, { signal });
  savedToggle.addEventListener("click", (event) => {
    savedOnly = !savedOnly;
    event.currentTarget.setAttribute("aria-pressed", String(savedOnly));
    event.currentTarget.textContent = savedOnly ? "عرض كل الأدلة" : "عرض المحفوظ فقط";
    renderGuides();
  }, { signal });
  guideList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-guide-id]");
    if (!button) return;
    const id = button.dataset.guideId;
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    persistSaved();
    renderGuides();
  }, { signal });

  const offersUrl = new URL("./data/offers.json", import.meta.url);
  const guidesUrl = new URL("./data/guides.json", import.meta.url);
  Promise.all([
    fetch(offersUrl, { headers: { Accept: "application/json" }, cache: "no-store", signal }).then((response) => {
      if (!response.ok) throw new Error("offers");
      return response.json();
    }),
    fetch(guidesUrl, { headers: { Accept: "application/json" }, cache: "no-cache", signal }).then((response) => {
      if (!response.ok) throw new Error("guides");
      return response.json();
    }),
  ]).then(([offerData, guideData]) => {
    if (signal.aborted) return;
    catalogue = Array.isArray(offerData) ? offerData : [];
    guides = Array.isArray(guideData) ? guideData : [];
    status.textContent = "الدليل جاهز";
    renderOffers();
    renderGuides();
  }).catch((error) => {
    if (signal.aborted || error?.name === "AbortError") return;
    status.textContent = "تعذر تحميل بعض البيانات";
    list.setAttribute("aria-busy", "false");
    list.innerHTML = '<div class="empty-state"><h3>تعذر تحميل لوحة الفرص</h3><p>حدّث الصفحة لاحقاً. لم يتم عرض بيانات غير متحقق منها.</p></div>';
    guideList.innerHTML = '<div class="empty-state"><h3>تعذر تحميل مركز المعرفة</h3><p>تحقق من اتصالك ثم أعد المحاولة.</p></div>';
  });

  return () => controller.abort();
}
