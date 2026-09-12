# Launch plan — skillcheck

Cilj: zvezdice od ljudi, ki jih dejansko uporabijo. Ne od naključnih mimoidočih.

---

## Positioning (nauči se to na pamet, rabiš jo povsod)

> `npx skills` ti **namesti** skill. `SkillSpector` ti ga **skenira za varnost**.
> **`skillcheck` ti pove, ali ga sploh smeš.**
>
> 22.678 repozitorijev ima oznako `agent-skills`. Anthropicov uradni repo s 175.921 zvezdicami
> **nima LICENSE datoteke** — kar pravno pomeni "vse pravice pridržane". 16 % vzorca nazadnje
> posodobljenih skill-ov je brez licence, 21 % jih ima nestandardizirano.

**Nikoli** ne trdi, da tekmuješ z Vercelom. Ti si korak *pred* njim. To je edini razlog, da te
ne bodo ignorirali — in edini razlog, da te bodo skill avtorji imeli radi.

**Glavni "aha" stavek:** *"Your agent just installed 14 skills. You have no idea what any of them
allow you to do."*

---

## Pred launchom (naredi ti — jaz ne morem)

- [ ] **Ustvari GitHub repo** `skillcheck/skillcheck` (ali `<tvoj-user>/skillcheck`)
- [ ] **Pushaj kodo** — glej `NEXT-STEPS.md` za točne ukaze
- [ ] **Zamenjaj placeholder URL-je**: v `README.md`, `package.json` (`repository`, `homepage`),
      `CONTRIBUTING.md` in `src/output.ts` (badge link) je `github.com/skillcheck/skillcheck`
- [ ] **`npm publish`** — potreben tvoj npm račun: `npm login && npm publish --access public`
      (ime `skillcheck` je prosto, preveril sem)
- [ ] **GitHub topics** (to je SEO na GitHubu, res vpliva):
      `agent-skills` `claude-skills` `license` `spdx` `compliance` `cli` `security`
      `claude-code` `cursor` `codex` `opencode` `llm` `devtools`
- [ ] **Dodaj repo v `awesome-claude-code` in `VoltAgent/awesome-agent-skills` preko PR** —
      to so trajni dofollow backlinki z 34k–54k ⭐ strani. Najboljši brezplačen vir začetnega prometa.

---

## Dan 1 — Show HN

Naslov (edina stvar, ki jo 90 % ljudi prebere):

```
Show HN: skillcheck – 22k agent skills on GitHub, and a third have no usable license
```

Prvi komentar (ti ga napišeš takoj po objavi, HN to pričakuje):

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

**Pravila, ki odločajo:**
- Objavi **torek–četrtek, 14:00–16:00 UTC** (16:00–18:00 po našem)
- **Ne** prosi za glasove, **ne** pošiljaj prijateljem v skupinskem chatu — HN to kaznuje
- Odgovarjaj na komentarje 2 uri. Hitrost odgovorov je močan signal algoritmu.
- Če pade pod 10 točk v 1 uri, je mrtvo. Lahko poskusiš znova čez 2–3 tedne z drugim naslovom.

---

## Dan 1 — Reddit (2 uri za HN, ne hkrati)

**r/selfhosted** in **r/ClaudeAI** sta najpomembnejša. Naslov naj bo podatek, ne reklama:

```
I checked 22,678 agent-skills repos on GitHub for license compliance. 16% have no license at all.
```

Telo: kratka tabela s številkami + ena vrstica `npx skillcheck check owner/repo` + link.
Brez "please star". Moderatorji to brišejo, uporabniki pa reportajo.

Dodatno: **r/opensource**, **r/programming** (težje), **r/ChatGPTCoding**.

---

## Dan 2 — X / Twitter

Tukaj je AI-agent občinstvo najgosteje. Objavi **thread s sliko terminala**, ne samo besedila:

