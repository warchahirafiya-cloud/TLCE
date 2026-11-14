import type { GatewayRequest, GatewayResponse, GatewayRoute } from "./contracts.js";

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function validPath(path: unknown): path is string {
  return typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !/[?#\\\\\u0000-\u001f\u007f]/.test(path) &&
    !/%(?:2e|2f|5c)/i.test(path) &&
    !path.split("/").some((segment) => segment === "." || segment === "..");
}

/**
 * Minimal in-process router for contract testing and local integration.
 * It is not an internet-facing HTTP server or a substitute for an edge gateway.
 */
export class ApiGatewayRouter {
  private readonly routes = new Map<string, GatewayRoute>();

  register(route: GatewayRoute): void {
    if (!route || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(route.method) ||
        !validPath(route.path) || route.path.length > 2048) {
      throw new Error("Gateway route must use a supported method and a normalized absolute path.");
    }
    if (route.requiredCapability !== undefined &&
        (typeof route.requiredCapability !== "string" || !/^[a-z][a-z0-9._:-]{1,127}$/.test(route.requiredCapability))) {
      throw new Error("Route capability is invalid.");
    }
    if (typeof route.handler !== "function") throw new Error("Route handler is required.");
    const key = routeKey(route.method, route.path);
    if (this.routes.has(key)) throw new Error(`Duplicate gateway route: ${key}`);
    this.routes.set(key, route);
  }

  async dispatch(request: GatewayRequest): Promise<GatewayResponse> {
    if (!request || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(request.method) ||
        !validPath(request.path) || request.path.length > 2048 ||
        typeof request.requestId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(request.requestId)) {
      return { status: 400, requestId: typeof request?.requestId === "string" ? request.requestId.slice(0, 128) : "invalid-request" };
    }

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
      if (!response || !Number.isInteger(response.status) ||
          ![200, 202, 400, 401, 403, 404, 405, 500].includes(response.status)) {
        return { status: 500, requestId: request.requestId };
      }
      return { ...response, requestId: request.requestId };
    } catch {
      // Do not leak internal exception details through the gateway boundary.
      return { status: 500, requestId: request.requestId };
    }
  }
}
