import type { ComponentType } from "preact";

export interface TLCEIslandBridge {
  mount(
    name: string,
    host: HTMLElement,
    props?: Record<string, unknown>,
  ): () => void;
  mountAll(root?: ParentNode): void;
  unmount(host: HTMLElement): void;
}

declare global {
  interface Window {
    TLCEIslands?: TLCEIslandBridge;
  }
}
