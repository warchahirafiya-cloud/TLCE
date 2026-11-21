import { createTLCEApplicationRouter, createTLCEHost } from "./runtime/engine/src/index.js";

const root = document.querySelector("#tlce-module-root");
const status = document.querySelector("#runtime-status");

if (!root || !status) throw new Error("TLCE parent shell is missing its runtime mount points");

const homeMarkup = `
  <div class="home-shell">
    <div class="home-copy">
      <p class="eyebrow"><span></span> THE LAST COSMIC EXPLOSION</p>
      <h1>منظومة رقمية.<br><span>رؤية واحدة.</span></h1>
      <p class="home-lead">نبني بيئة رقمية مترابطة تجمع المنتجات والوحدات المتخصصة ضمن بنية موحدة، قابلة للتوسع ومصممة لتقديم تجربة واضحة وموثوقة.</p>
      <div class="home-actions"><a class="primary-action" href="./questpulse" data-route="/questpulse">استكشف QuestPulse <span aria-hidden="true">←</span></a><a class="text-action" href="./store/">زيارة المتجر <span aria-hidden="true">↗</span></a></div>
      <div class="home-caption"><span class="caption-line"></span> منصة أم · وحدات مستقلة · تجربة متكاملة</div>
    </div>
    <aside class="ecosystem-visual" aria-label="بنية منظومة TLCE">
      <div class="visual-top"><span>ECOSYSTEM / 001</span><span class="visual-status">● ACTIVE DESIGN</span></div>
      <div class="visual-core"><span class="core-ring"></span><span class="core-monogram">TLCE</span><small>THE PARENT PLATFORM</small></div>
      <div class="visual-branch"><span class="branch-line"></span><span class="branch-node">QP</span><span class="branch-copy"><b>QuestPulse</b><small>DISCOVERY &amp; LEARNING</small></span><span class="branch-state">INTERNAL MODULE</span></div>
      <div class="visual-bottom"><span>MODULAR ARCHITECTURE</span><span>01 / 01</span></div>
    </aside>
  </div>
  <section class="principles" aria-label="مبادئ المنظومة">
    <article><span class="principle-number">01</span><div><b>بنية موحدة</b><small>منصة أم تدير الوحدات المترابطة</small></div></article>
    <article><span class="principle-number">02</span><div><b>تصميم معياري</b><small>كل وحدة تؤدي دوراً محدداً</small></div></article>
    <article><span class="principle-number">03</span><div><b>توسع مدروس</b><small>قابلية نمو دون فقدان الاتساق</small></div></article>
  </section>
  <section class="modules-section" aria-labelledby="modules-title">
    <div class="section-intro"><div><p class="eyebrow">THE ECOSYSTEM</p><h2 id="modules-title">وحدات المنظومة</h2></div><p>تجربة مترابطة، مع الحفاظ على هوية ووظيفة كل منتج.</p></div>
    <a class="module-card" href="./questpulse" data-route="/questpulse"><span class="module-icon">QP</span><span class="module-info"><small>INTERNAL PRODUCT MODULE</small><b>QuestPulse</b><span>اكتشاف الفرص الرقمية، التحقق من مصادرها، والتعلّم عبر أدلة منظمة.</span></span><span class="module-arrow" aria-hidden="true">↗</span></a>
  </section>
  <section class="closing-panel"><div><p class="eyebrow">BUILT AS ONE ECOSYSTEM</p><h2>ابدأ من الوحدة المناسبة.</h2><p>استكشف QuestPulse وتعرّف على إحدى وحدات TLCE الداخلية.</p></div><a class="primary-action" href="./questpulse" data-route="/questpulse">فتح QuestPulse <span aria-hidden="true">←</span></a></section>
`;

const services = {
  async request() { throw new Error("No QuestPulse backend capabilities are enabled"); },
  publish() { throw new Error("No QuestPulse event capabilities are enabled"); },
  subscribe() { throw new Error("No QuestPulse event capabilities are enabled"); },
};

const host = createTLCEHost({
  services,
  frontendBaseUrl: new URL("./web/", import.meta.url).href,
});

const router = createTLCEApplicationRouter({
  host,
  root,
  basePath: new URL(".", import.meta.url).pathname.replace(/\/$/, ""),
  onNotFound(pathname) {
    if (pathname === "/") {
      root.innerHTML = homeMarkup;
      status.textContent = "المحرك جاهز";
      return;
    }
    root.innerHTML = '<div class="welcome"><p class="eyebrow"><span></span> 404 · ROUTE NOT FOUND</p><h1>المسار غير موجود</h1><p>لم يتم تسجيل هذه الوحدة داخل TLCE.</p><a class="launch-link" href="./" data-route="/">العودة للرئيسية</a></div>';
    status.textContent = "المسار غير مسجل";
  },
  onError(error) {
    console.error("TLCE route error", error);
    root.textContent = "تعذر تشغيل الوحدة. لم يتم منح أي صلاحيات إضافية.";
    status.textContent = "خطأ في تشغيل الوحدة";
  },
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest("a[data-route]");
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  router.navigate(link.getAttribute("data-route")).catch((error) => {
    console.error("TLCE navigation failed", error);
    status.textContent = "تعذر التنقل";
  });
});

router.start().catch(() => {
  status.textContent = "فشل تشغيل محرك TLCE";
});
