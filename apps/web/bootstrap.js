import { mountQuestPulse } from "./questpulse.js";

const root = document.querySelector("[data-questpulse-app]");
if (root) mountQuestPulse(root);
