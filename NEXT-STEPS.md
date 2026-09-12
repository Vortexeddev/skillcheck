# Kaj moraš narediti ti (jaz tega ne morem)

Sandbox, v katerem sem zgradil projekt, nima GitHub kredencialov — preveril sem:
`gh` ni nameščen in ni nobenega tokena. Zato je repo narejen lokalno in ga moraš pushati sam.

Celotna koda je v `~/skillcheck`. Vse je preverjeno: 78 testov, typecheck, build, in CLI teče
proti pravim GitHub repozitorijem.

---

## 1. Ustvari prazen repo na GitHubu

Na github.com → New repository → ime `skillcheck` → **brez** README, brez .gitignore, brez licence
(vse to že imam, sicer bo konflikt pri prvem pushu).

## 2. Preimenuj placeholder slug

Vse kaže na `github.com/skillcheck/skillcheck`. Zamenjaj s svojim:

```bash
cd ~/skillcheck
./scripts/set-repo.sh <tvoj-github-user>/skillcheck
```

Skripta popravi `package.json`, `README.md`, `CONTRIBUTING.md`, `src/index.ts` in `src/output.ts`.
Je idempotentna in jo lahko poženeš večkrat.

## 3. Push

```bash
cd ~/skillcheck
git add -A
git commit -m "skillcheck: license + spec checker for agent skills"
git branch -M main
git remote add origin git@github.com:<tvoj-github-user>/skillcheck.git
git push -u origin main
```

Če `git` v sandboxu nima tvojih ključev, naredi push iz svojega računalnika — sandbox mapa je
vidna v workspace panelu, lahko jo tudi preneseš.

## 4. Objavi na npm

Ime `skillcheck` je prosto (preveril sem: `skill-check`, `skillrank` in `skillscan` so zasedeni).

```bash
npm login
npm publish --access public
```

`prepublishOnly` avtomatsko požene build. Po objavi preveri, da dela:

```bash
npx skillcheck check obra/superpowers
```

## 5. Dodaj GitHub topics

To je SEO na GitHubu in res vpliva na to, kdo te najde:

```
agent-skills  claude-skills  license  spdx  compliance  cli
security  claude-code  cursor  codex  opencode  llm  devtools
```

## 6. Preveri, da CI teče

Po pushu odpri **Actions** in poglej, ali sta `CI` in `Registry` zelena.
`Registry` ima cron ob ponedeljkih 04:17 UTC — po prvem ponedeljku preveri, da se je
`data/registry.ts` res posodobil. To je tisto, kar projekt loči od zastarane awesome-liste.

---

## Znane omejitve (namerno, ne hrošči)

- **Register je vzorec, ne popis.** 166 vnosov = top repozitoriji po zvezdicah iz dveh topic
  oznak, ne vseh 22.678. V README je to jasno napisano. Za več dvigni `perPage`/`MAX_ENTRIES`
  v `scripts/build-registry.ts` — omejitev je GitHub rate limit, zato rabiš token.
- **`--fast` ne loči "brez licence" od "custom licence".** GitHub vrne `license: null` za oboje.
  Zato CI teče v verified načinu s tokenom. `verdict` v fast načinu je zato konservativen.
- **Lokalni `check` prepozna le ~10 najpogostejših licenc** iz besedila (`src/license-sniff.ts`).
  Kar ne prepozna, vrne `null` → orodje reče "needs review", nikoli "safe". To je namerno.
- **Ni security scanninga.** To počne `NVIDIA/SkillSpector`. Ne podvajaj.
- **Ni installerja.** To počne `vercel-labs/skills`. Ne podvajaj.

## Ideje za naprej (po vrsti vrednosti)

1. **Badge API** — trenutno je badge statičen (generated ob checku). Pravi live badge rabi
   serverless funkcijo; GitHub Pages + Actions lahko to naredi brezplačno.
2. **`skillcheck why <repo>`** — razčleni, zakaj je nekaj padlo, z linki na točne vrstice.
3. **GitHub Action kot pravi marketplace action** (`uses: skillcheck/action@v1`) namesto
   `npx` koraka. Veliko nižji prag za uporabo v CI.
4. **PR bot** — avtomatsko odpri PR z LICENSE datoteko na repozitorijih brez nje. To je
   tisto, kar naredi projekt znan; glej `LAUNCH-PLAN.md`, dan 3–7.
5. **Več licenc v tabeli** — vsak PR, ki doda licenco, je dragocen. Trenutno jih je ~30 vzorcev.
