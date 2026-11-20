import { createTLCEApplicationRouter, createTLCEHost } from "./runtime/engine/src/index.js";

const root = document.querySelector("#tlce-module-root");
const status = document.querySelector("#runtime-status");

if (!root || !status) {
  throw new Error("TLCE parent shell is missing its runtime mount points");
}

const services = {
  async request() {
    throw new Error("No QuestPulse backend capabilities are enabled");
  },
  publish() {
    throw new Error("No QuestPulse event capabilities are enabled");
  },
  subscribe() {
    throw new Error("No QuestPulse event capabilities are enabled");
  },
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
      root.innerHTML = '<div class="welcome"><p class="eyebrow">MODULAR APPLICATION ECOSYSTEM</p><h1>منصة واحدة.<br><span>وحدات مترابطة.</span></h1><p>هذه هي المنصة الأم The Last Cosmic Explosion. تعمل الوحدات الداخلية من خلال محرك التشغيل وموجّه التطبيق المركزي.</p><a class="launch-link" href="./questpulse" data-route="/questpulse">فتح QuestPulse <span aria-hidden="true">←</span></a></div>';
      status.textContent = "المحرك جاهز";
      return;
    }
    root.innerHTML = '<div class="welcome"><p class="eyebrow">404 · ROUTE NOT FOUND</p><h1>المسار غير موجود</h1><p>لم يتم تسجيل هذه الوحدة داخل TLCE.</p><a class="launch-link" href="./" data-route="/">العودة للرئيسية</a></div>';
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
