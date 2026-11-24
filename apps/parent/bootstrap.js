import { createTLCEApplicationRouter, createTLCEHost } from "./runtime/engine/src/index.js";

const root = document.querySelector("#tlce-module-root");
const status = document.querySelector("#runtime-status");

const PARENT_HOME_MARKUP = "<div class=\"parent-home\" data-parent-home>\n  <section class=\"home-shell\" aria-labelledby=\"home-title\">\n    <div class=\"home-copy\">\n      <p class=\"eyebrow\"><span></span> THE LAST COSMIC EXPLOSION · DIGITAL ECOSYSTEM</p>\n      <h1 id=\"home-title\">منظومة رقمية واحدة.<br><span>آفاق بلا حدود.</span></h1>\n      <p class=\"home-lead\">مساحة رقمية تجمع منتجات ووحدات مستقلة ضمن تجربة موحّدة. استكشف المعرفة والفرص والأدوات، وانتقل بين خدمات المنظومة بسلاسة ووضوح.</p>\n      <div class=\"home-actions\">\n        <a class=\"primary-action\" href=\"./questpulse\" data-route=\"/questpulse\">اكتشف QuestPulse <span aria-hidden=\"true\">←</span></a>\n        <a class=\"text-action\" href=\"./store/\">تصفّح المتجر <span aria-hidden=\"true\">↗</span></a>\n      </div>\n      <div class=\"home-caption\"><span class=\"caption-line\"></span> منصة أم · وحدات مترابطة · تجربة واضحة</div>\n    </div>\n    <div class=\"ecosystem-visual\" aria-hidden=\"true\">\n      <div class=\"visual-top\"><span>TLCE / ECOSYSTEM MAP</span><span class=\"visual-status\">SYSTEM READY</span></div>\n      <div class=\"visual-core\"><span class=\"core-ring\"></span><span class=\"core-monogram\">TLCE</span><small>THE PARENT PLATFORM</small></div>\n      <div class=\"visual-branch\"><span class=\"branch-line\"></span><span class=\"branch-node\">QP</span><span class=\"branch-copy\"><b>QuestPulse</b><small>DISCOVER · VERIFY · LEARN</small></span><span class=\"branch-state\">MODULE</span></div>\n      <div class=\"visual-bottom\"><span>MODULAR BY DESIGN</span><span>01 / 02</span></div>\n    </div>\n  </section>\n  <section class=\"principles\" aria-label=\"مبادئ المنظومة\">\n    <article><span class=\"principle-number\">01</span><div><b>تجربة موحّدة</b><small>تنقل واضح بين المنتجات</small></div></article>\n    <article><span class=\"principle-number\">02</span><div><b>بنية معيارية</b><small>كل وحدة تعمل ضمن حدودها</small></div></article>\n    <article><span class=\"principle-number\">03</span><div><b>الثقة أولاً</b><small>وضوح في الحالة والمعلومات</small></div></article>\n  </section>\n  <section class=\"modules-section\" aria-labelledby=\"modules-title\">\n    <div class=\"section-intro\">\n      <div><p class=\"eyebrow\"><span></span> EXPLORE THE ECOSYSTEM</p><h2 id=\"modules-title\">ابدأ من وجهتك التالية</h2></div>\n      <p>اختر الوحدة المناسبة. كل منتج يحتفظ بوظيفته وتجربته، مع هوية بصرية متناسقة داخل TLCE.</p>\n    </div>\n    <div class=\"module-grid\">\n      <a class=\"module-card\" href=\"./questpulse\" data-route=\"/questpulse\">\n        <span class=\"module-icon\">QP</span><span class=\"module-info\"><small>DISCOVER · VERIFY · LEARN</small><b>QuestPulse</b><span>اكتشف الفرص الرقمية، وتعلّم التحقق من المصادر والشروط قبل المشاركة.</span></span><span class=\"module-arrow\" aria-hidden=\"true\">←</span>\n      </a>\n      <a class=\"module-card\" href=\"./store/\">\n        <span class=\"module-icon\">S</span><span class=\"module-info\"><small>OFFICIAL APP DIRECTORY</small><b>TLCE STORE</b><span>استكشف التطبيقات والأدوات الرقمية المعتمدة ومعلومات المطورين.</span></span><span class=\"module-arrow\" aria-hidden=\"true\">↗</span>\n      </a>\n    </div>\n  </section>\n  <section class=\"closing-panel\" aria-labelledby=\"closing-title\">\n    <div><p class=\"eyebrow\"><span></span> BUILT TO CONNECT</p><h2 id=\"closing-title\">كل شيء يبدأ من نقطة واحدة.</h2><p>استكشف المنظومة وتعرّف على وحداتها وخدماتها المتاحة.</p></div>\n    <a class=\"primary-action\" href=\"./questpulse\" data-route=\"/questpulse\">ابدأ الاستكشاف <span aria-hidden=\"true\">←</span></a>\n  </section>\n</div>";

