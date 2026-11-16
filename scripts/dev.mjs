import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const rawArgs = process.argv.slice(2);
let port = process.env.PORT || "3000";
let hostname = "0.0.0.0";

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg.startsWith("--port=")) {
    port = arg.slice("--port=".length);
  } else if ((arg === "--port" || arg === "-p") && rawArgs[i + 1]) {
    port = rawArgs[++i];
  } else if (arg.startsWith("-p=")) {
    port = arg.slice("-p=".length);
  } else if (arg.startsWith("--host=")) {
    hostname = arg.slice("--host=".length);
  } else if (arg.startsWith("--hostname=")) {
    hostname = arg.slice("--hostname=".length);
  } else if ((arg === "--host" || arg === "--hostname" || arg === "-H") && rawArgs[i + 1]) {
    hostname = rawArgs[++i];
  }
}

const child = spawn(
  process.execPath,
  [nextBin, "dev", "-p", port, "-H", hostname],
  {
    stdio: "inherit",
    env: process.env,
  }
);

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
