import { readFileSync } from 'node:fs'
import { parse } from './lockb.js'

if (process.argv[2] === "-h" || process.argv[2] === "--help") {
  console.log();
  console.log("  Description");
  console.log("    Parse and print bun.lockb in text format");
  console.log();
  console.log("  Usage");
  console.log("    $ npx @hyrious/lockb [bun.lockb]");
  console.log();
  process.exit(0);
}

if (process.argv[2]?.toLowerCase() === "-v") {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  console.log(`${pkg.name}, ${pkg.version}`);
  process.exit(0);
}

const file = process.argv[2] || "bun.lockb";
const buffer = readFileSync(file);
const lockfile = parse(buffer);
console.log(lockfile);
