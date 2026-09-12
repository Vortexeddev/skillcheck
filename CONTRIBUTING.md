# Contributing

Thanks — the highest-value contributions here are the unglamorous ones: a missing license in the
table, a spec rule we do not enforce, a false positive that made someone's CI red for no reason.

## Setup

```bash
git clone https://github.com/Vortexeddev/skillcheck
cd skillcheck
npm install
npm test
```

Node 18+. There are no runtime dependencies, so `npm install` only pulls the build and test tooling.

## Before you send a PR

```bash
npm test         # 78 tests, must stay green
npm run typecheck
npm run build    # tsup, must produce dist/index.js
```

**Please add a test with any rule change.** This tool tells people whether they are allowed to ship
something. A rule that is silently wrong is worse than a missing rule, and the test suite is the
only thing standing between us and that.

## The conservative-by-design rule

When behaviour is ambiguous, we over-warn:

- An `AND` expression resolves to its **worst** branch.
- An `OR` reports the permissive option *and* the restrictive one.
- An unrecognised license is `unknown`, never `permissive`.
- A missing `LICENSE` is `none` (all rights reserved), not "probably fine".

If your PR makes the tool more permissive in an ambiguous case, it needs a strong argument.
A false alarm costs someone a minute. A missed AGPL costs them a product.

## Adding a license to the table

Edit `RULES` in [`src/spdx.ts`](src/spdx.ts). The array is **ordered — first match wins** — so put
specific patterns above generic ones. `LGPL` must stay above `GPL`, or weak copyleft gets reported
as strong. There is a regression test for exactly that; keep it passing.

## Adding a spec rule

Edit `validateSkill` in [`src/frontmatter.ts`](src/frontmatter.ts). Give the issue a stable `code`
(CI annotations and users grep for it) and link the spec section in `spec`.

## Regenerating the registry

```bash
# Local, no token needed — 3 API calls, search metadata only
npm run registry:build -- --fast

# Full pass — fetches each repo's root listing, needs a token
GITHUB_TOKEN=ghp_... npm run registry:build
```

Do not hand-edit `data/registry.ts`; it is generated and CI will overwrite it.

## Things that are deliberately not here

- **No skill installer.** [`npx skills`](https://github.com/vercel-labs/skills) already does that
  well and supports 80+ agents. This tool is the check you run *before* you install.
- **No security scanning.** [`NVIDIA/SkillSpector`](https://github.com/NVIDIA/SkillSpector) owns
  that problem.
- **No runtime dependencies.** If a change needs one, open an issue first.

## Code of conduct

Be decent. Disagreements about licensing are common here; assume good faith, since most of the
22,000 repos we flag were written by someone who genuinely did not know.
