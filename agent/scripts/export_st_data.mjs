// Export the consultation routine, FAQ and announcements from the ST website repo
// (this repository's src/data) into data/st/st_data.json, so the agent answers from the same
// source of truth the website renders. Read-only: nothing in the ST repo changes.
//
//   node scripts/export_st_data.mjs            (run from agent/; the website is the parent folder)
//   node scripts/export_st_data.mjs <path>     (a different checkout of the website)
//
// Uses the esbuild that the ST repo already has installed to compile its TypeScript data files.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const stRepo = resolve(process.argv[2] ?? join(here, "..", ".."));
const out = join(here, "..", "data", "st", "st_data.json");

const require = createRequire(join(stRepo, "package.json"));
const esbuild = require("esbuild");

const data = (f) => join(stRepo, "src", "data", f).replaceAll("\\", "/");
const result = await esbuild.build({
  stdin: {
    contents: [
      `export * from "${data("scheduleData.ts")}";`,
      `export * from "${data("faqData.ts")}";`,
      `export * from "${data("announcementsData.ts")}";`,
    ].join("\n"),
    resolveDir: stRepo,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});

const code = result.outputFiles[0].text;
const mod = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

const exported = Object.fromEntries(Object.entries(mod).filter(([, v]) => typeof v !== "function"));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ source: "ST_BRACU_T07/src/data", exported_at: new Date().toISOString(), ...exported }, null, 2));
console.log(`wrote ${out}: ${Object.keys(exported).join(", ")}`);
