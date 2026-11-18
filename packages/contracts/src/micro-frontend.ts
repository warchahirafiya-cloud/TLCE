export interface MicroFrontendManifest {
  id: string;
  displayName: string;
  version: string;
  apiVersion: string;
  route: string;
  entrypoint: string;
  requestedCapabilities: string[];
  dependencies: Array<{ id: string; version: string }>;
}

export interface MicroFrontendContext {
  frontendId: string;
  frontendVersion: string;
  requestId: string;
  grantedCapabilities: ReadonlySet<string>;
  services: Readonly<MicroFrontendServices>;
}

export interface MicroFrontendServices {
  /** All calls pass through the TLCE host's authorization and API boundary. */
  request(input: { capability: string; method: string; path: string; body?: unknown }): Promise<unknown>;
  /** Cross-frontend communication is event-based; private module imports are forbidden. */
  publish(eventName: string, payload: unknown): void;
  subscribe(eventName: string, handler: (payload: unknown) => void): () => void;
}

export interface MicroFrontendMountOptions {
  root: HTMLElement;
  context: MicroFrontendContext;
  route: string;
}

export interface MicroFrontendInstance {
  unmount(): void | Promise<void>;
}

export interface MicroFrontendModule {
  mount(options: MicroFrontendMountOptions): Promise<MicroFrontendInstance>;
}

export type MicroFrontendLoader = (manifest: MicroFrontendManifest) => Promise<MicroFrontendModule>;
