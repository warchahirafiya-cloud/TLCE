import type { MicroFrontendManifest } from "../../../packages/contracts/src/micro-frontend.js";

/** Route reservation only; the parent host uses its static allowlisted loader. */
export const circularEconomyMicroFrontendManifest: MicroFrontendManifest = {
  id: "circular-economy",
  displayName: "Circular Digital Economy",
  version: "0.1.0",
  apiVersion: "1",
  route: "/circular-economy",
  entrypoint: "/assets/tlce/branches/circular-economy/entry.js",
  requestedCapabilities: [],
  dependencies: [],
};
