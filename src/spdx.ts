/**
 * A small, dependency-free SPDX license expression parser and classifier.
 *
 * We deliberately do NOT pull in a full SPDX library: `npx skillcheck` must stay
 * a single tiny download. The expression grammar we support covers everything that
 * appears in real SKILL.md repos:
 *
 *   MIT
 *   Apache-2.0 WITH LLVM-exception
 *   (MIT OR Apache-2.0)
 *   GPL-3.0-only
 *   MIT AND CC0-1.0
 *
 * See https://spdx.github.io/spdx-spec/v2.3/license-expressions/
 */

export type Category =
  /** MIT, Apache-2.0, BSD, CC0, Unlicense... — do whatever you want, including selling it. */
  | "permissive"
  /** Strong copyleft (GPL, AGPL). Usable, but the terms can reach into your product. */
  | "copyleft-strong"
  /** Weak copyleft (LGPL, MPL, EPL, CDDL). Usable with care. */
  | "copyleft-weak"
  /** Business-source / source-available / non-commercial. Read it before you ship. */
  | "source-available"
  /** Something we do not recognise. Human review required. */
  | "unknown";

export interface LicenseInfo {
  /** The SPDX id (or raw string) we resolved to. */
  id: string;
  category: Category;
  /** Human readable name, e.g. "MIT License". */
  name: string;
  /** Short, factual note about what the license means for a commercial product. */
  note: string;
}

interface Rule {
  /** Matched against the lowercased, normalised SPDX id. */
  match: RegExp;
  category: Category;
  name: string;
  note: string;
}

/**
 * Ordered: first match wins. More specific patterns must come first.
 */
const RULES: Rule[] = [
  // ---- Public domain / no-conditions -------------------------------------
  {
    match: /^(cc0-1\.0|unlicense|0bsd|bsd-1-clause|libtiff|mit-0|x11|zlib|zpl-2\.[01])$/,
    category: "permissive",
    name: "Public domain / no conditions",
    note: "No meaningful conditions. Use it, modify it, sell it.",
  },

  // ---- Non-commercial / source-available ----------------------------------
  {
    match: /^(cc-by-nc(-|\.|\b)|cc-by-nc-sa|cc-by-nc-nd)/,
    category: "source-available",
    name: "Creative Commons NonCommercial",
    note: "Commercial use is NOT allowed. This is the one that bites people.",
  },
  {
    match: /^(busl|bsl)-/,
    category: "source-available",
    name: "Business Source License",
    note: "Source-available with a future change date. Not open source today.",
  },
  {
    match: /^(sspl|commons-clause|elastic-license|polyform)/,
    category: "source-available",
    name: "Source-available license",
    note: "Restricts offering the software as a service, or other commercial terms. Read it.",
  },
  {
    match: /^(cc-by-nd|cc-by-sa|cc-by)(-|\d)/,
    category: "source-available",
    name: "Creative Commons",
    note: "CC licenses are written for content, not code. ShareAlike/NoDerivatives can block shipping.",
  },

  // ---- Strong copyleft ----------------------------------------------------
  {
    match: /^agpl/,
    category: "copyleft-strong",
    name: "GNU Affero GPL",
    note: "Strongest copyleft. Serving it over a network can require releasing YOUR source.",
  },
  {
    match: /^(gpl|gnugpl)/,
    category: "copyleft-strong",
    name: "GNU GPL",
    note: "Copyleft. Derivative works you distribute must carry the same license.",
  },
  {
    match: /^(sspl|osl)/,
    category: "copyleft-strong",
    name: "Strong copyleft",
    note: "Copyleft with service clauses.",
  },

  // ---- Weak copyleft ------------------------------------------------------
  {
    match: /^(lgpl|gnulgl)/,
    category: "copyleft-weak",
    name: "GNU LGPL",
    note: "Weak copyleft. Linking is fine; modifying the library itself triggers sharing.",
  },
  {
    match: /^(mpl|mpl-2\.0|epl|cddl|cpl|apsl)/,
    category: "copyleft-weak",
    name: "File-scoped copyleft",
    note: "Copyleft applies per-file. Keep it isolated and you are fine.",
  },

  // ---- Permissive ---------------------------------------------------------
  {
    match: /^apache-?(1|2)/,
    category: "permissive",
    name: "Apache License",
    note: "Permissive, plus an explicit patent grant. Keep the NOTICE file if there is one.",
  },
  {
    match: /^(mit|bsd|isc|python-2\.0|postgresql|artistic|blueoak|hippocratic|mulanpsl)/,
    category: "permissive",
    name: "Permissive license",
    note: "Keep the copyright notice in redistributions. Otherwise, do what you like.",
  },
];