function renderParentHome() {
  root.innerHTML = PARENT_HOME_MARKUP;
}

if (!root || !status) throw new Error("TLCE parent shell is missing its runtime mount points");


const menuButton = document.querySelector("#menu-toggle");
const drawer = document.querySelector("#site-drawer");
const backdrop = document.querySelector("#drawer-backdrop");
const closeButton = document.querySelector("#drawer-close");

function setDrawerOpen(open) {
  if (!menuButton || !drawer || !backdrop) return;
  drawer.classList.toggle("is-open", open);
  drawer.setAttribute("aria-hidden", String(!open));
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
  backdrop.hidden = !open;
  document.body.classList.toggle("drawer-open", open);
  if (open) closeButton?.focus();
  else menuButton.focus();
}
menuButton?.addEventListener("click", () => setDrawerOpen(menuButton.getAttribute("aria-expanded") !== "true"));
closeButton?.addEventListener("click", () => setDrawerOpen(false));
backdrop?.addEventListener("click", () => setDrawerOpen(false));
drawer?.addEventListener("click", (event) => {
  if (event.target.closest("a")) setDrawerOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuButton?.getAttribute("aria-expanded") === "true") setDrawerOpen(false);
});

let swipeStart = null;
document.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") return;
  swipeStart = { x: event.clientX, y: event.clientY, open: menuButton?.getAttribute("aria-expanded") === "true" };
}, { passive: true });
document.addEventListener("pointerup", (event) => {
  if (!swipeStart || event.pointerType === "mouse") return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  const edgeStart = swipeStart.x >= window.innerWidth - 28;
  const startedInDrawer = swipeStart.open && swipeStart.x >= window.innerWidth - (drawer?.offsetWidth || 370);
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.25) {
    if (!swipeStart.open && edgeStart && dx < 0) setDrawerOpen(true);
    else if (swipeStart.open && startedInDrawer && dx > 0) setDrawerOpen(false);
  }
  swipeStart = null;
}, { passive: true });

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
      renderParentHome();
      status.textContent = "المنظومة الرئيسية جاهزة";
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
  const sectionHash = link.getAttribute("data-hash");
  setDrawerOpen(false);
  router.navigate(link.getAttribute("data-route")).then(() => {
    if (sectionHash) {
      const sectionId = sectionHash.slice(1);
      let section = root.querySelector(`[id="${sectionId}"]`);
      if (!section) {
        for (const node of root.querySelectorAll("*")) {
          if (node.shadowRoot) {
            section = node.shadowRoot.querySelector(`[id="${sectionId}"]`);
            if (section) break;
          }
        }
      }
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.location.hash = sectionHash;
    }
  }).catch((error) => {
    console.error("TLCE navigation failed", error);
    status.textContent = "تعذر التنقل";
  });
});

router.start().catch(() => {
  status.textContent = "فشل تشغيل محرك TLCE";
});


// Delegate spotlight coordinates without per-element listeners (CSP-safe).
document.addEventListener("pointermove", (event) => {
  if (!(event.target instanceof Element)) return;
  const element = event.target.closest(".spotlight");
  if (!element) return;
  const rect = element.getBoundingClientRect();
  element.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  element.style.setProperty("--my", `${event.clientY - rect.top}px`);
}, { passive: true });
