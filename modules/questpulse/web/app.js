const connectionStatus = document.querySelector("#connection-status");
const installButton = document.querySelector("#install-button");
let installPrompt;

function updateConnectionStatus() {
  connectionStatus.textContent = navigator.onLine
    ? "Online · app shell available offline"
    : "Offline · cached app shell";
}
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = undefined;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installPrompt = undefined;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
      .catch(() => {
        connectionStatus.textContent = navigator.onLine
          ? "Online · offline support could not be enabled"
          : "Offline · service worker is not yet available";
      });
  });
}
