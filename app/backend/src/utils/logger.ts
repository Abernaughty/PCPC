/**
 * Minimal leveled logger for the Azure Functions backend.
 *
 * Level is controlled by the LOG_LEVEL environment variable
 * (error | warn | info | debug); defaults to "info".
 */
type Level = "error" | "warn" | "info" | "debug";

const LEVELS: Record<Level, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function currentLevel(): number {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase() as Level;
  return LEVELS[raw] ?? LEVELS.info;
}

function log(level: Level, message: string, ...args: unknown[]): void {
  if (LEVELS[level] > currentLevel()) {
    return;
  }
  const line = `[${level.toUpperCase()}] ${message}`;
  if (level === "error") {
    console.error(line, ...args);
  } else if (level === "warn") {
    console.warn(line, ...args);
  } else {
    console.log(line, ...args);
  }
}

export const logger = {
  error: (message: string, ...args: unknown[]) =>
    log("error", message, ...args),
  warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
  info: (message: string, ...args: unknown[]) => log("info", message, ...args),
  debug: (message: string, ...args: unknown[]) =>
    log("debug", message, ...args),
};
