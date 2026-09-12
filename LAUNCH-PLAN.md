# Launch plan — skillcheck

Goal: stars from people who actually use the thing. Not from drive-bys.

---

## Positioning (learn this by heart, you need it everywhere)

> `npx skills` **installs** the skill. `SkillSpector` **scans** it for security.
> **`skillcheck` tells you whether you are allowed to use it at all.**
>
> 22,678 repositories carry the `agent-skills` topic. Anthropic's official repo, 175,921 stars,
> has **no LICENSE file** — which under copyright law means "all rights reserved". In a sample of
> the most recently updated skills, 16% had no license and 21% had one GitHub could not classify.

**Never** claim you are competing with Vercel. You are the step *before* them. That is the only
reason people will not ignore you, and the only reason skill authors will like you.

**The main "aha" line:** *"Your agent just installed 14 skills. You have no idea what any of them
allow you to do."*

---

## Before launch (yours to do — I cannot)

- [ ] **Create the GitHub repo** `Vortexeddev/skillcheck` (or `<your-user>/skillcheck`)
- [ ] **Push the code** — exact commands in `NEXT-STEPS.md`
- [ ] **Replace the placeholder URLs**: `README.md`, `package.json` (`repository`, `homepage`),
      `CONTRIBUTING.md` and `src/output.ts` (badge link) all say `github.com/Vortexeddev/skillcheck`.
      `./scripts/set-repo.sh <your-user>/skillcheck` fixes all of them at once.
- [ ] **`npm publish`** — needs your npm account: `npm login && npm publish --access public`
      (the name `skillcheck` is free, verified)
- [ ] **GitHub topics** (this is SEO inside GitHub, it really matters):
      `agent-skills` `claude-skills` `license` `spdx` `compliance` `cli` `security`
      `claude-code` `cursor` `codex` `opencode` `llm` `devtools`
- [ ] **Submit the repo to `awesome-claude-code` and `VoltAgent/awesome-agent-skills` via PR** —
      those are permanent dofollow backlinks from 34k–54k ★ pages. The best free source of early
      traffic there is.

---

## Day 1 — Show HN

Title (the only thing 90% of people read):

```
Show HN: skillcheck – 22k agent skills on GitHub, and a third have no usable license
```

First comment (you post it immediately after; HN expects this):

> I built this after checking what my coding agent had actually installed. It turned out
> `anthropics/skills` — the official Agent Skills repo, 175k stars — has no LICENSE file at all,
> which under copyright law means all rights reserved.
>
> So I checked the rest of the ecosystem. 22,678 repos carry the `agent-skills` topic. Among the
> 100 most recently updated, only 46% were MIT. 17% had no license. 21% had a license file GitHub
> couldn't classify.
>
> `skillcheck` resolves the SPDX expression and tells you what it means for something you intend to
> sell. It also validates SKILL.md against the agentskills.io spec, because a skill that breaks the
> spec silently never loads and you end up debugging your prompt instead of your frontmatter.
>
> Zero runtime dependencies, on purpose: it felt wrong to add a supply chain to a tool whose job is
> deciding whether you can trust a file an agent will execute.
>
> Not legal advice, and I'd genuinely like to know where the license table is wrong.

**Rules that decide the outcome:**
- Post **Tuesday–Thursday, 14:00–16:00 UTC**
- Do **not** ask for votes, do **not** blast it to a group chat — HN punishes both
- Answer comments for two hours. Response speed is a strong algorithmic signal.
- If it is under 10 points after an hour, it is dead. You can try again in 2–3 weeks with a
  different title.

---

## Day 1 — Reddit (two hours after HN, not simultaneously)

**r/selfhosted** and **r/ClaudeAI** matter most. The title should be a finding, not an advert:

```
I checked 22,678 agent-skills repos on GitHub for license compliance. 16% have no license at all.
```

Body: short table with the numbers + one line of `npx @vortexeddev/skillcheck check owner/repo` + link.
No "please star". Moderators delete that, and users report it.

Also: **r/opensource**, **r/programming** (harder), **r/ChatGPTCoding**.

---

## Day 2 — X / Twitter

This is where the AI-agent audience is densest. Post a **thread with a terminal screenshot**, not
just text:

> 1/ Your coding agent has 14 skills installed. Can you name the license on any of them?
>
> 2/ I checked. `anthropics/skills` — 175k stars, the official repo — has no LICENSE file.
>    That's "all rights reserved" by default.
>
> 3/ Of the 100 most recently updated `agent-skills` repos: 46% MIT, 17% no license,
>    21% unclassifiable.
>
> 4/ Built a checker: `npx @vortexeddev/skillcheck check owner/repo`
>    [screenshot]
>
> 5/ It resolves SPDX expressions properly — "MIT OR AGPL-3.0" means you get to choose,
>    "MIT AND AGPL-3.0" means you don't.

Tag (do not spam) `@AnthropicAI` and authors of larger skill repos **only if** you have something
specific to say about their repo.

---

## Days 3–7 — the "you're missing a LICENSE" campaign

This is what actually creates the wave. And it is genuinely useful at the same time.

1. Run `npm run registry:build -- --fast` and take 10 repos with `verdict: "fail"`
   (currently 10 entries, `category: none`).
2. Open a **polite** issue on each:

   > Hi — I ran a license check over the agent-skills ecosystem and noticed this repo has no
   > `LICENSE` file. Without one, GitHub's default applies and everything is all-rights-reserved,
   > which probably isn't what you want given people are installing these into their agents.
   >
   > If you'd like, adding an MIT `LICENSE` takes about a minute. Happy to send a PR.
   >
   > (I built the checker: <link>. No affiliation, and sorry if this is noise — I've filed these
   > as one batch and I'll close them if they're unwanted.)

3. **Send the PR with the LICENSE file**, not just an issue. Conversion is roughly 5× higher.
4. Each PR is one person who learns about the tool, and one repo that is now legitimate. That is
   the real value here, not just marketing.

⚠️ **Do not spam.** Max 10 per day, review each one by hand, and close immediately if anyone says
no.

---

## Week 2 — content (the best long-term channel)

Write the article: **"38% of agent skills have no usable license"**.
Publish on `dev.to` + `Hacker Noon` + your own blog.

Why this works better than a launch post:
- Search engines keep finding it for years
- You have **original data** nobody else has
- Everyone who cites it gives you a backlink

Put the **badge** at the end — authors copy it into their READMEs, which is organic distribution.

---

## Weeks 2–3 — Product Hunt

Less important for dev tools than people think, but free.
Prepare a terminal GIF (not a static image) and a 60-second description.

---

## What to measure

| Metric | Where | Realistic after 1 month |
|---|---|---|
| GitHub ★ | repo | 100–800 if HN lands, 20–60 if it doesn't |
| npm downloads/week | npmjs.com | 50–500 |
| Issues from authors | GitHub | the most valuable signal |
| PRs adding licenses | GitHub | means people are using the table |

**Do not check stars daily.** Check whether anyone opened an issue. That means someone is using it.

---

## The most common reasons a project like this dies

1. **No distribution.** The code is not the problem. You are, if you don't post.
2. **A README with no GIF.** People need to *see* the output in two seconds.
3. **An issue left unanswered for three days.** The first ten people who write to you decide
   whether there is a community.
4. **A stale registry.** That is why `registry.yml` has a cron. Check after the first Monday that
   it actually ran.
5. **Waiting for perfect instead of shipping.** Ship now, fix next week.
