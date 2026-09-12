<div align="center">

# skillcheck

**Can you legally ship this agent skill?**

`anthropics/skills` — the official Agent Skills repo, **175,921 ★** — has **no LICENSE file**.
Under copyright law that means *all rights reserved*: you may not copy, modify, redistribute or sell
anything in it, even though it sits there public on GitHub.

It is not alone. `skillcheck` checks before you find out.

```bash
npx skillcheck check anthropics/skills
```

[![npm version](https://img.shields.io/npm/v/skillcheck.svg)](https://www.npmjs.com/package/skillcheck)
[![license MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)
[![tests](https://github.com/skillcheck/skillcheck/actions/workflows/ci.yml/badge.svg)](https://github.com/skillcheck/skillcheck/actions/workflows/ci.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#why-zero-dependencies)

</div>

---

## Why this exists

There are **22,678 repositories** on GitHub tagged [`agent-skills`](https://github.com/topics/agent-skills)
and **8,214** tagged [`claude-skills`](https://github.com/topics/claude-skills). Agents execute what
those files say. And almost nobody has checked the terms.

`skillcheck` answers three questions in one command:

1. **Can I use this commercially?** — resolves the SPDX license expression and tells you what it
   actually means for a product you intend to sell.
2. **Does it follow the [Agent Skills spec](https://agentskills.io/specification)?** — a skill that
   breaks the spec silently never loads, and you will debug your prompt instead of your frontmatter.
3. **Is it still alive?** — stars, last push, archived status.

### What we found

Measured from the top 166 repos by stars across `agent-skills` / `claude-skills`
(registry snapshot 2026-09-12, reproduced by `npm run registry:build -- --fast`):

| | |
|---|---|
| ✔ Permissive, safe to ship | **135** (81.3%) |
| ⚠ License file exists but unclassified (`NOASSERTION`) | **17** (10.2%) |
| ✖ No license at all | **10** (6.0%) |

The popular end of the ecosystem is mostly fine. **The long tail is not** — a sample of the 100 most
recently *updated* `agent-skills` repos came back only **46% MIT**, with **17% carrying no license
whatsoever** and 21% unclassified. Those are the ones you install at 2am.

## Install

Nothing to install. Requires Node 18+.

```bash
npx skillcheck check owner/repo
```

Or globally:

```bash
npm i -g skillcheck
```

## Usage

### Check a repo before you install it

```bash
npx skillcheck check obra/superpowers
```

```
  obra/superpowers
  ✔ SAFE TO SHIP   https://github.com/obra/superpowers

  License   MIT
  Keep the copyright notice in redistributions. Otherwise, do what you like.

  Spec      5/5 SKILL.md file(s) valid

  Health    ★ 285,595  ·  ⑂ 25,555  ·  pushed 1d ago

  Why
    · License is permissive: safe for commercial use.
    · SKILL.md is valid against the Agent Skills spec.
```

And the repo you should not have installed:

```
  anthropics/skills
  ✖ DO NOT SHIP   https://github.com/anthropics/skills

  License   NO LICENSE
  No LICENSE file found. With no license, copyright law defaults to ALL
  RIGHTS RESERVED — legally you may not copy, modify, redistribute or sell
  this, even though it is public on GitHub.

  Spec      4/5 SKILL.md file(s) valid  (3 issue(s))
    error name-dir-mismatch template/SKILL.md: `name: template-skill` does not match its directory `template`.

  Health    ★ 175,921  ·  ⑂ 20,823  ·  pushed 2d ago
```

### Check a local checkout

Works offline, no API calls. It reads your `LICENSE` file and identifies the terms itself.

```bash
npx skillcheck check ./my-skill
```

### Browse vetted skills

The registry ships inside the package, so this works with no network access:

```bash
npx skillcheck top
npx skillcheck top pdf
npx skillcheck top --limit 50 --json
```

Safe-to-ship repos sort first, then by stars.

### Explain a license

```bash
npx skillcheck license "AGPL-3.0-only"
npx skillcheck license "MIT OR Apache-2.0"     # OR = you may choose
npx skillcheck license "MIT AND WeirdCorp-1.0" # AND = worst branch wins
```

## Verdicts

| Verdict | Exit code | Meaning |
|---|---|---|
| ✔ **SAFE TO SHIP** | `0` | Permissive license, spec-valid, maintained. Build on it. |
| ⚠ **NEEDS REVIEW** | `1` | Copyleft, unclassified terms, archived, stale, or spec warnings. A human should read it. |
| ✖ **DO NOT SHIP** | `2` | No license at all, or `SKILL.md` breaks the spec so it will not even load. |

Exit codes are deliberate, so you can gate a pipeline on them.

### License buckets

| Bucket | Examples | Commercial use |
|---|---|---|
| `permissive` | MIT, Apache-2.0, BSD, ISC, CC0, Unlicense | ✔ Yes |
| `copyleft-weak` | LGPL, MPL-2.0, EPL | ⚠ Keep the licensed files isolated |
| `copyleft-strong` | GPL, AGPL | ⚠ Derivatives inherit the license; AGPL reaches network use |
| `source-available` | BUSL, SSPL, CC-BY-NC | ✖ Read it first — NC bans commercial use outright |
| `unknown` | anything unrecognised | ⚠ Human review |
| `none` | no LICENSE file | ✖ All rights reserved by default |

## CI

`--json` plus exit codes make this a two-line GitHub Action step. Add
`.github/workflows/skillcheck.yml`:

```yaml
name: skillcheck
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Check license and skill spec
        # Warn on review, fail on a missing license or a broken SKILL.md
        run: npx --yes skillcheck check . --json
```

## Badge

```bash
npx skillcheck badge owner/repo
```

```markdown
[![skillcheck: SAFE TO SHIP](https://img.shields.io/badge/skillcheck-SAFE%20TO%20SHIP-brightgreen)](https://github.com/skillcheck/skillcheck#verdicts)
```

## The registry is generated, not curated

Most skill lists are hand-maintained markdown: 1,000 entries, no verification, and the maintainer's
free time is the update schedule.

`skillcheck` flips that. `data/registry.ts` is **built from the GitHub API** by
[`scripts/build-registry.ts`](scripts/build-registry.ts) and regenerated on a schedule by
[`.github/workflows/registry.yml`](.github/workflows/registry.yml). List repos (`awesome-*`, curated
collections) are filtered out automatically — they are indexes, not things you install.

Two modes:

| Mode | API calls | Use |
|---|---|---|
| `--fast` | 3 | Rebuilds from search metadata alone. Runs unauthenticated, which is what a contributor without a token can reproduce. |
| verified *(default)* | 1 per repo | Fetches each repo's root listing to tell **"no license"** apart from **"custom license"** — GitHub reports `license: null` for both. Needs `GITHUB_TOKEN`. CI runs this. |

That distinction is the entire point of the tool, so CI is the source of truth and `--fast` is the
local fallback.

```bash
GITHUB_TOKEN=ghp_... npm run registry:build
```

## Why zero dependencies

`npx skillcheck` should cost you nothing to try. There is no `node_modules` to install, no lockfile
drift, no transitive supply chain — which is a slightly load-bearing claim for a tool whose job is
checking whether you can trust a file that an AI agent will execute.

The SPDX expression parser ([`src/spdx.ts`](src/spdx.ts)) is ~200 lines and handles `AND`, `OR`,
parentheses and `WITH` exceptions. The frontmatter parser
([`src/frontmatter.ts`](src/frontmatter.ts)) implements the YAML subset the spec permits. Both are
covered by tests, including the cases where guessing would be dangerous:

```bash
npm test        # 78 tests
npm run typecheck
```

**Conservative by design:** an `AND` expression resolves to its *worst* branch. An `OR` tells you a
permissive option exists but still reports the copyleft one. An unrecognised license is `unknown`,
never `permissive`. False alarms are cheap; a missed AGPL is not.

## Contributing

Missing a license from the table? Found a spec rule we do not enforce? Those are the highest-value
PRs here.

```bash
git clone https://github.com/skillcheck/skillcheck
cd skillcheck
npm install
npm test
```

Please add a test with any rule change — the test suite is what stops this tool from quietly
becoming wrong.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Not legal advice

`skillcheck` is a static checker written by developers, not lawyers. It tells you what a license
string says and whether a `SKILL.md` follows a published spec. For anything you are actually
selling, have a lawyer read the file.

## License

MIT © skillcheck contributors. Use it, fork it, ship it, sell what you build with it.
