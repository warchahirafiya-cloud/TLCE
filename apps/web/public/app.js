(() => {
  const status = document.querySelector("[data-runtime-status]");
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
