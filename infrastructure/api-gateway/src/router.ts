import type { GatewayRequest, GatewayResponse, GatewayRoute } from "./contracts.js";

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/**
 * Minimal in-process router for contract testing and local integration.
 * It is not an internet-facing HTTP server or a substitute for an edge gateway.
 */
export class ApiGatewayRouter {
  private readonly routes = new Map<string, GatewayRoute>();

  register(route: GatewayRoute): void {
    if (!route.path.startsWith("/") || route.path.includes("?")) {
      throw new Error("Gateway route path must be an absolute path without query parameters.");
    }
    if (route.requiredCapability !== undefined && !route.requiredCapability.trim()) {
      throw new Error("Route capability cannot be empty.");
    }
    const key = routeKey(route.method, route.path);
    if (this.routes.has(key)) throw new Error(`Duplicate gateway route: ${key}`);
    this.routes.set(key, route);
  }

  async dispatch(request: GatewayRequest): Promise<GatewayResponse> {
    const route = this.routes.get(routeKey(request.method, request.path));
    if (!route) {
      const methodExists = [...this.routes.values()].some((item) => item.path === request.path);
      return { status: methodExists ? 405 : 404, requestId: request.requestId };
    }

    if (route.requiredCapability) {
      if (!request.principal) return { status: 401, requestId: request.requestId };
      if (!request.principal.capabilities.has(route.requiredCapability)) {
        return { status: 403, requestId: request.requestId };
      }
    }

    try {
      const response = await route.handler(request);
      return { ...response, requestId: request.requestId };
    } catch {
      // Do not leak internal exception details through the gateway boundary.
      return { status: 500, requestId: request.requestId };
    }
  }
}
