import { createTLCEHost } from "/assets/tlce/runtime/engine/src/questpulse-host.js";

const branchRoot = document.querySelector("[data-branch-root]");
const runtimeStatus = document.querySelector("[data-runtime-status]");

if (branchRoot) {
  // Q.P currently requests no capabilities. The parent facade deliberately
  // denies service/event calls until reviewed Core APIs are granted.
  const deniedServices = Object.freeze({
    async request() {
      throw new Error("QuestPulse has no approved parent API capabilities yet.");
    },
    publish() {
      throw new Error("QuestPulse has no approved event-publish capability yet.");
    },
    subscribe() {
      throw new Error("QuestPulse has no approved event-subscribe capability yet.");
    },
  });

  // One parent host instance owns the branch registries and RuntimeEngine.
  const host = createTLCEHost({ services: deniedServices });
  let transition = Promise.resolve();

  async function syncBranchRoute() {
    const route = window.location.hash.startsWith("#/")
      ? window.location.hash.slice(1)
      : "/";
    const branch = host.branchRegistry.resolveRoute(route);

    if (branch?.id === "questpulse") {
      branchRoot.hidden = false;
      if (!host.frontendHost.isMounted("questpulse")) {
        const requestId = window.crypto?.randomUUID?.()
          ?? `tlce-shell-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        await host.mount(branchRoot, requestId, new Set(), route);
      }
      if (runtimeStatus) runtimeStatus.textContent = "QuestPulse is mounted inside the TLCE host.";
      return;
    }

    if (host.frontendHost.isMounted("questpulse")) {
      await host.unmount();
    }
    branchRoot.hidden = true;
  }

  function queueRouteChange() {
    transition = transition
      .then(syncBranchRoute)
      .catch((error) => {
        branchRoot.hidden = false;
        branchRoot.textContent = "QuestPulse could not be mounted by the TLCE host. Please return to the platform home page.";
        if (runtimeStatus) runtimeStatus.textContent = "A product branch could not be mounted.";
        // Keep diagnostic details out of the public UI.
        void error;
      });
  }

  window.addEventListener("hashchange", queueRouteChange);
  queueRouteChange();
}
