import vm from "node:vm";

export interface SandboxResult {
  value: unknown;
  logs: string[];
}

/**
 * Run a snippet of user JavaScript with no I/O and a wall-clock limit.
 *
 * `node:vm` is an isolation boundary, not a security boundary - it stops a Code
 * node from reaching the filesystem or network by accident, but it is not a
 * defence against someone who already has write access to your workflows. The
 * studio is a single-user tool, so that trade is the right one; anything
 * multi-tenant needs a real sandbox (a subprocess, or isolated-vm).
 */
export function runSandboxed(
  code: string,
  scope: Record<string, unknown>,
  timeoutMs = 3_000,
): SandboxResult {
  const logs: string[] = [];
  const argNames = Object.keys(scope);

  const sandbox: Record<string, unknown> = {
    console: {
      log: (...args: unknown[]) => logs.push(args.map(inspect).join(" ")),
      warn: (...args: unknown[]) => logs.push(`WARN ${args.map(inspect).join(" ")}`),
      error: (...args: unknown[]) => logs.push(`ERROR ${args.map(inspect).join(" ")}`),
    },
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Array,
    Object,
    RegExp,
    Map,
    Set,
    Error,
    isNaN,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    structuredClone,
    __args: argNames.map((name) => scope[name]),
  };

  const context = vm.createContext(sandbox, { name: "studio-code-node" });
  const source = `(function (${argNames.join(", ")}) {\n"use strict";\n${code}\n}).apply(undefined, __args)`;
  const value = vm.runInContext(source, context, { timeout: timeoutMs, displayErrors: true });

  if (value && typeof (value as { then?: unknown }).then === "function") {
    throw new Error("Code nodes must be synchronous - returning a Promise is not supported.");
  }
  return { value, logs };
}

function inspect(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
