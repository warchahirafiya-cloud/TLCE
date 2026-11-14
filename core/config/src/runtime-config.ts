export type RuntimeMode = "development" | "test" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";
export interface RuntimeConfig { mode: RuntimeMode; port: number; logLevel: LogLevel; databaseUrl?: string; oidcIssuer?: string; oidcAudience?: string; aiProvider?: string; aiApiKey?: string; }
export interface ConfigResult { config?: RuntimeConfig; errors: string[]; }
function optionalString(env: Readonly<Record<string, string | undefined>>, key: string): string | undefined { const value = env[key]?.trim(); return value ? value : undefined; }
/** Parse injected environment values; never logs or returns secret values in errors. */
export function loadRuntimeConfig(env: Readonly<Record<string, string | undefined>>): ConfigResult {
 const errors: string[] = [];
 const modeValue = optionalString(env, "TLCE_MODE") ?? "development";
 if (!["development", "test", "production"].includes(modeValue)) errors.push("TLCE_MODE must be development, test, or production");
 const mode = (["development", "test", "production"].includes(modeValue) ? modeValue : "development") as RuntimeMode;
 const rawPort = optionalString(env, "PORT") ?? "3000"; const port = Number(rawPort);
 if (!/^\\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) errors.push("PORT must be an integer between 1 and 65535");
 const levelValue = optionalString(env, "LOG_LEVEL") ?? (mode === "production" ? "info" : "debug");
 if (!["debug", "info", "warn", "error"].includes(levelValue)) errors.push("LOG_LEVEL must be debug, info, warn, or error");
 const databaseUrl = optionalString(env, "DATABASE_URL");
 if (databaseUrl) { try { const parsed = new URL(databaseUrl); if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.username) errors.push("DATABASE_URL must be a PostgreSQL connection URL"); } catch { errors.push("DATABASE_URL must be a valid PostgreSQL connection URL"); } }
 const oidcIssuer = optionalString(env, "OIDC_ISSUER"); const oidcAudience = optionalString(env, "OIDC_AUDIENCE");
 if (oidcIssuer) { try { const parsed = new URL(oidcIssuer); if (parsed.protocol !== "https:" || !parsed.hostname) errors.push("OIDC_ISSUER must be an HTTPS issuer URL"); } catch { errors.push("OIDC_ISSUER must be a valid HTTPS URL"); } }
 if (Boolean(oidcIssuer) !== Boolean(oidcAudience)) errors.push("OIDC_ISSUER and OIDC_AUDIENCE must be configured together");
 const aiProvider = optionalString(env, "AI_PROVIDER"); const aiApiKey = optionalString(env, "AI_API_KEY");
 if (Boolean(aiProvider) !== Boolean(aiApiKey)) errors.push("AI_PROVIDER and AI_API_KEY must be configured together");
 if (mode === "production") { if (!databaseUrl) errors.push("DATABASE_URL is required in production"); if (!oidcIssuer || !oidcAudience) errors.push("OIDC_ISSUER and OIDC_AUDIENCE are required in production"); if (!aiProvider || !aiApiKey) errors.push("AI_PROVIDER and AI_API_KEY are required in production"); if (levelValue === "debug") errors.push("LOG_LEVEL=debug is not allowed in production"); }
 if (errors.length) return { errors };
 return { config: { mode, port, logLevel: levelValue as LogLevel, ...(databaseUrl ? { databaseUrl } : {}), ...(oidcIssuer ? { oidcIssuer } : {}), ...(oidcAudience ? { oidcAudience } : {}), ...(aiProvider ? { aiProvider } : {}), ...(aiApiKey ? { aiApiKey } : {}) }, errors: [] };
}