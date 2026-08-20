# dsh-skill-authoring

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin for creating and maintaining **high-quality agent skills**. It scaffolds new skills from a compliant skeleton, audits existing `SKILL.md` files against a 9-point quality gate, and validates skill names against the DSH naming convention — so every skill in your library ships with structure, boundaries, examples, and verification paths.

> The 9-gate standard is derived from [vibe-coding-cn](https://github.com/2025Emma/vibe-coding-cn) (adapted for DSH).

## Features

| Tool | Description |
| --- | --- |
| `skill_scaffold` | Generate a compliant `SKILL.md` skeleton (frontmatter / whenToUse / Boundaries / QuickRef / Examples placeholders) plus `references/index.md` for a new skill. |
| `skill_audit` | Audit an existing `SKILL.md` against the 9 quality gates, printing a `✓/✗` table per gate. |
| `skill_check_name` | Validate a skill name against the DSH regex `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase + hyphens). |

The plugin also installs a `skill-write-guard` hook: when `write`/`edit` targets a `SKILL.md` under `~/.dsh/skills/`, it runs the audit automatically and warns the agent if the file does not pass the 9 gates yet.

## The 9 quality gates

1. **name** — matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 64 chars
2. **description** — "what + when", 20–1024 chars
3. **whenToUse** — ≥ 3 decidable trigger conditions
4. **boundaries** — ≥ 3 "Not For / Boundaries" statements
5. **quickref** — 1–20 directly reusable patterns (Quick Reference)
6. **examples** — ≥ 3 end-to-end examples with Input / Steps / Acceptance
7. **references** — `references/index.md` exists (long content split out)
8. **verification** — uncertain claims marked with source/evidence level
9. **style** — operational-manual style (short imperative sentences, not a doc dump)

## Installation

```bash
dsh plugin --profile web add github:boomzikazita/dsh-skill-authoring
```

Or clone/pin a specific release:

```bash
dsh plugin --profile web add github:boomzikazita/dsh-skill-authoring@v0.1.0
```

After installing, restart your `dsh` web instance (or the profile you installed into) so the tools register.

## Configuration

The plugin ships with no required configuration (`config: {}` in `cordis.patch.yml`). Optional `dsh` config keys passed to the bundle are accepted and currently unused.

- **Skills directory** — defaults to `~/.dsh/skills` (derived from the OS home directory at runtime; no hardcoded paths).
- **Python** — the gate engine (`scripts/skill_gate.py`) is invoked via `python3`; a Python 3.8+ interpreter must be on `PATH`.
- **Scaffold target** — `skill_scaffold` accepts an optional `dir` argument to generate the skeleton outside the default skills directory.

## Development

```bash
node --check index.js                     # syntax check the plugin
python3 -m py_compile scripts/skill_gate.py  # syntax check the gate engine
```

## License

MIT © 2026 boomzikazita — see [LICENSE](./LICENSE).
