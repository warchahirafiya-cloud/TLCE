import { registerIsland, mountIsland, mountRegisteredIslands, unmountIsland } from "./registry";
import { RuntimeBadge } from "./components/RuntimeBadge";
import { SecureUploadIsland } from "./components/SecureUploadIsland";
import { AIChatIsland } from "./components/AIChatIsland";

registerIsland("runtime-badge", RuntimeBadge);
registerIsland("secure-upload", SecureUploadIsland);
registerIsland("ai-chat", AIChatIsland);

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
