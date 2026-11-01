import { readFileSync, existsSync } from "node:fs";
export function loadEnv() {
  if (existsSync(".env.local"))
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && !process.env[match[1]])
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
}
export function required(name) {
  const value = process.env[name];
  if (!value) throw Error(`Missing ${name}`);
  return value;
}
