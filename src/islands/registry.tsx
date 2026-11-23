import { h, render, type ComponentType } from "preact";

type IslandProps = Record<string, unknown>;
type IslandComponent = ComponentType<any>;
type IslandLoader = () => Promise<IslandComponent>;
type IslandCleanup = () => void;

interface MountRecord {
  cancelled: boolean;
  observer?: IntersectionObserver;
  cleanup?: IslandCleanup;
}

const registry = new Map<string, IslandLoader>();
const mountByHost = new WeakMap<HTMLElement, MountRecord>();
const stylesheetUrl = new URL("./tlce-islands.css", import.meta.url).href;

export function registerIsland(name: string, loader: IslandLoader): void {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(name)) {
    throw new Error("Island names must be lowercase kebab-case identifiers");
  }
  if (registry.has(name)) throw new Error(`Island already registered: ${name}`);
  registry.set(name, loader);
}

function readIslandProps(host: HTMLElement): IslandProps {
  const rawProps = host.dataset.tlceIslandProps;
  if (!rawProps) return {};

  try {
    const parsed: unknown = JSON.parse(rawProps);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as IslandProps;
    }
  } catch {
    console.warn("Invalid data-tlce-island-props; mounting with empty props");
  }
  return {};
}

function disposeRecord(host: HTMLElement, record: MountRecord): void {
  if (record.cancelled) return;
  record.cancelled = true;
  record.observer?.disconnect();
  record.observer = undefined;
  record.cleanup?.();
  if (mountByHost.get(host) === record) mountByHost.delete(host);
  host.removeAttribute("aria-busy");
  host.removeAttribute("data-tlce-island-status");
}

async function loadAndMount(
  name: string,
  host: HTMLElement,
  props: IslandProps,
  record: MountRecord,
): Promise<void> {
  const loader = registry.get(name);
  if (!loader) return;

  host.dataset.tlceIslandStatus = "loading";
  host.setAttribute("aria-busy", "true");

  let shadow: ShadowRoot | null = null;
  let mountPoint: HTMLDivElement | null = null;

  try {
    const component = await loader();
    if (record.cancelled || mountByHost.get(host) !== record) return;

    shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    shadow.replaceChildren();

    // Keep the existing same-origin stylesheet boundary and Shadow DOM isolation.
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = stylesheetUrl;
    stylesheet.dataset.tlceIslandStyles = "true";

    mountPoint = document.createElement("div");
    mountPoint.className = "min-h-full";
    shadow.append(stylesheet, mountPoint);
    render(h(component, props), mountPoint);

    record.cleanup = () => {
      render(null, mountPoint);
      shadow.replaceChildren();
    };
    host.dataset.tlceIslandStatus = "mounted";
    host.removeAttribute("aria-busy");
  } catch (error) {
    if (record.cancelled || mountByHost.get(host) !== record) return;
    try {
      if (mountPoint) render(null, mountPoint);
    } catch {
      // Preserve the original loader/render error while still clearing the host.
    }
    shadow?.replaceChildren();
    host.dataset.tlceIslandStatus = "error";
    host.removeAttribute("aria-busy");
    mountByHost.delete(host);
    console.error(`Failed to load TLCE island: ${name}`, error);
  }
}

/**
 * Explicit mounting remains eager. The returned disposer is synchronous and
 * also cancels an in-flight dynamic import before it can attach to the host.
 */
export function mountIsland(
  name: string,
  host: HTMLElement,
  props: IslandProps = {},
): IslandCleanup {
  if (!registry.has(name)) throw new Error(`Unknown TLCE island: ${name}`);

  const previous = mountByHost.get(host);
  if (previous) disposeRecord(host, previous);

  const record: MountRecord = { cancelled: false };
  mountByHost.set(host, record);
  void loadAndMount(name, host, props, record);

  return () => disposeRecord(host, record);
}

/**
 * Discover declarative islands and defer each component chunk until its host
 * approaches the viewport. Browsers without IntersectionObserver mount eagerly.
 */
export function mountRegisteredIslands(root: ParentNode = document): void {
  for (const host of root.querySelectorAll<HTMLElement>("[data-tlce-island]")) {
    if (mountByHost.has(host)) continue;

    const name = host.dataset.tlceIsland;
    if (!name || !registry.has(name)) continue;

    const props = readIslandProps(host);
    const record: MountRecord = { cancelled: false };
    mountByHost.set(host, record);

    if (typeof IntersectionObserver === "undefined") {
      void loadAndMount(name, host, props, record);
      continue;
    }

    record.observer = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || record.cancelled) continue;
        observer.unobserve(host);
        record.observer = undefined;
        void loadAndMount(name, host, props, record);
      }
    }, {
      root: null,
      rootMargin: "200px 0px",
      threshold: 0.01,
    });

    host.dataset.tlceIslandStatus = "waiting";
    record.observer.observe(host);
  }
}

export function unmountIsland(host: HTMLElement): void {
  const record = mountByHost.get(host);
  if (record) disposeRecord(host, record);
}
