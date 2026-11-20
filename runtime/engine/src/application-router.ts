import type { TLCEHostOptions } from "./questpulse-host.js";

export interface TLCEApplicationHost {
  mount(root: HTMLElement, requestId: string, capabilities: ReadonlySet<string>, route: string): Promise<void>;
  unmount(): Promise<boolean>;
}

export interface TLCEApplicationRouterOptions {
  host: TLCEApplicationHost;
  root: HTMLElement;
  windowRef?: Window;
  capabilities?: ReadonlySet<string>;
  requestIdFactory?: () => string;
  onNotFound?: (pathname: string) => void;
  onError?: (error: unknown, pathname: string) => void;
}

/**
 * Browser composition root for TLCE product routes.
 * QuestPulse is mounted only while the browser pathname is inside /questpulse.
 */
export function createTLCEApplicationRouter(options: TLCEApplicationRouterOptions) {
  const windowRef = options.windowRef ?? options.root.ownerDocument.defaultView;
  if (!windowRef) throw new Error("A browser window is required to start the TLCE application router");

  const capabilities = options.capabilities ?? new Set<string>();
  let sequence = 0;
  const requestIdFactory = options.requestIdFactory ?? (() => `tlce-route-${++sequence}`);
  let started = false;
  let activeRoute: string | undefined;
  let lifecycle = Promise.resolve();

  function serialize(operation: () => Promise<void>): Promise<void> {
    const result = lifecycle.then(operation, operation);
    lifecycle = result.then(() => undefined, () => undefined);
    return result;
  }

  function isQuestPulseRoute(pathname: string): boolean {
    return pathname === "/questpulse" || pathname.startsWith("/questpulse/");
  }

  async function dispatch(pathname: string): Promise<void> {
    await serialize(async () => {
      if (isQuestPulseRoute(pathname)) {
        if (activeRoute === pathname) return;
        await options.host.mount(options.root, requestIdFactory(), capabilities, pathname);
        activeRoute = pathname;
        return;
      }

      if (activeRoute !== undefined) {
        await options.host.unmount();
        activeRoute = undefined;
      }
      options.onNotFound?.(pathname);
    });
  }

  function onPopState(): void {
    void dispatch(windowRef.location.pathname).catch((error) => {
      options.onError?.(error, windowRef.location.pathname);
    });
  }

  return {
    async start(): Promise<void> {
      if (started) return;
      started = true;
      windowRef.addEventListener("popstate", onPopState);
      try {
        await dispatch(windowRef.location.pathname);
      } catch (error) {
        started = false;
        windowRef.removeEventListener("popstate", onPopState);
        options.onError?.(error, windowRef.location.pathname);
        throw error;
      }
    },

    async navigate(path: string): Promise<void> {
      const target = new URL(path, windowRef.location.href);
      if (target.origin !== windowRef.location.origin) {
        throw new Error("TLCE navigation must remain on the current origin");
      }
      windowRef.history.pushState(null, "", target.href);
      await dispatch(target.pathname);
    },

    async stop(): Promise<void> {
      if (!started) return;
      started = false;
      windowRef.removeEventListener("popstate", onPopState);
      await serialize(async () => {
        if (activeRoute !== undefined) {
          await options.host.unmount();
          activeRoute = undefined;
        }
      });
    },

    get currentRoute(): string | undefined {
      return activeRoute;
    },
  };
}
