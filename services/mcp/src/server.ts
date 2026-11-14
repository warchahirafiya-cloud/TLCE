import { createMcpHandler, McpServer, requireScopes } from "@modelcontextprotocol/server";
import { requireBearerAuth } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import * as z from "zod/v4";
import type { McpConfig } from "./config.js";
import type { AuditSink } from "./audit.js";
import { createAuditEvent } from "./audit.js";
import { createTokenVerifier } from "./auth.js";

export function createMcpApplication(config: McpConfig, audit: AuditSink) {
  const verifier = createTokenVerifier(config);
  const auth = requireBearerAuth({
    verifier,
    requiredScopes: config.requiredScopes,
    expectedResource: config.publicUrl
  });

  const handler = createMcpHandler((requestContext) => {
    const server = new McpServer(
      { name: "tlce-mcp-gateway", version: "0.1.0" },
      { maxToolInputElements: 256 }
    );

    server.registerTool(
      "tlce.health.read",
      {
        title: "Read TLCE MCP gateway health",
        description: "Returns the minimal health state of the MCP gateway. Does not expose user data or infrastructure secrets.",
        inputSchema: z.object({}).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
        scopeChallenge: requireScopes(config.healthScope)
      },
      async (_args, context) => {
        const startedAt = Date.now();
        const principalId = context.http?.authInfo?.clientId ?? requestContext.authInfo?.clientId ?? "unknown";
        const correlationId = crypto.randomUUID();
        try {
          const result = {
            status: "ok",
            service: "tlce-mcp-gateway",
            protocolRevision: "2026-07-28",
            moduleBoundary: "TLCE-Core"
          };
          await audit.write(createAuditEvent({
            tool: "tlce.health.read",
            principalId,
            outcome: "success",
            durationMs: Date.now() - startedAt,
            correlationId
          }));
          return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result };
        } catch {
          await audit.write(createAuditEvent({
            tool: "tlce.health.read",
            principalId,
            outcome: "failure",
            durationMs: Date.now() - startedAt,
            correlationId
          }));
          throw new Error("MCP tool execution failed");
        }
      }
    );
    return server;
  }, {
    legacy: "reject",
    maxRequestBodySize: config.maxRequestBytes,
    responseMode: "auto"
  });

  const nodeHandler = toNodeHandler(handler);
  return { auth, handler, nodeHandler };
}
