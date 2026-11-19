import { filterApprovedApps, escapeStoreText } from "./catalogue.mjs";

const $ = (selector) => document.querySelector(selector);
const list = $("#app-list");
const status = $("#catalogue-status");
const count = $("#result-count");
let apps = [];

function render() {
  const visible = filterApprovedApps(apps, {
    search: $("#search").value,
    platform: $("#platform").value,
    category: $("#category").value
  });
  count.textContent = `${visible.length} منتجات معتمدة`;
  list.setAttribute("aria-busy", "false");
  if (!visible.length) {
    list.innerHTML = '<div class="empty"><h3>لا توجد منتجات منشورة في هذا التصنيف حالياً</h3><p>نضيف المنتجات بعد اكتمال المراجعة. لن نعرض عناصر تجريبية على أنها تطبيقات جاهزة.</p></div>';
    return;
  }
  list.innerHTML = visible.map((app) => {
    const launch = app.platform === "web" && isSafeLocalPath(app.launchPath)
      ? `<a class="launch" href="${escapeStoreText(app.launchPath)}">فتح التطبيق ←</a>`
      : '<span class="launch" aria-label="التنزيل غير متاح">التنزيل غير متاح حالياً</span>';
    return `<article class="app-card">
      <div class="app-top"><span class="app-icon" aria-hidden="true">${escapeStoreText(app.icon || "✦")}</span><span class="pill">${platformLabel(app.platform)}</span></div>
      <h3>${escapeStoreText(app.name)}</h3><p>${escapeStoreText(app.description)}</p>
      <div class="app-meta"><span>${escapeStoreText(app.developerName)}</span><span>·</span><span>الإصدار ${escapeStoreText(app.version)}</span></div>
      ${launch}
    </article>`;
  }).join("");
}

function isSafeLocalPath(value) {
  return typeof value === "string" && value.startsWith("../") && !value.startsWith("//") && !/[\\\\]/.test(value);
}
function platformLabel(platform) {
  return ({ web: "تطبيق ويب", android: "Android", tool: "أداة رقمية" })[platform] || "منتج رقمي";
}

for (const selector of ["#search", "#platform", "#category"]) {
  $(selector).addEventListener(selector === "#search" ? "input" : "change", render);
}
$("#reset").addEventListener("click", () => {
  $("#search").value = "";
  $("#platform").value = "";
  $("#category").value = "";
  render();
});

fetch("./data/apps.json", { headers: { Accept: "application/json" }, cache: "no-store" })
  .then((response) => { if (!response.ok) throw new Error("catalogue unavailable"); return response.json(); })
  .then((data) => {
    apps = Array.isArray(data) ? data : [];
    status.textContent = "الكتالوج متاح";
    render();
  })
  .catch(() => {
    status.textContent = "تعذر تحميل الكتالوج";
    list.setAttribute("aria-busy", "false");
    list.innerHTML = '<div class="empty"><h3>تعذر تحميل المتجر</h3><p>لم نعرض بيانات بديلة أو غير موثقة. أعد المحاولة لاحقاً.</p></div>';
  });