/**
 * Detect an SPDX id from raw LICENSE text.
 *
 * GitHub does this for us over the API, but `skillcheck check ./local-dir` has no
 * API to ask, so we recognise the licenses that actually appear in skill repos.
 * Returning null is the honest answer: the caller then reports "needs review"
 * instead of guessing permissive.
 */
export function detectSpdxFromText(text: string): string | null {
  const t = text.toLowerCase();

  // Order matters: check the more specific/copyleft texts before the generic
  // permissive ones, since several licenses share boilerplate.
  if (t.includes("gnu affero general public license")) return "AGPL-3.0-only";
  if (t.includes("gnu lesser general public license")) return "LGPL-3.0-only";
  if (t.includes("gnu general public license")) return "GPL-3.0-only";

  if (t.includes("apache license") && t.includes("version 2.0")) return "Apache-2.0";

  if (t.includes("mozilla public license") && t.includes("2.0")) return "MPL-2.0";

  if (
    t.includes("permission is hereby granted, free of charge") &&
    t.includes('the software is provided "as is"')
  ) {
    return "MIT";
  }

  if (t.includes("redistribution and use in source and binary forms")) {
    // BSD-3-Clause carries the "neither the name of ... may be used to endorse"
    // clause that BSD-2-Clause omits.
    return t.includes("neither the name") ? "BSD-3-Clause" : "BSD-2-Clause";
  }

  if (t.includes("this is free and unencumbered software released into the public domain")) {
    return "Unlicense";
  }

  if (t.includes("creative commons") && t.includes("noncommercial")) return "CC-BY-NC-4.0";

  return null;
}
