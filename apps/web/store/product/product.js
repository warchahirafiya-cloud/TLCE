import { filterApprovedApps, isSafeStoreLaunchPath, escapeStoreText } from "../catalogue.mjs";

const status = document.querySelector("#product-status");
const content = document.querySelector("#product-content");
const params = new URLSearchParams(window.location.search);
const productId = params.get("id") || "";

const labels = {
  web: "تطبيق ويب",
  android: "تطبيق Android",
  tool: "أداة رقمية",
  productivity: "الإنتاجية",
  ai: "الذكاء الاصطناعي",
  developer: "للمطورين",
  learning: "التعليم",
  utilities: "أدوات عامة"
};

function showUnavailable(message) {
  status.textContent = "المنتج غير متاح";
  content.setAttribute("aria-busy", "false");
  content.innerHTML = `<section class="empty"><h2>لم نعثر على المنتج</h2><p>${escapeStoreText(message)}</p><a class="primary" href="../index.html">العودة إلى المتجر</a></section>`;
}

function renderProduct(product) {
  const launch = product.platform === "web" && isSafeStoreLaunchPath(product.launchPath)
    ? `<a class="primary" href="../../${escapeStoreText(product.launchPath.slice(3))}">فتح التطبيق</a>`
    : '<span class="secondary" aria-disabled="true">التشغيل أو التنزيل غير متاح حالياً</span>';
  status.textContent = "منتج معتمد";
  content.setAttribute("aria-busy", "false");
  content.innerHTML = `<article class="product-detail">
    <div class="product-detail-head">
      <div class="app-icon product-icon" aria-hidden="true">${escapeStoreText(product.icon || "✦")}</div>
      <div><span class="pill">${labels[product.platform]}</span><h1>${escapeStoreText(product.name)}</h1><p>${escapeStoreText(product.description)}</p></div>
    </div>
    <div class="product-facts">
      <div><span>المطوّر</span><strong>${escapeStoreText(product.developerName)}</strong></div>
      <div><span>الإصدار</span><strong>${escapeStoreText(product.version)}</strong></div>
      <div><span>المنصة</span><strong>${labels[product.platform]}</strong></div>
      <div><span>التصنيف</span><strong>${labels[product.category]}</strong></div>
      <div><span>حالة المراجعة</span><strong>معتمد للنشر</strong></div>
    </div>
    <div class="product-actions">${launch}<a class="secondary" href="../index.html">استكشاف منتجات أخرى</a></div>
    <p class="product-disclaimer">تعرض هذه الصفحة بيانات الكتالوج المنشور فقط. لا يعني اعتماد صفحة المنتج أن كل إصدار مستقبلي معتمد تلقائياً.</p>
  </article>`;
}

if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(productId)) {
  showUnavailable("معرّف المنتج غير صالح أو غير موجود.");
} else {
  fetch("../data/apps.json", { headers: { Accept: "application/json" }, cache: "no-store" })
    .then((response) => { if (!response.ok) throw new Error("catalogue unavailable"); return response.json(); })
    .then((data) => {
      const product = filterApprovedApps(data).find((item) => item.id === productId);
      if (!product) throw new Error("product not published");
      renderProduct(product);
    })
    .catch(() => showUnavailable("هذا المنتج غير منشور حالياً أو تعذر تحميل بياناته."));
}