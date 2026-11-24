import { mountQuestPulse } from "./questpulse.js";

const root = document.querySelector("[data-questpulse-app]");
if (root) {
  mountQuestPulse(root);

  const scope = root.getRootNode();
  const query = (selector) => scope.querySelector(selector);
  const menuButton = query("#qp-menu-toggle");
  const drawer = query("#qp-site-drawer");
  const backdrop = query("#qp-drawer-backdrop");
  const closeButton = query("#qp-drawer-close");

  function setDrawerOpen(open) {
    if (!menuButton || !drawer || !backdrop) return;
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
    backdrop.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) closeButton?.focus();
    else menuButton.focus();
  }

  menuButton?.addEventListener("click", () => setDrawerOpen(menuButton.getAttribute("aria-expanded") !== "true"));
  closeButton?.addEventListener("click", () => setDrawerOpen(false));
  backdrop?.addEventListener("click", () => setDrawerOpen(false));

  drawer?.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    const hash = link.getAttribute("href");
    if (hash?.startsWith("#")) {
      const target = scope.getElementById(hash.slice(1));
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", hash);
      }
    }
    setDrawerOpen(false);
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
    const fromRightEdge = swipeStart.x >= window.innerWidth - 28;
    const fromDrawer = swipeStart.open && swipeStart.x >= window.innerWidth - (drawer?.offsetWidth || 370);
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      if (!swipeStart.open && fromRightEdge && dx < 0) setDrawerOpen(true);
      else if (swipeStart.open && fromDrawer && dx > 0) setDrawerOpen(false);
    }
    swipeStart = null;
  }, { passive: true });

  // Shadow-root scoped spotlight tracking; delegated for dynamically rendered cards.
  scope.addEventListener("pointermove", (event) => {
    if (!(event.target instanceof Element)) return;
    const element = event.target.closest(".spotlight");
    if (!element) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    element.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }, { passive: true });

}
