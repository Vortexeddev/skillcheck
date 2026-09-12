/**
 * skillcheck — can you legally ship this agent skill?
 *
 * Zero runtime dependencies on purpose: `npx @vortexeddev/skillcheck` should cost the user
 * almost nothing to try.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { analyseLicense, computeHealth, decide, VERDICT_LABEL } from "./analyzer.js";
import { parseFrontmatter, validateSkill, type Issue, type ValidationResult } from "./frontmatter.js";
import {
  fetchRawText,
  fetchRepo,
  fetchRootEntries,
  fetchTree,
  findLicenseFile,
  GitHubError,
  hasReadme,
  parseRepoInput,
  rawUrl,
  selectSkillFiles,
} from "./github.js";
import { detectSpdxFromText } from "./license-sniff.js";
import { c, renderBadgeMarkdown, renderRegistry, renderReport } from "./output.js";
import { classifyId, resolveLicense } from "./spdx.js";
import type { RegistryFile } from "./types.js";

// The registry is a generated TS module so the bundler can inline it. That keeps
// `skillcheck top` working offline with no runtime file lookup.
import { REGISTRY as REGISTRY_DATA } from "../data/registry.js";

const REGISTRY = REGISTRY_DATA as unknown as RegistryFile;

const HELP = `${c.bold("skillcheck")} — can you legally ship this agent skill?

${c.bold("USAGE")}
  npx @vortexeddev/skillcheck check <owner/repo | url | ./path>   Analyse a skill repo
  npx @vortexeddev/skillcheck top [query]                         Browse verified, commercially-safe skills
  npx @vortexeddev/skillcheck badge <owner/repo>                  Print a README badge for your skill
  npx @vortexeddev/skillcheck license <spdx-expression>           Explain a license in plain terms

${c.bold("OPTIONS")}
  --json          Machine-readable output (CI friendly)
  --limit <n>     Limit \`top\` results (default 20)
  -h, --help      Show this help
  -v, --version   Print version

${c.bold("EXAMPLES")}
  npx @vortexeddev/skillcheck check anthropics/skills
  npx @vortexeddev/skillcheck check https://github.com/obra/superpowers
  npx @vortexeddev/skillcheck top pdf
  npx @vortexeddev/skillcheck license "AGPL-3.0-only"

${c.bold("EXIT CODES")}
  0  pass     safe for commercial use
  1  review    a human should read the license
  2  fail      missing license, or SKILL.md breaks the spec

Docs: https://github.com/Vortexeddev/skillcheck
`;

interface Args {
  command: string;
  positional: string[];
  json: boolean;
  limit: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: "", positional: [], json: false, limit: 20 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") args.json = true;
    else if (a === "--limit") {
      const n = Number.parseInt(argv[++i] ?? "", 10);
      if (Number.isFinite(n) && n > 0) args.limit = n;
    } else if (a === "-h" || a === "--help") args.command = "help";
    else if (a === "-v" || a === "--version") args.command = "version";
    else if (!args.command) args.command = a.replace(/^--?/, "");
    else args.positional.push(a);
  }
  return args;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);

  switch (args.command) {
    case "":
    case "help":
      process.stdout.write(HELP);
      return 0;
    case "version": {
      process.stdout.write(`${version()}\n`);
      return 0;
    }
    case "check":
      return runCheck(args);
    case "top":
    case "list":
    case "ls":
      return runTop(args);
    case "badge":
      return runBadge(args);
    case "license":
      return runLicense(args);
    default:
      process.stderr.write(`Unknown command: ${args.command}\n\n${HELP}`);
      return 64;
  }
}

function version(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

async function runCheck(args: Args): Promise<number> {
  const target = args.positional[0];
  if (!target) {
    process.stderr.write("Usage: npx @vortexeddev/skillcheck check <owner/repo | url | ./path>\n");
    return 64;
  }

  try {
    // Local directory -------------------------------------------------------
    if (target.startsWith(".") || target.startsWith("/") || target.startsWith("~")) {
      const report = checkLocal(target);
      emit(report, args.json);
      return exitCode(report.verdict);
    }

    // GitHub repo -----------------------------------------------------------
    const repo = parseRepoInput(target);
    if (!repo) {
      process.stderr.write(
        `Could not understand "${target}". Expected owner/repo, a github.com URL, or a local path.\n`,
      );
      return 64;
    }

    const report = await checkRemote(repo);
    emit(report, args.json);
    return exitCode(report.verdict);
  } catch (err) {
    if (err instanceof GitHubError) {
      process.stderr.write(`${c.red("error")} ${err.message}\n`);
      return 1;
    }
    process.stderr.write(`${c.red("error")} ${(err as Error).message}\n`);
    return 1;
  }
}

function emit(report: Awaited<ReturnType<typeof checkRemote>>, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(renderReport(report));
  }
}

function exitCode(verdict: string): number {
  return verdict === "pass" ? 0 : verdict === "review" ? 1 : 2;
}

async function checkRemote(repo: string) {
  const ghRepo = await fetchRepo(repo);
  const root = await fetchRootEntries(repo).catch(() => []);

  const licenseFile = findLicenseFile(root);
  const license = analyseLicense(ghRepo.license?.spdx_id, licenseFile !== null);
  const health = computeHealth({
    stars: ghRepo.stargazers_count,
    forks: ghRepo.forks_count,
    openIssues: ghRepo.open_issues_count,
    pushedAt: ghRepo.pushed_at,
    archived: ghRepo.archived,
    hasReadme: hasReadme(root),
    hasLicenseFile: licenseFile !== null,
  });

  // Find and validate SKILL.md files --------------------------------------
  const tree = await fetchTree(repo, ghRepo.default_branch);
  let validation: ValidationResult | null = null;
  let scanned = 0;

  if (tree) {
    const files = selectSkillFiles(tree, 5);
    scanned = files.length;
    if (files.length > 0) {
      validation = await validateRemoteSkills(repo, ghRepo.default_branch, files);
    }
  }

  return decide({ repo, license, validation, skillsScanned: scanned, health });
}

async function validateRemoteSkills(
  repo: string,
  ref: string,
  files: string[],
): Promise<ValidationResult> {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  let validCount = 0;
  let checked = 0;
  let bodyLines = 0;

  for (const file of files) {
    const text = await fetchRawText(rawUrl(repo, ref, file));
    if (text === null) continue;
    checked++;

    const dirName = path.posix.basename(path.posix.dirname(file));
    const parsed = parseFrontmatter(text);
    const result = validateSkill(parsed, dirName === "." ? undefined : dirName);

    if (result.valid) validCount++;
    bodyLines = Math.max(bodyLines, result.bodyLines);

    const prefix = files.length > 1 ? `${file}: ` : "";
    errors.push(...result.errors.map((e) => ({ ...e, message: prefix + e.message })));
    warnings.push(...result.warnings.map((w) => ({ ...w, message: prefix + w.message })));
  }

  return { valid: validCount === checked, validCount, errors, warnings, bodyLines };
}

// ---------------------------------------------------------------------------
// local check
// ---------------------------------------------------------------------------

function checkLocal(target: string): ReturnType<typeof decide> {
  const abs = path.resolve(target.replace(/^~/, process.env.HOME ?? ""));
  if (!fs.existsSync(abs)) {
    throw new Error(`Path not found: ${abs}`);
  }

  const entries = fs.readdirSync(abs, { withFileTypes: true });

  const licenseEntry = entries.find(
    (e) => e.isFile() && /^licen[cs]e(\..+)?$/i.test(e.name),
  );
  const readme = entries.some((e) => e.isFile() && /^readme(\..+)?$/i.test(e.name));

  // Read the license text and try to detect the SPDX id ourselves, because a
  // local checkout has no GitHub API to do it for us.
  let spdx: string | null = null;
  if (licenseEntry) {
    const text = fs.readFileSync(path.join(abs, licenseEntry.name), "utf8").slice(0, 4000);
    spdx = detectSpdxFromText(text);
  }

  const license = analyseLicense(spdx, licenseEntry !== undefined);

  // Validate every SKILL.md in the tree (bounded, to stay fast).
  const skillFiles = findLocalSkills(abs, 20);
  let validation: ValidationResult | null = null;
  if (skillFiles.length > 0) {
    const errors: Issue[] = [];
    const warnings: Issue[] = [];
    let validCount = 0;
    let bodyLines = 0;

    for (const file of skillFiles) {
      const text = fs.readFileSync(file, "utf8");
      const dirName = path.basename(path.dirname(file));
      const result = validateSkill(parseFrontmatter(text), dirName);
      if (result.valid) validCount++;
      bodyLines = Math.max(bodyLines, result.bodyLines);
      const rel = path.relative(abs, file);
      const prefix = skillFiles.length > 1 ? `${rel}: ` : "";
      errors.push(...result.errors.map((e) => ({ ...e, message: prefix + e.message })));
      warnings.push(...result.warnings.map((w) => ({ ...w, message: prefix + w.message })));
    }
    validation = {
      valid: validCount === skillFiles.length,
      validCount,
      errors,
      warnings,
      bodyLines,
    };
  }

  return decide({
    repo: path.basename(abs),
    url: abs,
    license,
    validation,
    skillsScanned: skillFiles.length,
    health: null,
  });
}

function findLocalSkills(dir: string, limit: number, depth = 0): string[] {
  if (depth > 4) return [];
  const found: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entries) {
    if (found.length >= limit) break;
    if (e.name === "node_modules" || e.name === ".git") continue;
    const full = path.join(dir, e.name);
    if (e.isFile() && /^skill\.md$/i.test(e.name)) {
      found.push(full);
    } else if (e.isDirectory()) {
      found.push(...findLocalSkills(full, limit - found.length, depth + 1));
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// top / badge / license
// ---------------------------------------------------------------------------

function runTop(args: Args): number {
  const query = args.positional[0]?.toLowerCase();

  let entries = REGISTRY.entries;
  if (query) {
    entries = entries.filter(
      (e) =>
        e.repo.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query) ||
        (e.topics ?? []).some((t) => t.includes(query)),
    );
  }

  // Safe-to-ship first, then by stars.
  const rank = { pass: 0, review: 1, fail: 2 } as const;
  entries = [...entries]
    .sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.stars - a.stars)
    .slice(0, args.limit);

  if (args.json) {
    process.stdout.write(JSON.stringify({ generated: REGISTRY.generated, entries }, null, 2) + "\n");
    return 0;
  }

  process.stdout.write(
    c.dim(`  Registry snapshot: ${REGISTRY.generated}  ·  ${REGISTRY.entries.length} skills indexed\n`),
  );
  process.stdout.write(renderRegistry(entries, query));
  return 0;
}

async function runBadge(args: Args): Promise<number> {
  const target = args.positional[0];
  if (!target) {
    process.stderr.write("Usage: npx @vortexeddev/skillcheck badge <owner/repo>\n");
    return 64;
  }
  const repo = parseRepoInput(target);
  if (!repo) {
    process.stderr.write(`Could not understand "${target}".\n`);
    return 64;
  }
  try {
    const report = await checkRemote(repo);
    process.stdout.write(renderBadgeMarkdown(report) + "\n");
    return 0;
  } catch (err) {
    process.stderr.write(`${c.red("error")} ${(err as Error).message}\n`);
    return 1;
  }
}

function runLicense(args: Args): number {
  const expression = args.positional.join(" ");
  if (!expression) {
    process.stderr.write("Usage: npx @vortexeddev/skillcheck license <spdx-expression>\n");
    return 64;
  }

  if (args.json) {
    try {
      process.stdout.write(JSON.stringify(resolveLicense(expression), null, 2) + "\n");
      return 0;
    } catch (err) {
      process.stderr.write(`${(err as Error).message}\n`);
      return 2;
    }
  }

  try {
    const resolved = resolveLicense(expression);
    process.stdout.write(`\n  ${c.bold(expression)}\n\n`);
    for (const info of resolved.infos) {
      const info1 = classifyId(info.id);
      process.stdout.write(`  ${c.cyan(info.id.padEnd(24))} ${info1.category}\n`);
      for (const line of wrapText(info1.note, 72)) {
        process.stdout.write(`  ${c.dim(line)}\n`);
      }
    }
    process.stdout.write(
      `\n  ${c.bold("Verdict:")} ${resolved.worstCategory === "permissive"
        ? c.green(VERDICT_LABEL.pass)
        : resolved.worstCategory === "unknown" || resolved.worstCategory === "source-available"
          ? c.yellow(VERDICT_LABEL.review)
          : c.yellow(VERDICT_LABEL.review)}\n\n`,
    );
    return resolved.worstCategory === "permissive" ? 0 : 1;
  } catch (err) {
    process.stderr.write(`${c.red("error")} ${(err as Error).message}\n`);
    return 2;
  }
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) current = w;
    else if (current.length + 1 + w.length <= width) current += " " + w;
    else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Only run when invoked directly. Without this guard, importing the module in a
// test would execute the CLI and call process.exit.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = await main();
}
