import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const forbidden = [
  ["internal service domain", ["faded", "washeddistressed.com"].join("")],
  ["private workspace path", ["Server", "workSpace"].join("/")],
  ["Mac service manager", ["launch", "d"].join("")],
  ["Cloud edge SSO", ["Cloud", "flare Access"].join("")],
];
const forbiddenPatterns = [
  ["Discord webhook credential", /https:\/\/(?:discord(?:app)?\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+/],
];

const violations = [];
for (const file of files) {
  if (/\.(png|jpg|jpeg|gif|webp|ico|woff2?)$/i.test(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const [label, pattern] of forbidden) if (content.includes(pattern)) violations.push(`${file}: ${label}`);
  for (const [label, pattern] of forbiddenPatterns) if (pattern.test(content)) violations.push(`${file}: ${label}`);
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log(`Public demo safety scan passed (${files.length} tracked files).`);
