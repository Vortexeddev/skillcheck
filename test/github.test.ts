import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectSpdxFromText } from "../src/license-sniff.ts";
import {
  findLicenseFile,
  hasReadme,
  parseRepoInput,
  rawUrl,
  selectSkillFiles,
} from "../src/github.ts";

describe("parseRepoInput", () => {
  it("accepts owner/repo shorthand", () => {
    assert.equal(parseRepoInput("anthropics/skills"), "anthropics/skills");
  });

  it("accepts an https URL", () => {
    assert.equal(
      parseRepoInput("https://github.com/obra/superpowers"),
      "obra/superpowers",
    );
  });

  it("strips a trailing slash", () => {
    assert.equal(parseRepoInput("https://github.com/obra/superpowers/"), "obra/superpowers");
  });

  it("accepts an SSH remote", () => {
    assert.equal(parseRepoInput("git@github.com:obra/superpowers.git"), "obra/superpowers");
  });

  it("rejects nonsense instead of guessing", () => {
    assert.equal(parseRepoInput("not a repo"), null);
    assert.equal(parseRepoInput(""), null);
    assert.equal(parseRepoInput("./local/path"), null);
  });
});

describe("findLicenseFile / hasReadme", () => {
  const entries = [
    { path: "LICENSE", type: "blob" as const },
    { path: "README.md", type: "blob" as const },
    { path: "skills", type: "tree" as const },
  ];

  it("finds LICENSE at the root", () => {
    assert.equal(findLicenseFile(entries), "LICENSE");
  });

  it("matches the British spelling and file extensions", () => {
    assert.equal(findLicenseFile([{ path: "LICENCE.md", type: "blob" }]), "LICENCE.md");
    assert.equal(findLicenseFile([{ path: "LICENSE.txt", type: "blob" }]), "LICENSE.txt");
  });

  it("returns null when absent", () => {
    assert.equal(findLicenseFile([{ path: "README.md", type: "blob" }]), null);
  });

  it("ignores directories named LICENSE", () => {
    assert.equal(findLicenseFile([{ path: "LICENSE", type: "tree" }]), null);
  });

  it("detects README", () => {
    assert.equal(hasReadme(entries), true);
    assert.equal(hasReadme([{ path: "docs", type: "tree" }]), false);
  });
});

describe("selectSkillFiles", () => {
  it("picks only SKILL.md blobs, shallowest first", () => {
    const tree = [
      { path: "skills/deep/nested/pdf/SKILL.md", type: "blob" as const },
      { path: "skills/pdf/SKILL.md", type: "blob" as const },
      { path: "README.md", type: "blob" as const },
      { path: "SKILL.md", type: "blob" as const },
    ];
    assert.deepEqual(selectSkillFiles(tree), [
      "SKILL.md",
      "skills/pdf/SKILL.md",
      "skills/deep/nested/pdf/SKILL.md",
    ]);
  });

  it("respects the limit", () => {
    const tree = Array.from({ length: 20 }, (_, i) => ({
      path: `skills/s${i}/SKILL.md`,
      type: "blob" as const,
    }));
    assert.equal(selectSkillFiles(tree, 5).length, 5);
  });
});

describe("rawUrl", () => {
  it("builds a raw.githubusercontent.com URL", () => {
    assert.equal(
      rawUrl("owner/repo", "main", "skills/pdf/SKILL.md"),
      "https://raw.githubusercontent.com/owner/repo/main/skills/pdf/SKILL.md",
    );
  });

  it("escapes path segments with spaces", () => {
    assert.equal(
      rawUrl("o/r", "main", "skills/my skill/SKILL.md"),
      "https://raw.githubusercontent.com/o/r/main/skills/my%20skill/SKILL.md",
    );
  });
});

describe("detectSpdxFromText", () => {
  it("recognises MIT from its grant clause", () => {
    const mit = `MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software... THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY.`;
    assert.equal(detectSpdxFromText(mit), "MIT");
  });

  it("recognises Apache-2.0", () => {
    assert.equal(detectSpdxFromText("Apache License\nVersion 2.0, January 2004"), "Apache-2.0");
  });

  it("prefers AGPL over GPL when both words appear", () => {
    // The AGPL text contains "GNU General Public License" style phrasing too;
    // getting this backwards would under-report the strongest copyleft.
    const agpl = "GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3, 19 November 2007";
    assert.equal(detectSpdxFromText(agpl), "AGPL-3.0-only");
  });

  it("prefers LGPL over GPL", () => {
    assert.equal(
      detectSpdxFromText("GNU LESSER GENERAL PUBLIC LICENSE Version 3"),
      "LGPL-3.0-only",
    );
  });

  it("distinguishes BSD-3-Clause from BSD-2-Clause", () => {
    const common = "Redistribution and use in source and binary forms, with or without modification";
    assert.equal(detectSpdxFromText(common), "BSD-2-Clause");
    assert.equal(
      detectSpdxFromText(`${common}\nNeither the name of the copyright holder nor`),
      "BSD-3-Clause",
    );
  });

  it("flags a non-commercial CC license", () => {
    assert.equal(
      detectSpdxFromText("Creative Commons Attribution NonCommercial 4.0"),
      "CC-BY-NC-4.0",
    );
  });

  it("returns null for unrecognised text rather than guessing", () => {
    assert.equal(detectSpdxFromText("Copyright (c) 2026 Acme. All rights reserved."), null);
  });
});
