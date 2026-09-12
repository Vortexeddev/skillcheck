/**
 * Frontmatter parsing and Agent Skills spec validation.
 *
 * Rules come from https://agentskills.io/specification (fetched 2026-09).
 * A skill is a directory with a SKILL.md containing YAML frontmatter.
 */

export interface Frontmatter {
  name?: unknown;
  description?: unknown;
  license?: unknown;
  compatibility?: unknown;
  "allowed-tools"?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface ParsedSkillFile {
  /** Raw frontmatter block, or null when the file has none. */
  frontmatter: Frontmatter | null;
  /** The markdown body after the frontmatter. */
  body: string;
  /** True when a `---` delimited block was present at the top. */
  hasFrontmatter: boolean;
}

/**
 * Minimal YAML-subset parser.
 *
 * We only need flat `key: value` pairs plus the `metadata:` mapping, which is what
 * the spec allows. Pulling in a full YAML parser would triple the install size of
 * `npx @vortexeddev/skillcheck` for no practical gain. Nested structures we do not understand
 * are preserved as raw text so nothing is silently dropped.
 */
export function parseFrontmatter(source: string): ParsedSkillFile {
  const normalised = source.replace(/\r\n/g, "\n");

  if (!normalised.startsWith("---")) {
    return { frontmatter: null, body: normalised, hasFrontmatter: false };
  }

  const lines = normalised.split("\n");
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "---" || line === "...") {
      end = i;
      break;
    }
  }

  if (end === -1) {
    // Unterminated frontmatter — treat the whole file as body so we do not
    // mis-report content as metadata.
    return { frontmatter: null, body: normalised, hasFrontmatter: false };
  }

  const fm: Frontmatter = {};
  const rawLines = lines.slice(1, end);
  let currentKey: string | null = null;
  let currentIndent = -1;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey === null) return;
    const text = buffer.join("\n").trim();
    // Try to keep nested maps as a real object when every line is `k: v`.
    const nested: Record<string, string> = {};
    let allPairs = true;
    for (const raw of buffer) {
      const m = /^\s*([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(raw);
      if (!m) {
        allPairs = false;
        break;
      }
      nested[m[1]!] = stripQuotes(m[2]!.trim());
    }
    if (allPairs && buffer.length > 0 && Object.keys(nested).length > 0) {
      fm[currentKey] = nested;
    } else {
      fm[currentKey] = stripQuotes(text);
    }
    currentKey = null;
    buffer = [];
  };

  for (const raw of rawLines) {
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;

    const indent = raw.length - raw.trimStart().length;
    const topLevel = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(raw);

    if (indent === 0 && topLevel) {
      flush();
      const key = topLevel[1]!;
      const value = topLevel[2]!.trim();
      if (value === "") {
        currentKey = key;
        currentIndent = 0;
        buffer = [];
      } else {
        fm[key] = stripQuotes(value);
      }
    } else if (currentKey !== null && indent > currentIndent) {
      buffer.push(raw);
    }
    // Lines we cannot place are ignored deliberately.
  }
  flush();

  return {
    frontmatter: fm,
    body: lines.slice(end + 1).join("\n"),
    hasFrontmatter: true,
  };
}

function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

// ---------------------------------------------------------------------------
// Spec validation
// ---------------------------------------------------------------------------

export type IssueLevel = "error" | "warn";

export interface Issue {
  level: IssueLevel;
  /** Stable machine-readable code, used by the GitHub Action annotations. */
  code: string;
  message: string;
  /** Spec link fragment so the author can fix it without guessing. */
  spec?: string;
}

export interface ValidationResult {
  valid: boolean;
  /** How many of the scanned files passed without errors. */
  validCount: number;
  errors: Issue[];
  warnings: Issue[];
  /** Number of lines in SKILL.md, used for the "keep it under 500 lines" rule. */
  bodyLines: number;
}

const SPEC_URL = "https://agentskills.io/specification";

