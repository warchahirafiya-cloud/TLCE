export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface GatewayPrincipal {
  moduleId: string;
  capabilities: ReadonlySet<string>;
}

export interface GatewayRequest {
  method: HttpMethod;
  path: string;
  requestId: string;
  principal?: GatewayPrincipal;
  body?: unknown;
}

export interface GatewayResponse<T = unknown> {
  status: 200 | 202 | 400 | 401 | 403 | 404 | 405 | 500;
  requestId: string;
  body?: T;
}

export interface GatewayRoute {
  method: HttpMethod;
  path: string;
  requiredCapability?: string;
  handler(request: GatewayRequest): Promise<GatewayResponse> | GatewayResponse;
}
