import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyseLicense, computeHealth, decide } from "../src/analyzer.ts";

const noIssues = { valid: true, validCount: 1, errors: [], warnings: [], bodyLines: 10 };

describe("analyseLicense", () => {
  it("fails hard when there is no LICENSE file at all", () => {
    const f = analyseLicense(null, false);
    assert.equal(f.category, "none");
    assert.equal(f.headline, "NO LICENSE");
    assert.match(f.note, /ALL RIGHTS RESERVED/i);
    // This must NOT ask for human review — there is nothing to review.
    assert.equal(f.needsReview, false);
  });

  it("asks for review when a LICENSE exists but is unclassified (NOASSERTION)", () => {
    const f = analyseLicense("NOASSERTION", true);
    assert.equal(f.category, "unknown");
    assert.equal(f.needsReview, true);
  });

  it("distinguishes 'no license' from 'custom license'", () => {
    // GitHub reports license:null in BOTH cases; only the file listing separates them.
    // This is the distinction the whole tool exists to surface.
    const none = analyseLicense(null, false);
    const custom = analyseLicense(null, true);
    assert.equal(none.category, "none");
    assert.equal(custom.category, "unknown");
    assert.notEqual(none.category, custom.category);
  });

  it("resolves a permissive SPDX id", () => {
    const f = analyseLicense("MIT", true);
    assert.equal(f.category, "permissive");
    assert.equal(f.needsReview, false);
  });

  it("flags AGPL as needing review, not as safe", () => {
    const f = analyseLicense("AGPL-3.0-only", true);
    assert.equal(f.category, "copyleft-strong");
  });

  it("surfaces the permissive choice in an OR expression", () => {
    const f = analyseLicense("MIT OR AGPL-3.0-only", true);
    assert.match(f.headline, /PERMISSIVE OPTION AVAILABLE/i);
    assert.match(f.note, /you may choose the most permissive branch/i);
  });

  it("does not crash on an unparseable expression", () => {
    const f = analyseLicense("(MIT", true);
    assert.equal(f.category, "unknown");
    assert.equal(f.needsReview, true);
  });
});

describe("computeHealth", () => {
  it("computes days since last push", () => {
    const now = new Date("2026-09-12T00:00:00Z");
    const h = computeHealth({
      stars: 10,
      forks: 1,
      openIssues: 0,
      pushedAt: "2026-08-13T00:00:00Z",
      archived: false,
      hasReadme: true,
      hasLicenseFile: true,
      now,
    });
    assert.equal(h.daysSincePush, 30);
  });

  it("tolerates a null pushedAt", () => {
    const h = computeHealth({
      stars: 0,
      forks: 0,
      openIssues: 0,
      pushedAt: null,
      archived: false,
      hasReadme: false,
      hasLicenseFile: false,
    });
    assert.equal(h.daysSincePush, null);
  });
});

describe("decide", () => {
  it("fails on a missing license even with a perfect SKILL.md", () => {
    const report = decide({
      repo: "a/b",
      license: analyseLicense(null, false),
      validation: noIssues,
      skillsScanned: 1,
      health: null,
    });
    assert.equal(report.verdict, "fail");
    assert.match(report.reasons.join(" "), /all rights reserved/i);
  });

  it("passes a MIT repo with a valid SKILL.md", () => {
    const report = decide({
      repo: "a/b",
      license: analyseLicense("MIT", true),
      validation: noIssues,
      skillsScanned: 1,
      health: computeHealth({
        stars: 100,
        forks: 10,
        openIssues: 2,
        pushedAt: new Date().toISOString(),
        archived: false,
        hasReadme: true,
        hasLicenseFile: true,
      }),
    });
    assert.equal(report.verdict, "pass", JSON.stringify(report.reasons));
  });

  it("downgrades to review on strong copyleft", () => {
    const report = decide({
      repo: "a/b",
      license: analyseLicense("AGPL-3.0-only", true),
      validation: noIssues,
      skillsScanned: 1,
      health: null,
    });
    assert.equal(report.verdict, "review");
  });

  it("fails on spec errors even with a permissive license", () => {
    const report = decide({
      repo: "a/b",
      license: analyseLicense("MIT", true),
      validation: {
        valid: false,
        validCount: 0,
        errors: [{ level: "error", code: "missing-name", message: "no name" }],
        warnings: [],
        bodyLines: 5,
      },
      skillsScanned: 1,
      health: null,
    });
    assert.equal(report.verdict, "fail");
  });

  it("downgrades an archived repo from pass to review", () => {
    const report = decide({
      repo: "a/b",
      license: analyseLicense("MIT", true),
      validation: noIssues,
      skillsScanned: 1,
      health: computeHealth({
        stars: 10,
        forks: 0,
        openIssues: 0,
        pushedAt: new Date().toISOString(),
        archived: true,
        hasReadme: true,
        hasLicenseFile: true,
      }),
    });
    assert.equal(report.verdict, "review");
  });

  it("downgrades a stale repo (no push in over a year)", () => {
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const report = decide({
      repo: "a/b",
      license: analyseLicense("MIT", true),
      validation: noIssues,
      skillsScanned: 1,
      health: computeHealth({
        stars: 10,
        forks: 0,
        openIssues: 0,
        pushedAt: old,
        archived: false,
        hasReadme: true,
        hasLicenseFile: true,
      }),
    });
    assert.equal(report.verdict, "review");
    assert.match(report.reasons.join(" "), /400 days/);
  });

  it("always emits at least one reason", () => {
    const report = decide({
      repo: "a/b",
      license: analyseLicense("Apache-2.0", true),
      validation: noIssues,
      skillsScanned: 1,
      health: null,
    });
    assert.ok(report.reasons.length >= 1);
  });
});
