import type { ModuleContext, ModuleHealth, TLCEModule } from "../../../packages/contracts/src/module.js";

const MODULE_ID = "questpulse";

export class QuestPulseModule implements TLCEModule {
  private context: ModuleContext | null = null;
  private state: ModuleHealth["state"] = "registered";

  async initialize(context: ModuleContext): Promise<void> {
    if (context.moduleId !== MODULE_ID) {
      throw new Error("QuestPulse must be initialized by its registered TLCE module identity");
    }
    if (this.state === "ready") {
      throw new Error("QuestPulse is already initialized");
    }
    this.context = context;
    this.state = "initialized";
  }

  async start(): Promise<void> {
    if (!this.context || this.state !== "initialized") {
      throw new Error("QuestPulse must be initialized before start");
    }
    this.state = "ready";
  }

  async health(): Promise<ModuleHealth> {
    return {
      state: this.state,
      checkedAt: new Date().toISOString(),
      message: this.context
        ? "Lifecycle foundation active; product capabilities are not yet connected."
        : "Module has not been initialized by TLCE Runtime.",
    };
  }

  async stop(): Promise<void> {
    this.state = "stopped";
    this.context = null;
  }
}

export const questPulseModule = new QuestPulseModule();
