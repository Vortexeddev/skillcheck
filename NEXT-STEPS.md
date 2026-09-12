# What you need to do (I cannot do this part)

The sandbox this was built in has no GitHub credentials — verified: `gh` is not installed and there
is no token. So the repo exists locally and you have to push it yourself.

All the code is in `~/skillcheck`. Everything is verified: 78 tests, typecheck, build, and the CLI
runs against real GitHub repositories.

---

## 1. Create an empty repo on GitHub

github.com → New repository → name it `skillcheck` → **no** README, no `.gitignore`, no license
(all three already exist here, otherwise you get a conflict on the first push).

## 2. Rename the placeholder slug

Everything currently points at `github.com/Vortexeddev/skillcheck`. Repoint it at your own:

```bash
cd ~/skillcheck
./scripts/set-repo.sh <your-github-user>/skillcheck
```

The script updates `package.json`, `README.md`, `CONTRIBUTING.md`, `src/index.ts` and
`src/output.ts`. It is idempotent, so running it twice is harmless.

## 3. Push

```bash
cd ~/skillcheck
git add -A
git commit -m "skillcheck: license + spec checker for agent skills"
git branch -M main
git remote add origin git@github.com:<your-github-user>/skillcheck.git
git push -u origin main
```

If `git` in the sandbox does not have your keys, push from your own machine — the folder is visible
in the workspace panel and can be downloaded.

## 4. Publish to npm

The name `skillcheck` is free (verified: `skill-check`, `skillrank` and `skillscan` are all taken).

```bash
npm login
npm publish --access public
```

`prepublishOnly` runs the build automatically. After publishing, confirm it works end to end:

```bash
npx @vortexeddev/skillcheck check obra/superpowers
```

## 5. Add GitHub topics

This is SEO inside GitHub and it genuinely affects who finds you:

```
agent-skills  claude-skills  license  spdx  compliance  cli
security  claude-code  cursor  codex  opencode  llm  devtools
```

## 6. Confirm CI ran

After the push, open **Actions** and check that `CI` and `Registry` are green.
`Registry` is on a cron for Mondays 04:17 UTC — after the first Monday, verify that
`data/registry.ts` actually changed. That job is what separates this project from a stale
awesome-list.

---

## Known limitations (deliberate, not bugs)

- **The registry is a sample, not a census.** 166 entries = the top repos by stars across two topic
  tags, not all 22,678. The README says so plainly. To widen it, raise `perPage` / `MAX_ENTRIES` in
  `scripts/build-registry.ts` — the constraint is the GitHub rate limit, so you need a token.
- **`--fast` cannot tell "no license" from "custom license".** GitHub returns `license: null` for
  both. That is why CI runs in verified mode with a token. Verdicts from fast mode are conservative
  as a result.
- **The local `check` only recognises ~10 common licenses** from text (`src/license-sniff.ts`).
  Anything it does not recognise returns `null`, which makes the tool say "needs review", never
  "safe". That is intentional.
- **No security scanning.** `NVIDIA/SkillSpector` does that. Do not duplicate it.
- **No installer.** `vercel-labs/skills` does that. Do not duplicate it.

## Ideas for later, in order of value

1. **A live badge API** — the badge is currently static (generated when you run `check`). A real
   live badge needs a serverless function; GitHub Pages plus Actions can do it for free.
2. **`skillcheck why <repo>`** — break down exactly why something failed, with links to specific
   lines.
3. **A real marketplace GitHub Action** (`uses: skillcheck/action@v1`) instead of an `npx` step.
   Much lower friction to adopt in CI.
4. **A PR bot** that automatically opens a PR adding a LICENSE file to repos without one. This is
   what makes the project known; see `LAUNCH-PLAN.md`, days 3–7.
5. **More licenses in the table** — every PR that adds one is valuable. There are about 30 patterns
   today.
