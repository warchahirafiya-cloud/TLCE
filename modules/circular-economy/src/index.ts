import type { ModuleContext, ModuleHealth, TLCEModule } from "../../../packages/contracts/src/module.js";

const MODULE_ID = "circular-economy";
const MODULE_VERSION = "0.1.0";

export class CircularEconomyModule implements TLCEModule {
  private context: ModuleContext | null = null;
  private state: ModuleHealth["state"] = "registered";

  async initialize(context: ModuleContext): Promise<void> {
    if (context.moduleId !== MODULE_ID || context.moduleVersion !== MODULE_VERSION) {
      throw new Error("Circular Economy must be initialized by its matching TLCE registration");
    }
    if (this.state === "initialized" || this.state === "ready") {
      throw new Error("Circular Economy is already initialized");
    }
    this.context = context;
    this.state = "initialized";
  }

  async start(): Promise<void> {
    if (!this.context || this.state !== "initialized") {
      throw new Error("Circular Economy must be initialized before start");
    }
    this.state = "ready";
  }

  async health(): Promise<ModuleHealth> {
    return {
      state: this.state,
      checkedAt: new Date().toISOString(),
      message: this.context
        ? "Circular Digital Economy is hosted inside TLCE; listings, transactions and external integrations are not enabled yet."
        : "Circular Digital Economy is not initialized by the TLCE Runtime Engine.",
    };
  }

  async stop(): Promise<void> {
    this.state = "stopped";
    this.context = null;
  }
}