> 1/ Your coding agent has 14 skills installed. Can you name the license on any of them?
>
> 2/ I checked. `anthropics/skills` — 175k stars, the official repo — has no LICENSE file.
>    That's "all rights reserved" by default.
>
> 3/ Of the 100 most recently updated `agent-skills` repos: 46% MIT, 17% no license,
>    21% unclassifiable.
>
> 4/ Built a checker: `npx skillcheck check owner/repo`
>    [screenshot]
>
> 5/ It resolves SPDX expressions properly — "MIT OR AGPL-3.0" means you get to choose,
>    "MIT AND AGPL-3.0" means you don't.

Označi (ne spamaj) `@AnthropicAI` in avtorje večjih skill repozitorijev **samo če** imaš nekaj
konkretnega za povedati o njihovem repu.

---

## Dan 3–7 — "You're missing a LICENSE" kampanja

To je tisto, kar dejansko naredi val. In je hkrati res koristno.

1. Poženi `npm run registry:build -- --fast` in vzemi 10 repojev z `verdict: "fail"`
   (trenutno 10 vnosov, `category: none`).
2. Odpri **vljuden** issue na vsakem:

   > Hi — I ran a license check over the agent-skills ecosystem and noticed this repo has no
   > `LICENSE` file. Without one, GitHub's default applies and everything is all-rights-reserved,
   > which probably isn't what you want given people are installing these into their agents.
   >
   > If you'd like, adding an MIT `LICENSE` takes about a minute. Happy to send a PR.
   >
   > (I built the checker: <link>. No affiliation, and sorry if this is noise — I've filed these
   > as one batch and I'll close them if they're unwanted.)

3. **Pošlji PR z LICENSE datoteko**, ne samo issue-a. Konverzija je 5× višja.
4. Vsak tak PR = en človek, ki izve za orodje, in en repo, ki je zdaj legitimen. To je prava
   vrednost, ne samo marketing.

⚠️ **Ne spamaj.** Max 10 na dan, vsak ročno preveri, in takoj zapri, če kdo reče ne.

---

## Teden 2 — Vsebina (najboljši dolgoročni kanal)

Napiši članek: **"38% of agent skills have no usable license"**.
Objavi na `dev.to` + `Hacker Noon` + svoj blog.

Zakaj to deluje bolje kot launch post:
- Iskalniki ga najdejo še leta
- Imaš **originalne podatke**, ki jih nihče drug nima
- Vsak, ki ga citira, ti naredi backlink

Dodaj **badge** na konec — avtorji ga kopirajo v svoje README-je, kar je organska distribucija.

---

## Teden 2–3 — Product Hunt

Manj pomembno za dev orodja kot ljudje mislijo, ampak brezplačno.
Pripravi GIF terminala (ne statične slike) in 60-sekundni opis.

---

## Kaj meriti

| Metrika | Kje | Realno po 1 mesecu |
|---|---|---|
| GitHub ⭐ | repo | 100–800 če HN uspe, 20–60 če ne |
| npm prenosi/teden | npmjs.com | 50–500 |
| Issue-i od avtorjev | GitHub | najbolj dragocen signal |
| PR-ji z novimi licencami | GitHub | pomeni, da ljudje uporabljajo tabelo |

**Ne glej zvezdic dnevno.** Gledaj, ali ti kdo odpre issue. To pomeni, da nekdo uporablja.

---

## Najpogostejši razlogi, da tak projekt umre

1. **Brez distribucije.** Koda ni problem. Ti si problem, če ne objaviš.
2. **README brez GIF-a.** Ljudje morajo *videti* output v 2 sekundah.
3. **Issue brez odgovora 3 dni.** Prvih 10 ljudi, ki ti pišejo, odloči, ali bo skupnost.
4. **Zastaran register.** Zato ima `registry.yml` cron. Preveri po prvem ponedeljku, da je tekel.
5. **Iskanje perfekcije namesto objave.** Objavi zdaj, popravi naslednji teden.
