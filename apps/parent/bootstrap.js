import { createTLCEApplicationRouter, createTLCEHost } from "./runtime/engine/src/index.js";

const root = document.querySelector("#tlce-module-root");
const status = document.querySelector("#runtime-status");

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
      root.replaceChildren();
      status.textContent = "مساحة النشر جاهزة";
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
    if (sectionHash) window.location.hash = sectionHash;
  }).catch((error) => {
    console.error("TLCE navigation failed", error);
    status.textContent = "تعذر التنقل";
  });
});

router.start().catch(() => {
  status.textContent = "فشل تشغيل محرك TLCE";
});