/** `name` must be lowercase alnum + hyphen, no leading/trailing/double hyphen, <=64. */
export function isValidSkillName(name: string): boolean {
  if (name.length === 0 || name.length > 64) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

/**
 * Validate a parsed SKILL.md against the Agent Skills spec.
 *
 * @param parsed  result of parseFrontmatter()
 * @param dirName the name of the directory the SKILL.md lives in (spec requires a match)
 */
export function validateSkill(parsed: ParsedSkillFile, dirName?: string): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  if (!parsed.hasFrontmatter) {
    errors.push({
      level: "error",
      code: "no-frontmatter",
      message: "SKILL.md has no YAML frontmatter block. Agents will not load this skill.",
      spec: SPEC_URL + "#frontmatter",
    });
    return { valid: false, validCount: 0, errors, warnings, bodyLines: 0 };
  }

  const fm = parsed.frontmatter ?? {};

  // --- name ---------------------------------------------------------------
  const name = fm.name;
  if (typeof name !== "string" || name.trim() === "") {
    errors.push({
      level: "error",
      code: "missing-name",
      message: "Frontmatter is missing the required `name` field.",
      spec: SPEC_URL + "#name-field",
    });
  } else {
    if (!isValidSkillName(name)) {
      errors.push({
        level: "error",
        code: "invalid-name",
        message:
          `\`name: ${name}\` is invalid. Use lowercase letters, numbers and single hyphens; ` +
          "max 64 chars; no leading/trailing/double hyphen.",
        spec: SPEC_URL + "#name-field",
      });
    }
    if (dirName && name !== dirName) {
      errors.push({
        level: "error",
        code: "name-dir-mismatch",
        message: `\`name: ${name}\` does not match its directory \`${dirName}\`. The spec requires them to match.`,
        spec: SPEC_URL + "#name-field",
      });
    }
  }

  // --- description --------------------------------------------------------
  const description = fm.description;
  if (typeof description !== "string" || description.trim() === "") {
    errors.push({
      level: "error",
      code: "missing-description",
      message: "Frontmatter is missing the required `description` field.",
      spec: SPEC_URL + "#description-field",
    });
  } else {
    if (description.length > 1024) {
      errors.push({
        level: "error",
        code: "description-too-long",
        message: `\`description\` is ${description.length} chars; the spec caps it at 1024.`,
        spec: SPEC_URL + "#description-field",
      });
    }
    if (description.trim().length < 40) {
      warnings.push({
        level: "warn",
        code: "description-too-vague",
        message:
          "`description` is very short. It should say what the skill does AND when to use it — " +
          "that text is the only thing loaded at startup.",
        spec: SPEC_URL + "#description-field",
      });
    }
    if (!/\b(use|when|when to|whenever)\b/i.test(description)) {
      warnings.push({
        level: "warn",
        code: "description-no-trigger",
        message:
          "`description` has no trigger phrase like \"Use when ...\". Agents pick skills on this text.",
        spec: SPEC_URL + "#description-field",
      });
    }
  }

  // --- compatibility ------------------------------------------------------
  const compatibility = fm.compatibility;
  if (typeof compatibility === "string" && compatibility.length > 500) {
    errors.push({
      level: "error",
      code: "compatibility-too-long",
      message: `\`compatibility\` is ${compatibility.length} chars; the spec caps it at 500.`,
      spec: SPEC_URL + "#compatibility-field",
    });
  }

  // --- metadata -----------------------------------------------------------
  const metadata = fm.metadata;
  if (metadata !== undefined && metadata !== null) {
    if (typeof metadata !== "object" || Array.isArray(metadata)) {
      errors.push({
        level: "error",
        code: "metadata-not-a-map",
        message: "`metadata` must be a mapping of string keys to string values.",
        spec: SPEC_URL + "#metadata-field",
      });
    } else {
      for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
        if (typeof v !== "string") {
          warnings.push({
            level: "warn",
            code: "metadata-non-string",
            message: `\`metadata.${k}\` should be a string value (got ${typeof v}).`,
            spec: SPEC_URL + "#metadata-field",
          });
        }
      }
    }
  }

  // --- unknown fields -----------------------------------------------------
  const KNOWN = new Set([
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
  ]);
  for (const key of Object.keys(fm)) {
    if (!KNOWN.has(key)) {
      warnings.push({
        level: "warn",
        code: "unknown-field",
        message:
          `\`${key}\` is not part of the Agent Skills spec. It will be ignored by agents — ` +
          "move it under `metadata:` to keep it.",
        spec: SPEC_URL + "#frontmatter",
      });
    }
  }

  // --- body ---------------------------------------------------------------
  const body = parsed.body.trim();
  const bodyLines = parsed.body.split("\n").length;

  if (body.length === 0) {
    errors.push({
      level: "error",
      code: "empty-body",
      message: "SKILL.md has no instruction body. There is nothing for the agent to do.",
      spec: SPEC_URL + "#body-content",
    });
  }
  if (bodyLines > 500) {
    warnings.push({
      level: "warn",
      code: "body-too-long",
      message:
        `SKILL.md is ${bodyLines} lines. The spec recommends under 500 — move detail into ` +
        "`references/` so it is only loaded on demand.",
      spec: SPEC_URL + "#progressive-disclosure",
    });
  }

  return {
    valid: errors.length === 0,
    validCount: errors.length === 0 ? 1 : 0,
    errors,
    warnings,
    bodyLines,
  };
}
