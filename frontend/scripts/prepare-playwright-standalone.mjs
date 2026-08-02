import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = resolve(root, ".next", "standalone");

function copyDirectory(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`Required build artifact is missing: ${source}`);
  }
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

copyDirectory(resolve(root, ".next", "static"), resolve(standaloneRoot, ".next", "static"));

const publicDirectory = resolve(root, "public");
if (existsSync(publicDirectory)) {
  copyDirectory(publicDirectory, resolve(standaloneRoot, "public"));
}
