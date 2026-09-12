/**
 * Turns raw repo + skill data into a verdict you can act on.
 */

import { resolveLicense, type Category, type ResolvedLicense } from "./spdx.js";
import type { Issue, ValidationResult } from "./frontmatter.js";

export type Verdict = "pass" | "review" | "fail";

export interface LicenseFinding {
  /** What GitHub / the LICENSE file told us. `null` means nothing was declared. */
  declared: string | null;
  resolved: ResolvedLicense | null;
  category: Category | "none";
  /** Whether a human must read the file before shipping. */
  needsReview: boolean;
  headline: string;
  note: string;
}

export interface HealthSignals {
  stars: number;
  forks: number;
  openIssues: number;
  /** ISO date of the last push, or null. */
  pushedAt: string | null;
  /** Days since last push, or null when unknown. */
  daysSincePush: number | null;
  archived: boolean;
  hasReadme: boolean;
  hasLicenseFile: boolean;
}

export interface SkillCheckReport {
  /** owner/repo */
  repo: string;
  url: string;
  verdict: Verdict;
  license: LicenseFinding;
  /** Spec validation of the repo's SKILL.md files, when we could read them. */
  skills: {
    scanned: number;
    valid: number;
    issues: Issue[];
  } | null;
  health: HealthSignals | null;
  /** Every reason behind the verdict, in priority order. */
  reasons: string[];
}

const STALE_DAYS = 365;

/**
 * Build the license finding.
 *
 * @param spdxId    GitHub's detected SPDX id, or "NOASSERTION" when it could not
 *                  classify the file, or null/empty when there is no LICENSE at all.
 * @param hasLicenseFile  whether a LICENSE-ish file exists in the repo root.
 */
export function analyseLicense(spdxId: string | null | undefined, hasLicenseFile: boolean): LicenseFinding {
  const declared = spdxId && spdxId.trim() !== "" ? spdxId.trim() : null;

  // Case 1: no LICENSE file at all.
  // Under copyright law, no license = all rights reserved. This is the single most
  // common and most expensive mistake in the agent-skills ecosystem.
  if (!declared && !hasLicenseFile) {
    return {
      declared: null,
      resolved: null,
      category: "none",
      needsReview: false,
      headline: "NO LICENSE",
      note:
        "No LICENSE file found. With no license, copyright law defaults to ALL RIGHTS RESERVED — " +
        "legally you may not copy, modify, redistribute or sell this, even though it is public on GitHub.",
    };
  }

  // Case 2: a LICENSE file exists but GitHub could not classify it.
  if (!declared || declared.toUpperCase() === "NOASSERTION" || declared.toUpperCase() === "OTHER") {
    return {
      declared: declared ?? null,
      resolved: null,
      category: "unknown",
      needsReview: true,
      headline: declared ? "CUSTOM / UNCLASSIFIED LICENSE" : "LICENSE FILE, UNKNOWN TERMS",
      note:
        "A LICENSE file exists but its terms are not a recognised SPDX license. " +
        "Read it before shipping — it may restrict commercial use.",
    };
  }

  // Case 3: a recognisable SPDX expression.
  let resolved: ResolvedLicense;
  try {
    resolved = resolveLicense(declared);
  } catch {
    return {
      declared,
      resolved: null,
      category: "unknown",
      needsReview: true,
      headline: "UNPARSEABLE LICENSE EXPRESSION",
      note: `Could not parse \`${declared}\`. Check it by hand.`,
    };
  }

  const category = resolved.worstCategory;
  const info = resolved.infos[0]!;

  // An OR expression means the user gets to pick the friendliest branch.
  const headline =
    resolved.hasChoice && resolved.bestCategory !== resolved.worstCategory
      ? `${resolved.bestCategory.toUpperCase().replace("-", " ")} OPTION AVAILABLE (${declared})`
      : declared.toUpperCase();

  let note = resolved.infos.map((i) => i.note).join(" ");
  if (resolved.hasChoice) {
    note +=
      " This is an OR expression: you may choose the most permissive branch that fits your use.";
  }

  return {
    declared,
    resolved,
    category,
    needsReview: category === "unknown" || category === "source-available",
    headline,
    note: note || info.note,
  };
}

