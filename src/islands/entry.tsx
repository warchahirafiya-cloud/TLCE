import { registerIsland, mountIsland, mountRegisteredIslands, unmountIsland } from "./registry";

// Each island owns a separate async chunk. Its component code is fetched only
// after its host approaches the viewport (or an explicit mount() call is made).
registerIsland("runtime-badge", () =>
  import("./components/RuntimeBadge").then((module) => module.RuntimeBadge)
);
registerIsland("secure-upload", () =>
  import("./components/SecureUploadIsland").then((module) => module.SecureUploadIsland)
);
registerIsland("ai-chat", () =>
  import("./components/AIChatIsland").then((module) => module.AIChatIsland)
);

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
