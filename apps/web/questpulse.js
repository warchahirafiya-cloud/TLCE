import { escapeHtml, filterPublicOffers } from "./questpulse-catalogue.mjs";

const list = document.querySelector("#offer-list");
const count = document.querySelector("#result-count");
const status = document.querySelector("#catalogue-status");
const form = document.querySelector("#offer-filters");

function render(offers) {
  const visible = filterPublicOffers(offers, {
    search: document.querySelector("#search").value,
    country: document.querySelector("#country").value,
    category: document.querySelector("#category").value
  });
  count.textContent = visible.length === 1 ? "فرصة واحدة موثقة" : `${visible.length} فرص موثقة`;
  list.setAttribute("aria-busy", "false");
  if (visible.length === 0) {
    list.innerHTML = '<div class="empty-state"><h3>لا توجد عروض منشورة حالياً</h3><p>هذا مقصود: لا نعرض بيانات تجريبية أو فرصاً لم تجتز التحقق. عُد لاحقاً للاطلاع على العناصر المعتمدة.</p></div>';
    return;
  }
  list.innerHTML = visible.map((offer) => {
    const countries = offer.global ? "عالمي" : offer.countries.join("، ");
    return `<article class="offer-card">
      <div class="offer-tags"><span>${escapeHtml(offer.category)}</span><span>${escapeHtml(countries)}</span></div>
      <h3>${escapeHtml(offer.title)}</h3>
      <p>${escapeHtml(offer.description || "")}</p>
      <p>الأهلية: ${escapeHtml(offer.eligibility)}</p>
      <p>الرسوم: ${escapeHtml(offer.fees)}</p>
      <p>آخر تحقق: ${escapeHtml(offer.verifiedAt)}</p>
      <a href="${escapeHtml(offer.url)}" target="_blank" rel="noopener noreferrer">المصدر الرسمي ↗</a>
    </article>`;
  }).join("");
}

let catalogue = [];
form.addEventListener("submit", (event) => {
  event.preventDefault();
  render(catalogue);
});
form.addEventListener("reset", () => queueMicrotask(() => render(catalogue)));

fetch("./data/offers.json", { headers: { Accept: "application/json" }, cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error("Catalogue request failed");
    return response.json();
  })
  .then((data) => {
    catalogue = Array.isArray(data) ? data : [];
    status.textContent = "الدليل جاهز";
    render(catalogue);
  })
  .catch(() => {
    status.textContent = "تعذر تحميل الدليل";
    count.textContent = "لا تتوفر بيانات حالياً";
    list.setAttribute("aria-busy", "false");
    list.innerHTML = '<div class="empty-state"><h3>تعذر تحميل الدليل</h3><p>لم يتم تحميل قائمة العروض. حاول تحديث الصفحة لاحقاً.</p></div>';
  });