export function computeHealth(input: {
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string | null;
  archived: boolean;
  hasReadme: boolean;
  hasLicenseFile: boolean;
  now?: Date;
}): HealthSignals {
  const now = input.now ?? new Date();
  let daysSincePush: number | null = null;
  if (input.pushedAt) {
    const then = new Date(input.pushedAt).getTime();
    if (!Number.isNaN(then)) {
      daysSincePush = Math.max(0, Math.round((now.getTime() - then) / 86_400_000));
    }
  }
  return {
    stars: input.stars,
    forks: input.forks,
    openIssues: input.openIssues,
    pushedAt: input.pushedAt,
    daysSincePush,
    archived: input.archived,
    hasReadme: input.hasReadme,
    hasLicenseFile: input.hasLicenseFile,
  };
}

/**
 * Combine everything into a verdict.
 *
 * Priority: legal blocker first, then spec validity, then health. A repo with 100k
 * stars and no license still FAILS — popularity does not grant rights.
 */
export function decide(input: {
  repo: string;
  /** Where the report points. Omit for local checkouts, which have no URL. */
  url?: string;
  license: LicenseFinding;
  validation: ValidationResult | null;
  skillsScanned: number;
  health: HealthSignals | null;
}): SkillCheckReport {
  const reasons: string[] = [];
  const { license, validation, health } = input;

  let verdict: Verdict = "pass";

  // --- legal ---------------------------------------------------------------
  if (license.category === "none") {
    verdict = "fail";
    reasons.push("No license: all rights reserved by default. You cannot legally use this.");
  } else if (license.needsReview) {
    if (verdict === "pass") verdict = "review";
    reasons.push(`License terms need a human read (${license.headline}).`);
  } else if (license.category === "copyleft-strong") {
    if (verdict === "pass") verdict = "review";
    reasons.push("Strong copyleft: distributing a derivative can force you to open your own source.");
  } else if (license.category === "copyleft-weak") {
    if (verdict === "pass") verdict = "review";
    reasons.push("Weak copyleft: fine to link, but modifications to the licensed files must be shared.");
  } else {
    reasons.push(`License is ${license.category}: safe for commercial use.`);
  }

  // --- spec ----------------------------------------------------------------
  if (validation) {
    if (!validation.valid) {
      verdict = "fail";
      reasons.push(
        `${validation.errors.length} spec error(s) in SKILL.md: ` +
          validation.errors.map((e) => e.code).join(", "),
      );
    } else if (validation.warnings.length > 0) {
      if (verdict === "pass") verdict = "review";
      reasons.push(`${validation.warnings.length} spec warning(s) worth fixing.`);
    } else {
      reasons.push("SKILL.md is valid against the Agent Skills spec.");
    }
  }

  // --- health --------------------------------------------------------------
  if (health) {
    if (health.archived) {
      if (verdict === "pass") verdict = "review";
      reasons.push("Repository is archived: no more updates or security fixes.");
    }
    if (health.daysSincePush !== null && health.daysSincePush > STALE_DAYS) {
      if (verdict === "pass") verdict = "review";
      reasons.push(`No pushes in ${health.daysSincePush} days — likely unmaintained.`);
    }
  }

  return {
    repo: input.repo,
    url: input.url ?? `https://github.com/${input.repo}`,
    verdict,
    license,
    skills: validation
      ? {
          scanned: input.skillsScanned,
          valid: validation.validCount,
          issues: [...validation.errors, ...validation.warnings],
        }
      : null,
    health,
    reasons,
  };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  pass: "SAFE TO SHIP",
  review: "NEEDS REVIEW",
  fail: "DO NOT SHIP",
};
