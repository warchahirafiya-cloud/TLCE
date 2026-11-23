import { h, render, type ComponentType } from "preact";

type IslandProps = Record<string, unknown>;
type IslandComponent = ComponentType<IslandProps>;

const registry = new Map<string, IslandComponent>();
const cleanupByHost = new WeakMap<HTMLElement, () => void>();
const stylesheetUrl = new URL("./tlce-islands.css", import.meta.url).href;

export function registerIsland(name: string, component: IslandComponent): void {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(name)) {
    throw new Error("Island names must be lowercase kebab-case identifiers");
  }
  if (registry.has(name)) throw new Error(`Island already registered: ${name}`);
  registry.set(name, component);
}

export function mountIsland(
  name: string,
  host: HTMLElement,
  props: IslandProps = {},
): () => void {
  const component = registry.get(name);
  if (!component) throw new Error(`Unknown TLCE island: ${name}`);

  cleanupByHost.get(host)?.();
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  shadow.replaceChildren();

  // A same-origin stylesheet link is CSP-compatible with the existing
  // style-src 'self' policy. Tailwind preflight remains inside Shadow DOM.
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  stylesheet.dataset.tlceIslandStyles = "true";

  const mountPoint = document.createElement("div");
  mountPoint.className = "min-h-full";
  shadow.append(stylesheet, mountPoint);
  render(h(component, props), mountPoint);

  const cleanup = () => {
    render(null, mountPoint);
    shadow.replaceChildren();
    cleanupByHost.delete(host);
  };
  cleanupByHost.set(host, cleanup);
  return cleanup;
}

export function mountRegisteredIslands(root: ParentNode = document): void {
  for (const host of root.querySelectorAll<HTMLElement>("[data-tlce-island]")) {
    if (cleanupByHost.has(host)) continue;
    const name = host.dataset.tlceIsland;
    if (!name || !registry.has(name)) continue;

    let props: IslandProps = {};
    const rawProps = host.dataset.tlceIslandProps;
    if (rawProps) {
      try {
        const parsed: unknown = JSON.parse(rawProps);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          props = parsed as IslandProps;
        }
      } catch {
        console.warn("Invalid data-tlce-island-props; mounting with empty props");
      }
    }
    mountIsland(name, host, props);
  }
}

export function unmountIsland(host: HTMLElement): void {
  cleanupByHost.get(host)?.();
}
