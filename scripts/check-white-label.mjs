// Fails when anything hospital-specific is written into the portal code. Branding (name, logos, colours, sign-in
// text, links, contacts) must come from hospital_config through /api/hospital; neutral UI colours live only as
// tokens in the @theme block of globals.css.
//   node scripts/check-white-label.mjs
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const files = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

const RULES = [
  { what: "colour outside the globals.css theme tokens", re: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g, skip: (f, line) => f.endsWith("globals.css") && /^\s+--color-[a-z-]+:/.test(line) },
  { what: "hard-coded link", re: /\bhttps?:\/\/[^\s"'`)]+/g },
  { what: "phone number", re: /\+91[\s-]?\d{4,5}[\s-]?\d{5}\b|\b[6-9]\d{9}\b/g, skip: (_f, line) => /placeholder=/.test(line) },
  { what: "email address", re: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g },
  { what: "hospital or clinic name", re: /\b[A-Z][a-zA-Z]+ (Hospitals?|Clinics?|Healthcare|Diagnostics)\b/g },
  // Next re-applies a metadata title on every navigation, which would overwrite the hospital's name in the tab.
  { what: "fixed page title (the tab title comes from hospital_config)", re: /\btitle:\s*["'`][^"'`]+/g },
];

const problems = [];
for (const file of files(join(root, "src"))) {
  if (!/\.(tsx?|css)$/.test(file)) continue;
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.skip?.(file, line)) continue;
      for (const m of line.matchAll(rule.re)) problems.push(`${relative(root, file)}:${i + 1}  ${rule.what}: ${m[0]}`);
    }
  });
}
// Logos and favicons are served by the API from S3, so the portal ships no images of its own.
if (existsSync(join(root, "public"))) {
  for (const file of files(join(root, "public"))) problems.push(`${relative(root, file)}  file in public/: brand assets belong in S3 via the API`);
}

if (problems.length) {
  console.error(`White-label check failed (${problems.length}):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("White-label check passed: nothing hospital-specific in the portal code.");
