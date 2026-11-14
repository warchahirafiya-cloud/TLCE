import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { loadConfig } from "./config.js";
import { stdoutAuditSink } from "./audit.js";
import { createMcpApplication } from "./server.js";

const config = loadConfig();
const { nodeHandler, handler } = createMcpApplication(config, stdoutAuditSink);
const app = createMcpExpressApp({
  host: config.bindHost,
  allowedHosts: config.allowedHosts,
  allowedOrigins: config.allowedOrigins
});

app.disable("x-powered-by");
app.all("/mcp", async (req, res, next) => {
  try {
    await new Promise<void>((resolve, reject) => {
      nodeHandler(req, res, req.body).then(resolve, reject);
    });
  } catch (error) {
    next(error);
  }
});

const server = app.listen(config.port, config.bindHost, () => {
  process.stdout.write(JSON.stringify({
    event: "mcp.server.started",
    host: config.bindHost,
    port: config.port,
    protocolRevision: "2026-07-28"
  }) + "\n");
});

const shutdown = async (signal: string): Promise<void> => {
  process.stdout.write(JSON.stringify({ event: "mcp.server.stopping", signal }) + "\n");
  server.close();
  await handler.close();
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
