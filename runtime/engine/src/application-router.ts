export interface TLCEApplicationHost {
  mount(root: HTMLElement, requestId: string, capabilities: ReadonlySet<string>, route: string): Promise<void>;
  unmount(): Promise<boolean>;
}

export interface TLCEApplicationRouterOptions {
  host: TLCEApplicationHost;
  root: HTMLElement;
  windowRef?: Window;
  capabilities?: ReadonlySet<string>;
  /** GitHub Pages project path or deployment subdirectory, e.g. /TLCE. */
  basePath?: string;
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
  const browserWindow: Window = windowRef;

  const basePath = (options.basePath ?? "").replace(/\\/$/, "");
  if (basePath && (!basePath.startsWith("/") || basePath.startsWith("//"))) {
    throw new Error("TLCE basePath must be an absolute same-origin path");
  }
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

  function toApplicationPath(pathname: string): string {
    if (!basePath) return pathname;
    if (pathname === basePath || pathname === `${basePath}/`) return "/";
    if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
    return pathname;
  }

  function isQuestPulseRoute(pathname: string): boolean {
    return pathname === "/questpulse" || pathname.startsWith("/questpulse/");
  }

  async function dispatch(browserPathname: string): Promise<void> {
    const pathname = toApplicationPath(browserPathname);
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
    void dispatch(browserWindow.location.pathname).catch((error) => {
      options.onError?.(error, browserWindow.location.pathname);
    });
  }

  return {
    async start(): Promise<void> {
      if (started) return;
      started = true;
      browserWindow.addEventListener("popstate", onPopState);
      try {
        await dispatch(browserWindow.location.pathname);
      } catch (error) {
        started = false;
        browserWindow.removeEventListener("popstate", onPopState);
        options.onError?.(error, browserWindow.location.pathname);
        throw error;
      }
    },

    async navigate(path: string): Promise<void> {
      const requested = new URL(path, browserWindow.location.href);
      if (requested.origin !== browserWindow.location.origin) {
        throw new Error("TLCE navigation must remain on the current origin");
      }
      const targetPath = basePath && requested.pathname !== basePath &&
        !requested.pathname.startsWith(`${basePath}/`)
        ? `${basePath}${requested.pathname.startsWith("/") ? "" : "/"}${requested.pathname}`
        : requested.pathname;
      const target = new URL(targetPath, browserWindow.location.origin);
      browserWindow.history.pushState(null, "", target.href);
      await dispatch(target.pathname);
    },

    async stop(): Promise<void> {
      if (!started) return;
      started = false;
      browserWindow.removeEventListener("popstate", onPopState);
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
