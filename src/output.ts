/**
 * Terminal rendering. No chalk: we hand-roll ANSI so `npx skillcheck` stays tiny
 * and colours degrade correctly when piped or on dumb terminals.
 */

import { VERDICT_LABEL, type SkillCheckReport, type Verdict } from "./analyzer.js";
import type { Issue } from "./frontmatter.js";
import type { RegistryEntry } from "./types.js";

const useColor =
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb" &&
  (process.stdout.isTTY ?? false);

const c = {
  reset: (s: string) => (useColor ? `\x1b[0m${s}\x1b[0m` : s),
  bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[22m` : s),
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[22m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[39m` : s),
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[39m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[39m` : s),
  cyan: (s: string) => (useColor ? `\x1b[36m${s}\x1b[39m` : s),
};

export const VERDICT_COLOR: Record<Verdict, (s: string) => string> = {
  pass: c.green,
  review: c.yellow,
  fail: c.red,
};

const VERDICT_ICON: Record<Verdict, string> = {
  pass: "✔",
  review: "▲",
  fail: "✖",
};

export function renderReport(report: SkillCheckReport): string {
  const out: string[] = [];
  const paint = VERDICT_COLOR[report.verdict];

  out.push("");
  out.push(`  ${c.bold(report.repo)}`);
  out.push(
    `  ${paint(`${VERDICT_ICON[report.verdict]} ${VERDICT_LABEL[report.verdict]}`)}${c.dim(
      `   ${report.url}`,
    )}`,
  );
  out.push("");

  // --- license -------------------------------------------------------------
  const lic = report.license;
  out.push(`  ${c.bold("License")}   ${paint(lic.headline)}`);
  for (const line of wrap(lic.note, 74)) {
    out.push(`  ${c.dim(line)}`);
  }
  out.push("");

  // --- spec ----------------------------------------------------------------
  if (report.skills) {
    out.push(
      `  ${c.bold("Spec")}      ${report.skills.valid}/${report.skills.scanned} SKILL.md file(s) valid` +
        (report.skills.issues.length > 0
          ? c.dim(`  (${report.skills.issues.length} issue(s))`)
          : ""),
    );
    for (const issue of report.skills.issues.slice(0, 8)) {
      out.push(`    ${renderIssue(issue)}`);
    }
    if (report.skills.issues.length > 8) {
      out.push(c.dim(`    ... and ${report.skills.issues.length - 8} more`));
    }
    out.push("");
  }

  // --- health --------------------------------------------------------------
  if (report.health) {
    const h = report.health;
    const parts = [
      `★ ${h.stars.toLocaleString("en-US")}`,
      `${h.forks.toLocaleString("en-US")} forks`,
      h.daysSincePush !== null ? `pushed ${h.daysSincePush}d ago` : "push unknown",
      h.archived ? c.red("ARCHIVED") : null,
    ].filter(Boolean);
    out.push(`  ${c.bold("Health")}    ${parts.join("  ·  ")}`);
    out.push("");
  }

  // --- reasons -------------------------------------------------------------
  out.push(`  ${c.bold("Why")}`);
  for (const reason of report.reasons) {
    out.push(`    · ${reason}`);
  }
  out.push("");

  if (report.verdict === "fail" && report.license.category === "none") {
    out.push(
      c.dim(
        "  Fix it: add a LICENSE file. `MIT` is the usual choice if you want people to be\n" +
          "  able to use, modify and sell what they build with it.",
      ),
    );
    out.push("");
  }

  return out.join("\n");
}

function renderIssue(issue: Issue): string {
  const tag = issue.level === "error" ? c.red("error") : c.yellow("warn ");
  return `${tag} ${c.cyan(issue.code)} ${issue.message}`;
}

export function renderBadgeMarkdown(report: SkillCheckReport): string {
  const label = VERDICT_LABEL[report.verdict].replace(/ /g, "%20");
  const color = { pass: "brightgreen", review: "yellow", fail: "red" }[report.verdict];
  const slug = report.repo.replace(/-/g, "--").replace(/\//g, "-");
  return `[![skillcheck: ${VERDICT_LABEL[report.verdict]}](https://img.shields.io/badge/skillcheck-${label}-${color})](https://github.com/Vortexeddev/skillcheck#verdicts)`;
}

export function renderRegistry(entries: RegistryEntry[], query?: string): string {
  if (entries.length === 0) {
    return "\n  No skills matched. Try a broader query, or add yours:\n" +
      "  https://github.com/Vortexeddev/skillcheck/blob/main/CONTRIBUTING.md\n";
  }

  const rows = entries.map((e) => {
    const paint = VERDICT_COLOR[e.verdict];
    return {
      verdict: `${paint(VERDICT_ICON[e.verdict])} ${VERDICT_LABEL[e.verdict]}`,
      repo: c.bold(e.repo),
      stars: `★ ${e.stars.toLocaleString("en-US")}`,
      license: e.license ?? c.red("none"),
      desc: e.description,
    };
  });

  const widths = {
    verdict: Math.max(...rows.map((r) => stripAnsi(r.verdict).length)),
    repo: Math.max(...rows.map((r) => r.repo.length)),
    stars: Math.max(...rows.map((r) => r.stars.length)),
    license: Math.max(...rows.map((r) => stripAnsi(r.license).length)),
  };

  const out: string[] = [""];
  for (const r of rows) {
    out.push(
      `  ${r.verdict.padEnd(widths.verdict + (r.verdict.length - stripAnsi(r.verdict).length))}  ` +
        `${r.repo.padEnd(widths.repo + (c.bold("").length ? 0 : 0))}  ` +
        `${r.stars.padEnd(widths.stars)}  ` +
        `${r.license.padEnd(widths.license + (r.license.length - stripAnsi(r.license).length))}  ` +
        c.dim(truncate(r.desc, 44)),
    );
  }
  out.push("");
  out.push(
    c.dim(
      `  ${entries.length} entr(ies). Full list: https://github.com/Vortexeddev/skillcheck#registry`,
    ),
  );
  out.push(c.dim("  Check any repo yourself:  npx skillcheck check owner/repo"));
  out.push("");
  return out.join("\n");
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export { c, wrap, truncate, stripAnsi };
export type { Verdict };
