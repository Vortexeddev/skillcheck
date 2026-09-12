/**
 * Minimal GitHub API client. Zero dependencies, uses global fetch (Node 18+).
 *
 * Rate limits: 60 req/hour unauthenticated, 5000/hour with a token. We surface a
 * clear message rather than failing mysteriously, and honour GITHUB_TOKEN /
 * GH_TOKEN when present.
 */

export interface GhRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string | null;
  archived: boolean;
  license: { spdx_id?: string | null; name?: string | null } | null;
  default_branch: string;
  topics?: string[];
}

export interface GhTreeEntry {
  path: string;
  type: "blob" | "tree";
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "skillcheck",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  } catch (err) {
    throw new GitHubError(
      `Network error talking to GitHub: ${(err as Error).message}. ` +
        "If you are offline, use `skillcheck check ./path` on a local checkout instead.",
      0,
    );
  }

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    throw new GitHubError(
      remaining === "0"
        ? "GitHub API rate limit exhausted (60/hour unauthenticated). " +
          "Set GITHUB_TOKEN to raise it to 5000/hour: `export GITHUB_TOKEN=ghp_...`"
        : `GitHub refused the request (HTTP ${res.status}).`,
      res.status,
    );
  }
  if (res.status === 404) {
    throw new GitHubError(
      `Repository not found: ${url}\n` +
        "  Check the spelling, or the repo may be private. For a private repo, set " +
        "GITHUB_TOKEN first.",
      404,
    );
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub API error ${res.status} for ${url}`, res.status);
  }
  return (await res.json()) as T;
}

export function parseRepoInput(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, "");

  // owner/repo
  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) return trimmed;

  // https://github.com/owner/repo (with optional /tree/...)
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i.exec(trimmed);
  if (m) return `${m[1]}/${m[2]}`;

  // git@github.com:owner/repo.git
  const ssh = /^git@github\.com:([\w.-]+)\/([\w.-?]+?)(?:\.git)?$/.exec(trimmed);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;

  return null;
}

export async function fetchRepo(repo: string): Promise<GhRepo> {
  return gh<GhRepo>(`/repos/${repo}`);
}

/** Root-level file listing, used to detect LICENSE / README without a full tree walk. */
export async function fetchRootEntries(repo: string): Promise<GhTreeEntry[]> {
  const data = await gh<{ name: string; type: string }[]>(`/repos/${repo}/contents/`);
  return data.map((e) => ({ path: e.name, type: e.type === "dir" ? "tree" : "blob" }));
}

/** Recursive tree, used to find SKILL.md files. Falls back to null on failure. */
export async function fetchTree(repo: string, ref: string): Promise<GhTreeEntry[] | null> {
  try {
    const data = await gh<{ tree: { path: string; type: string }[]; truncated: boolean }>(
      `/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    );
    return data.tree.map((e) => ({ path: e.path, type: e.type === "tree" ? "tree" : "blob" }));
  } catch {
    return null;
  }
}

export async function fetchRawText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "skillcheck" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const LICENSE_NAMES = /^licen[cs]e(\..+)?$/i;
const README_NAMES = /^readme(\..+)?$/i;

export function findLicenseFile(entries: GhTreeEntry[]): string | null {
  const root = entries.filter((e) => e.type === "blob");
  return root.find((e) => LICENSE_NAMES.test(e.path))?.path ?? null;
}

export function hasReadme(entries: GhTreeEntry[]): boolean {
  return entries.some((e) => e.type === "blob" && README_NAMES.test(e.path));
}

/**
 * Pick the most representative SKILL.md paths from a tree.
 *
 * We cap the number we download: a repo like anthropics/skills has dozens, and we
 * only need enough to judge whether the author follows the spec.
 */
export function selectSkillFiles(tree: GhTreeEntry[], limit = 5): string[] {
  const skillMds = tree
    .filter((e) => e.type === "blob" && /(^|\/)SKILL\.md$/i.test(e.path))
    .map((e) => e.path);

  // Prefer the shallowest paths — top-level skills are the canonical ones.
  skillMds.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  return skillMds.slice(0, limit);
}

export function rawUrl(repo: string, ref: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo}/${ref}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
