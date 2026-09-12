/**
 * Builds data/registry.json from the live GitHub API.
 *
 * This is what makes the project a living directory instead of a hand-curated
 * awesome-list: re-run it on a schedule (see .github/workflows/registry.yml) and
 * the registry tracks the ecosystem automatically.
 *
 *   GITHUB_TOKEN=... npm run registry:build
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { analyseLicense } from "../src/analyzer.ts";
import { fetchRootEntries, findLicenseFile } from "../src/github.ts";
import type { RegistryEntry } from "../src/types.ts";

const QUERIES = [
  { q: "topic:agent-skills", perPage: 100 },
  { q: "topic:claude-skills", perPage: 100 },
  { q: "topic:agent-skills stars:>50", perPage: 100 },
];

const MAX_ENTRIES = 400;
const RATE_PAUSE_MS = 700; // stay well under the unauthenticated 60 req/hour budget

/**
 * `--fast` builds the registry from the search results alone (3 API calls total).
 *
 * Without a token GitHub allows only 60 core requests/hour, so verifying a LICENSE
 * file per repository is impossible locally. CI runs the full pass with a token;
 * `--fast` is what a contributor without a token can reproduce.
 *
 * The trade-off: GitHub reports `license: null` both when there is no license AND
 * when it could not classify a custom one. In fast mode we cannot tell those apart,
 * so both land in the `needsReview` bucket rather than being called "no license".
 */
const FAST = process.argv.includes("--fast");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../data/registry.ts");

interface GhItem {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  license: { spdx_id?: string | null } | null;
  pushed_at: string | null;
  archived: boolean;
  topics?: string[];
  html_url: string;
}

async function search(query: string, perPage: number): Promise<GhItem[]> {
  const url =
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}` +
    `&sort=stars&order=desc&per_page=${perPage}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "skillcheck-registry-builder",
      ...(process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub search failed ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { items: GhItem[] };
  return data.items ?? [];
}

/**
 * Skip list directories. They are not skills you install; including them would
 * make the registry useless as an install guide.
 */
function isListRepo(repo: GhItem): boolean {
  const name = repo.full_name.toLowerCase();
  const desc = (repo.description ?? "").toLowerCase();
  return (
    /awesome|curated|directory|collection|list of/.test(name) ||
    /^a curated list/.test(desc) ||
    /curated (list|collection)/.test(desc)
  );
}

async function main(): Promise<void> {
  const byName = new Map<string, GhItem>();

  for (const { q, perPage } of QUERIES) {
    process.stderr.write(`searching: ${q}\n`);
    const items = await search(q, perPage);
    for (const item of items) {
      if (!byName.has(item.full_name)) byName.set(item.full_name, item);
    }
    await sleep(RATE_PAUSE_MS);
  }

  const candidates = [...byName.values()]
    .filter((r) => !isListRepo(r) && !r.archived)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, MAX_ENTRIES);

  process.stderr.write(`analysing ${candidates.length} repositories\n`);

  const entries: RegistryEntry[] = [];
  let noLicense = 0;
  let unclassified = 0;
  let checkedFiles = 0;

  for (const repo of candidates) {
    // Confirm whether a LICENSE file actually exists — GitHub's `license` field is
    // null both when there is no license AND when it could not classify one.
    let hasLicenseFile: boolean;
    let verified: boolean;

    if (FAST) {
      hasLicenseFile = Boolean(repo.license?.spdx_id);
      verified = false;
    } else {
      try {
        const root = await fetchRootEntries(repo.full_name);
        hasLicenseFile = findLicenseFile(root) !== null;
        verified = true;
        checkedFiles++;
      } catch {
        // Rate limited or private: fall back to the API's answer.
        hasLicenseFile = Boolean(repo.license?.spdx_id);
        verified = false;
      }
      await sleep(RATE_PAUSE_MS);
    }

    const finding = analyseLicense(repo.license?.spdx_id, hasLicenseFile);

    if (finding.category === "none") noLicense++;
    if (finding.category === "unknown") unclassified++;

    const verdict: RegistryEntry["verdict"] =
      finding.category === "permissive" ? "pass" : finding.category === "none" ? "fail" : "review";

    entries.push({
      repo: repo.full_name,
      description: repo.description ?? "",
      stars: repo.stargazers_count,
      license: repo.license?.spdx_id ?? null,
      category: finding.category,
      verdict,
      verified,
      pushedAt: repo.pushed_at,
      topics: repo.topics ?? [],
    });
  }

  const payload = {
    generated: new Date().toISOString().slice(0, 10),
    mode: FAST ? "fast" : "verified",
    stats: {
      total: entries.length,
      noLicense,
      unclassified,
      permissive: entries.filter((e) => e.category === "permissive").length,
      licenseFilesChecked: checkedFiles,
    },
    entries,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  // Emitted as a TypeScript module rather than JSON: it lets the bundler inline the
  // registry into the CLI with no runtime file lookup and no JSON import attributes,
  // so `tsup`, `tsx` and `tsc` all agree.
  const body =
    "// Generated by scripts/build-registry.ts — DO NOT EDIT BY HAND.\n" +
    "// Rebuild with:  npm run registry:build\n" +
    `export const REGISTRY = ${JSON.stringify(payload, null, 2)} as const;\n`;

  fs.writeFileSync(OUT, body);

  const pct = (n: number) => ((n / entries.length) * 100).toFixed(1) + "%";
  process.stderr.write(
    `\nwrote ${OUT}  [mode: ${payload.mode}]\n` +
      `  entries:      ${entries.length}\n` +
      `  permissive:   ${payload.stats.permissive} (${pct(payload.stats.permissive)})\n` +
      `  no license:   ${noLicense} (${pct(noLicense)})\n` +
      `  unclassified: ${unclassified} (${pct(unclassified)})\n` +
      `  files checked: ${checkedFiles}\n`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  process.stderr.write(`registry build failed: ${(err as Error).message}\n`);
  process.exit(1);
});
