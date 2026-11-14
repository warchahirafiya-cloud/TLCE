(() => {
  const status = document.querySelector("[data-runtime-status]");
  const details = document.querySelector("#agent-details");
  const floatButton = document.querySelector("[data-agent-float]");
  const openButton = document.querySelector("[data-agent-open]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setAgentPanel = (open) => {
    if (!details || !floatButton) return;
    details.hidden = !open;
    floatButton.setAttribute("aria-expanded", String(open));
    if (open) details.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  };
  floatButton?.addEventListener("click", () => {
    setAgentPanel(floatButton.getAttribute("aria-expanded") !== "true");
  });
  openButton?.addEventListener("click", () => setAgentPanel(true));

  // Pointer dragging lets the launcher glide to a convenient position without blocking page scrolling.
  if (floatButton && window.PointerEvent) {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let dragged = false;

    floatButton.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      const rect = floatButton.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      dragged = false;
      floatButton.setPointerCapture(pointerId);
    });
    floatButton.addEventListener("pointermove", (event) => {
      if (pointerId !== event.pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!dragged && Math.hypot(dx, dy) < 7) return;
      dragged = true;
      const x = Math.max(8, Math.min(window.innerWidth - floatButton.offsetWidth - 8, originX + dx));
      const y = Math.max(8, Math.min(window.innerHeight - floatButton.offsetHeight - 8, originY + dy));
      floatButton.style.left = x + "px";
      floatButton.style.top = y + "px";
      floatButton.style.right = "auto";
      floatButton.style.bottom = "auto";
      floatButton.style.animation = "none";
    });
    const finishDrag = (event) => {
      if (pointerId !== event.pointerId) return;
      if (dragged) {
        const rect = floatButton.getBoundingClientRect();
        const dockLeft = rect.left + rect.width / 2 < window.innerWidth / 2;
        floatButton.style.left = dockLeft ? "8px" : "auto";
        floatButton.style.right = dockLeft ? "auto" : "8px";
      }
      pointerId = null;
      if (floatButton.hasPointerCapture(event.pointerId)) floatButton.releasePointerCapture(event.pointerId);
    };
    floatButton.addEventListener("pointerup", finishDrag);
    floatButton.addEventListener("pointercancel", finishDrag);
    window.addEventListener("resize", () => {
      if (floatButton.style.left) {
        const x = Math.max(8, Math.min(window.innerWidth - floatButton.offsetWidth - 8, floatButton.getBoundingClientRect().left));
        floatButton.style.left = x + "px";
      }
    });
  }

  if (!("serviceWorker" in navigator)) {
    if (status) status.textContent = "Offline installation is not supported by this browser.";
    return;
  }
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      if (status) status.textContent = "Web app shell ready. Backend services are not connected yet.";
    } catch {
      if (status) status.textContent = "Offline support could not be initialized.";
    }
  });
})();
