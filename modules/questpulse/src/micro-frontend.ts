import type {
  MicroFrontendModule,
  MicroFrontendMountOptions,
} from "../../../packages/contracts/src/micro-frontend.js";
import { questPulseMicroFrontendManifest } from "./micro-frontend-manifest.js";

/** Minimal in-process adapter proving the Q.P-to-host mount contract, not the full Q.P UI. */
export const questPulseMicroFrontend: MicroFrontendModule = {
  async mount({ root, context, route }: MicroFrontendMountOptions) {
    if (context.frontendId !== questPulseMicroFrontendManifest.id ||
        context.frontendVersion !== questPulseMicroFrontendManifest.version) {
      throw new Error("QuestPulse received an invalid TLCE host context");
    }
    if (route !== questPulseMicroFrontendManifest.route &&
        !route.startsWith(questPulseMicroFrontendManifest.route + "/")) {
      throw new Error("QuestPulse cannot mount outside its registered route");
    }

    const section = root.ownerDocument.createElement("section");
    section.className = "tlce-branch tlce-branch--questpulse";
    section.setAttribute("data-tlce-branch", "questpulse");
    section.setAttribute("role", "region");
    section.setAttribute("aria-labelledby", "questpulse-branch-title");

    const heading = root.ownerDocument.createElement("h1");
    heading.id = "questpulse-branch-title";
    heading.textContent = "QuestPulse";

    const status = root.ownerDocument.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "Connected to The Last Cosmic Explosion.";

    const detail = root.ownerDocument.createElement("p");
    detail.textContent = "The Q.P host boundary is active. Offer catalogue, publisher workflows, and legacy UI migration remain separate integration tasks.";

    section.append(heading, status, detail);
    root.replaceChildren(section);

    return { unmount() { root.replaceChildren(); } };
  },
};
