import { registerIsland, mountIsland, mountRegisteredIslands, unmountIsland } from "./registry";
import { RuntimeBadge } from "./components/RuntimeBadge";

registerIsland("runtime-badge", RuntimeBadge);

const bridge = Object.freeze({
  mount: mountIsland,
  mountAll: mountRegisteredIslands,
  unmount: unmountIsland,
});

window.TLCEIslands = bridge;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => mountRegisteredIslands(), { once: true });
} else {
  mountRegisteredIslands();
}
