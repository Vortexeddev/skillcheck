import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyId, parseExpression, resolveLicense } from "../src/spdx.ts";

describe("classifyId", () => {
  it("classifies MIT as permissive", () => {
    assert.equal(classifyId("MIT").category, "permissive");
  });

  it("classifies Apache-2.0 as permissive", () => {
    assert.equal(classifyId("Apache-2.0").category, "permissive");
  });

  it("classifies CC0 and Unlicense as permissive", () => {
    assert.equal(classifyId("CC0-1.0").category, "permissive");
    assert.equal(classifyId("Unlicense").category, "permissive");
  });

  it("classifies AGPL as strong copyleft, not merely copyleft", () => {
    assert.equal(classifyId("AGPL-3.0-only").category, "copyleft-strong");
    assert.equal(classifyId("AGPL-3.0-or-later").category, "copyleft-strong");
  });

  it("classifies GPL as strong copyleft", () => {
    assert.equal(classifyId("GPL-3.0-only").category, "copyleft-strong");
    assert.equal(classifyId("GPL-2.0-or-later").category, "copyleft-strong");
  });

  it("classifies LGPL as WEAK copyleft, distinct from GPL", () => {
    // Regression guard: a naive /^(gpl|lgpl)/ alternation would swallow LGPL into
    // strong copyleft and over-warn users.
    assert.equal(classifyId("LGPL-3.0-only").category, "copyleft-weak");
    assert.equal(classifyId("LGPL-2.1-or-later").category, "copyleft-weak");
  });

  it("classifies MPL as weak copyleft", () => {
    assert.equal(classifyId("MPL-2.0").category, "copyleft-weak");
  });

  it("flags non-commercial CC as source-available (the one that bites people)", () => {
    assert.equal(classifyId("CC-BY-NC-4.0").category, "source-available");
    assert.equal(classifyId("CC-BY-NC-SA-4.0").category, "source-available");
  });

  it("flags BUSL as source-available", () => {
    assert.equal(classifyId("BUSL-1.1").category, "source-available");
  });

  it("is case-insensitive and ignores a trailing +", () => {
    assert.equal(classifyId("mit").category, "permissive");
    assert.equal(classifyId("Apache-2.0+").category, "permissive");
  });

  it("returns unknown for unrecognised ids rather than guessing permissive", () => {
    const info = classifyId("SomeCorp-Internal-1.0");
    assert.equal(info.category, "unknown");
    assert.match(info.note, /Read the LICENSE/);
  });
});

describe("parseExpression", () => {
  it("parses a bare id", () => {
    assert.deepEqual(parseExpression("MIT"), { kind: "id", id: "MIT" });
  });

  it("parses WITH exceptions", () => {
    const ast = parseExpression("Apache-2.0 WITH LLVM-exception");
    assert.deepEqual(ast, {
      kind: "id",
      id: "Apache-2.0",
      exception: "LLVM-exception",
    });
  });

  it("parses OR", () => {
    const ast = parseExpression("MIT OR Apache-2.0");
    assert.equal(ast.kind, "or");
  });

  it("parses nested parentheses", () => {
    const ast = parseExpression("(MIT OR Apache-2.0) AND BSD-3-Clause");
    assert.equal(ast.kind, "and");
  });

  it("throws on unbalanced parentheses", () => {
    assert.throws(() => parseExpression("(MIT OR Apache-2.0"));
  });

  it("throws on trailing garbage", () => {
    assert.throws(() => parseExpression("MIT Apache-2.0"));
  });

  it("throws on empty input", () => {
    assert.throws(() => parseExpression("   "));
  });
});

describe("resolveLicense", () => {
  it("reports a single permissive license as safe", () => {
    const r = resolveLicense("MIT");
    assert.equal(r.worstCategory, "permissive");
    assert.equal(r.bestCategory, "permissive");
    assert.equal(r.hasChoice, false);
    assert.deepEqual(r.ids, ["MIT"]);
  });

  it("marks an OR expression as offering a choice", () => {
    const r = resolveLicense("MIT OR AGPL-3.0-only");
    assert.equal(r.hasChoice, true);
    // Worst case is still strong copyleft — we must not hide it.
    assert.equal(r.worstCategory, "copyleft-strong");
    assert.equal(r.bestCategory, "permissive");
  });

  it("treats AND as cumulative: worst branch wins", () => {
    const r = resolveLicense("MIT AND AGPL-3.0-only");
    assert.equal(r.hasChoice, false);
    assert.equal(r.worstCategory, "copyleft-strong");
  });

  it("collects every id in a compound expression", () => {
    const r = resolveLicense("(MIT OR Apache-2.0) AND BSD-3-Clause");
    assert.deepEqual(r.ids.sort(), ["Apache-2.0", "BSD-3-Clause", "MIT"]);
  });

  it("keeps an unrecognised id as unknown rather than dropping it", () => {
    const r = resolveLicense("MIT AND WeirdLicense-1.0");
    assert.equal(r.worstCategory, "unknown");
    assert.deepEqual(r.ids, ["MIT", "WeirdLicense-1.0"]);
  });
});
