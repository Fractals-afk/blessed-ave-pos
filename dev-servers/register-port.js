#!/usr/bin/env node
// Wraps each app's dev command: assigns/records the port it's actually
// running on so sibling apps (in the SAME worktree/session) can discover
// each other without hardcoded ports colliding across parallel sessions.
//
// Usage: node register-port.js <name> <cmd> [args...]
//   name: "web" | "admin" | "api"
// Reads PORT from env if the harness already assigned one (autoPort),
// otherwise falls back to the app's historical default port.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const DEFAULTS = { web: 3000, admin: 3001, api: 4000 };

const [name, cmd, ...args] = process.argv.slice(2);
if (!name || !(name in DEFAULTS)) {
  console.error(`[dev-ports] unknown app name "${name}"`);
  process.exit(1);
}

const port = Number(process.env.PORT) || DEFAULTS[name];

const registryFile = path.join(__dirname, "ports.json");
let registry = {};
try {
  registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
} catch {
  // no registry yet — fine
}
registry[name] = port;
fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));

// Mirror the registry into each Next.js app's public/ dir so browser
// code can `fetch("/dev-ports.json")` at runtime (dev only — this file
// is never committed and is absent in production static exports).
for (const app of ["admin", "web"]) {
  const dest = path.join(__dirname, "..", "apps", app, "public", "dev-ports.json");
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(registry, null, 2));
  } catch {
    // best-effort — sibling app just won't get live discovery this run
  }
}

console.log(`[dev-ports] ${name} -> ${port}`);

const child = spawn(cmd, args, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: String(port) },
});
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
