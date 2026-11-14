import type { TLCEComponentDefinition, TLCEComponentManifest } from "./component-contract";

const ID = /^[a-z][a-z0-9-]{2,63}$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export class ComponentRegistry {
  private readonly components = new Map<string, TLCEComponentDefinition>();

  register(definition: TLCEComponentDefinition): void {
    const manifest = definition?.manifest as TLCEComponentManifest | undefined;
    if (!manifest || typeof manifest !== "object") throw new Error("Component manifest is required");
    if (typeof manifest.id !== "string" || !ID.test(manifest.id)) throw new Error("Invalid component id");
    if (typeof manifest.version !== "string" || !VERSION.test(manifest.version)) throw new Error("Invalid component version");
    if (typeof manifest.apiVersion !== "string" || !manifest.apiVersion.trim()) throw new Error("Component API version is required");
    if (typeof definition.render !== "function") throw new Error("Component renderer is required");
    const a11y = manifest.accessibility;
    if (!a11y || a11y.keyboardOperable !== true || a11y.semanticRoot !== true ||
        typeof a11y.accessibleNameRequired !== "boolean") throw new Error("Component accessibility contract is incomplete");
    if (manifest.styleEntry !== undefined &&
        (typeof manifest.styleEntry !== "string" || !manifest.styleEntry.startsWith("/") ||
         manifest.styleEntry.startsWith("//") || manifest.styleEntry.includes(".."))) {
      throw new Error("Component styles must use a same-origin asset path");
    }
    if (this.components.has(manifest.id)) throw new Error("Component already registered");
    this.components.set(manifest.id, definition);
  }

  get(id: string): TLCEComponentDefinition | undefined { return this.components.get(id); }
  list(): ReadonlyArray<TLCEComponentDefinition> { return [...this.components.values()]; }
}