/** Normalise an SPDX id: lowercase, trim, strip a trailing "+" version wildcard. */
function normalise(id: string): string {
  return id.trim().toLowerCase().replace(/\+$/, "");
}

export function classifyId(rawId: string): LicenseInfo {
  const id = normalise(rawId);

  for (const rule of RULES) {
    if (rule.match.test(id)) {
      return {
        id: rawId.trim(),
        category: rule.category,
        name: rule.name,
        note: rule.note,
      };
    }
  }

  return {
    id: rawId.trim(),
    category: "unknown",
    name: "Unrecognised license",
    note: "Not in our table. Read the LICENSE file before shipping.",
  };
}

// ---------------------------------------------------------------------------
// Expression parsing
// ---------------------------------------------------------------------------

type Node =
  | { kind: "id"; id: string; exception?: string }
  | { kind: "and"; left: Node; right: Node }
  | { kind: "or"; left: Node; right: Node };

class Parser {
  private pos = 0;
  constructor(private readonly tokens: string[]) {}

  parse(): Node {
    const node = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token "${this.tokens[this.pos]}" in license expression`);
    }
    return node;
  }

  private parseOr(): Node {
    let left = this.parseAnd();
    while (this.peek()?.toUpperCase() === "OR") {
      this.pos++;
      left = { kind: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parsePrimary();
    while (this.peek()?.toUpperCase() === "AND") {
      this.pos++;
      left = { kind: "and", left, right: this.parsePrimary() };
    }
    return left;
  }

  private parsePrimary(): Node {
    const token = this.tokens[this.pos++];
    if (!token) throw new Error("Unexpected end of license expression");

    if (token === "(") {
      const inner = this.parseOr();
      if (this.tokens[this.pos] !== ")") {
        throw new Error("Missing closing parenthesis in license expression");
      }
      this.pos++;
      return inner;
    }
    if (token === ")") throw new Error("Unexpected ) in license expression");

    // "Apache-2.0 WITH LLVM-exception"
    let exception: string | undefined;
    if (this.peek()?.toUpperCase() === "WITH") {
      this.pos++;
      exception = this.tokens[this.pos++];
      if (!exception) throw new Error("Missing exception after WITH");
    }
    return { kind: "id", id: token, ...(exception ? { exception } : {}) };
  }

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }
}

const TOKEN_RE = /\(|\)|[^\s()]+/g;

export function parseExpression(expression: string): Node {
  const tokens = expression.match(TOKEN_RE);
  if (!tokens || tokens.length === 0) {
    throw new Error("Empty license expression");
  }
  return new Parser(tokens).parse();
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface ResolvedLicense {
  /** The original expression we were given. */
  expression: string;
  /** Every individual license id found in the expression. */
  ids: string[];
  /**
   * The most restrictive category present.
   *
   * Rationale: for an OR expression you may pick the friendliest branch, but for
   * an AND expression you must satisfy every branch. Because we cannot know which
   * it is without the full context, we report the *worst* case and let the human
   * decide. That is the safe default for a compliance tool.
   */
  worstCategory: Category;
  /** The friendliest category present (what you could choose under an OR). */
  bestCategory: Category;
  /** True when the expression contains OR, meaning the user gets to choose. */
  hasChoice: boolean;
  infos: LicenseInfo[];
}

const SEVERITY: Record<Category, number> = {
  permissive: 0,
  "copyleft-weak": 1,
  "copyleft-strong": 2,
  "source-available": 3,
  unknown: 4,
};

function collect(node: Node, out: Node[]): void {
  if (node.kind === "id") {
    out.push(node);
    return;
  }
  collect(node.left, out);
  collect(node.right, out);
}

function hasOr(node: Node): boolean {
  if (node.kind === "or") return true;
  if (node.kind === "id") return false;
  return hasOr(node.left) || hasOr(node.right);
}

export function resolveLicense(expression: string): ResolvedLicense {
  const ast = parseExpression(expression);
  const leaves: Node[] = [];
  collect(ast, leaves);

  const infos = leaves.map((leaf) => {
    if (leaf.kind !== "id") throw new Error("unreachable");
    return classifyId(leaf.id);
  });

  const categories = infos.map((i) => i.category);
  const worst = categories.reduce((a, b) => (SEVERITY[a] >= SEVERITY[b] ? a : b));
  const best = categories.reduce((a, b) => (SEVERITY[a] <= SEVERITY[b] ? a : b));

  return {
    expression: expression.trim(),
    ids: infos.map((i) => i.id),
    worstCategory: worst,
    bestCategory: best,
    hasChoice: hasOr(ast),
    infos,
  };
}

/** Convenience: the category you should act on. */
export function effectiveCategory(resolved: ResolvedLicense): Category {
  return resolved.worstCategory;
}

export { SEVERITY };
