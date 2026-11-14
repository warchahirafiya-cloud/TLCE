import type { ModuleContext, ModuleHealth, TLCEModule } from "../../../packages/contracts/src/module.js";
import { questPulseManifest } from "./manifest.js";

export class QuestPulseModule implements TLCEModule {
  private context: ModuleContext | undefined;
  private state: ModuleHealth["state"] = "registered";

  async initialize(context: ModuleContext): Promise<void> {
    if (this.state === "ready") {
      throw new Error("QuestPulse cannot be initialized while running");
    }
    if (context.moduleId !== questPulseManifest.id ||
        context.moduleVersion !== questPulseManifest.version) {
      throw new Error("QuestPulse received an incompatible TLCE module context");
    }
    // The initial scaffold deliberately requests and accepts no capabilities.
    if (context.grantedPermissions.length !== 0) {
      throw new Error("QuestPulse scaffold does not accept permissions before capability review");
    }
    this.context = context;
    this.state = "initialized";
  }

  async start(): Promise<void> {
    if (!this.context) throw new Error("QuestPulse must be initialized by TLCE before start");
    if (this.state === "ready") return;
    this.state = "ready";
  }

  async health(): Promise<ModuleHealth> {
    return {
      state: this.state,
      checkedAt: new Date().toISOString(),
      message: this.state === "ready"
        ? "QuestPulse module boundary is active; legacy product features are not yet integrated."
        : "QuestPulse internal module scaffold; awaiting reviewed source integration.",
    };
  }

  async stop(): Promise<void> {
    this.state = "stopped";
  }
}

export function createQuestPulseModule(): QuestPulseModule {
  return new QuestPulseModule();
}
