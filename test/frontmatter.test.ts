import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isValidSkillName, parseFrontmatter, validateSkill } from "../src/frontmatter.ts";

describe("parseFrontmatter", () => {
  it("extracts simple key/value pairs", () => {
    const r = parseFrontmatter(`---
name: my-skill
description: Does a thing. Use when testing.
---

# Body
`);
    assert.equal(r.hasFrontmatter, true);
    assert.equal(r.frontmatter?.name, "my-skill");
    assert.match(r.body, /# Body/);
  });

  it("strips surrounding quotes", () => {
    const r = parseFrontmatter(`---
name: "quoted-skill"
description: 'single quoted'
---
body`);
    assert.equal(r.frontmatter?.name, "quoted-skill");
    assert.equal(r.frontmatter?.description, "single quoted");
  });

  it("parses a nested metadata mapping into an object", () => {
    const r = parseFrontmatter(`---
name: s
description: d
metadata:
  author: someone
  version: "1.0"
---
body`);
    assert.deepEqual(r.frontmatter?.metadata, { author: "someone", version: "1.0" });
  });

  it("returns hasFrontmatter=false when there is no block", () => {
    const r = parseFrontmatter("# Just markdown\n");
    assert.equal(r.hasFrontmatter, false);
    assert.equal(r.frontmatter, null);
  });

  it("treats an unterminated block as body, not metadata", () => {
    // Silently consuming the file would hide real content from the author.
    const r = parseFrontmatter(`---
name: broken
`);
    assert.equal(r.hasFrontmatter, false);
  });

  it("handles CRLF line endings", () => {
    const r = parseFrontmatter("---\r\nname: crlf\r\ndescription: d\r\n---\r\nbody");
    assert.equal(r.frontmatter?.name, "crlf");
  });
});

describe("isValidSkillName", () => {
  it("accepts spec-compliant names", () => {
    for (const n of ["pdf", "pdf-tools", "a1-b2", "x"]) assert.equal(isValidSkillName(n), true, n);
  });

  it("rejects the exact invalid forms from the spec", () => {
    for (const n of ["PDF-Processing", "-pdf", "pdf-", "pdf--processing", ""]) {
      assert.equal(isValidSkillName(n), false, n);
    }
  });

  it("rejects names over 64 characters", () => {
    assert.equal(isValidSkillName("a".repeat(65)), false);
    assert.equal(isValidSkillName("a".repeat(64)), true);
  });
});

describe("validateSkill", () => {
  const good = `---
name: good-skill
description: Extracts data from PDFs. Use when the user mentions PDF extraction or forms.
---

# Good Skill

Do the thing step by step.
`;

  it("accepts a spec-compliant SKILL.md", () => {
    const r = validateSkill(parseFrontmatter(good), "good-skill");
    assert.equal(r.valid, true, JSON.stringify(r.errors));
    assert.equal(r.errors.length, 0);
    assert.equal(r.warnings.length, 0);
  });

  it("errors when frontmatter is missing entirely", () => {
    const r = validateSkill(parseFrontmatter("# No frontmatter\n"), "x");
    assert.equal(r.valid, false);
    assert.equal(r.errors[0]?.code, "no-frontmatter");
  });

  it("errors on a missing name", () => {
    const src = `---
description: Does a thing. Use when testing things in the repository.
---
body`;
    const r = validateSkill(parseFrontmatter(src), "some-dir");
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.code === "missing-name"));
  });

  it("errors when name does not match its directory", () => {
    const r = validateSkill(parseFrontmatter(good), "different-dir");
    assert.ok(r.errors.some((e) => e.code === "name-dir-mismatch"));
  });

  it("errors when description exceeds 1024 characters", () => {
    const src = `---
name: long-desc
description: ${"x".repeat(1025)}
---
body`;
    const r = validateSkill(parseFrontmatter(src), "long-desc");
    assert.ok(r.errors.some((e) => e.code === "description-too-long"));
  });

  it("warns when description has no trigger phrase", () => {
    const src = `---
name: no-trigger
description: A reasonably long description of what this skill does for the user.
---
body`;
    const r = validateSkill(parseFrontmatter(src), "no-trigger");
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => w.code === "description-no-trigger"));
  });

  it("warns about non-spec top-level fields and suggests metadata", () => {
    const src = `---
name: extra
description: Does things. Use when the user asks for extra behaviour.
author: me
---
body`;
    const r = validateSkill(parseFrontmatter(src), "extra");
    const w = r.warnings.find((x) => x.code === "unknown-field");
    assert.ok(w);
    assert.match(w!.message, /metadata/);
  });

  it("errors on an empty body", () => {
    const src = `---
name: empty
description: Does things. Use when the user asks for empty behaviour in tests.
---
`;
    const r = validateSkill(parseFrontmatter(src), "empty");
    assert.ok(r.errors.some((e) => e.code === "empty-body"));
  });

  it("warns when the body exceeds the recommended 500 lines", () => {
    const src =
      `---\nname: big\ndescription: Big skill. Use when the user needs a very long reference body here.\n---\n` +
      "line\n".repeat(501);
    const r = validateSkill(parseFrontmatter(src), "big");
    assert.ok(r.warnings.some((w) => w.code === "body-too-long"));
  });
});
