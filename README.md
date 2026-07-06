# Sebastian's Wonderland OS (SWOS)

Mission Control for your life, work, business, agents, memory, and creative production.
Local-first. File-backed. Every output compounds.

## Run it

```bash
npm install
npm run dev
```

Open **http://localhost:3737**. First load seeds five workspaces (Leon HQ, Quit 9-5, Chosn,
Starfish, Personal), the agent roster, model providers, and a couple of clearly-labeled
starter cards you can edit or delete.

Change the port in `package.json` (`dev`/`start` scripts, `-p 3737`).

## The 7 layers

| Layer | Surface |
| --- | --- |
| I — Foundation | System Health (live checks), Terminal (guard-railed), Settings |
| II — Memory | The Vault: markdown notes in `.swos-data/vault/`, PARA folders, tags, backlinks, search, write queue |
| III — Brain | Model routing: OpenRouter / Anthropic / OpenAI / Gemini / xAI / Local Dev Adapter, per-task-type rules, fallbacks |
| IV — Agents | 13-agent roster (Hermes, OpenClaw, Codex, Antigravity, Free Claude Code + system agents) with real run records |
| V — Command | Mission Control dashboard, ⌘K palette, global search, workspace switcher |
| VI — Production | Goals, Kanban (drag & drop), Studio, SEO, Notebook, Workspace Buckets |
| VII — Loop | Every output → memory write queue → approved/auto → markdown note → reindex |

## Model keys (all optional)

Copy `.env.example` → `.env.local` and add any keys you have, then restart:

- `OPENROUTER_API_KEY` — default everyday brain (Owl Alpha / free models)
- `ANTHROPIC_API_KEY` — reasoning-heavy work
- `OPENAI_API_KEY` — coding
- `GEMINI_API_KEY` — long-context
- `XAI_API_KEY` — multimodal / Studio

With **no keys**, the OS runs fully on the **Local Dev Adapter** — a deterministic offline
adapter that labels itself on every output. Nothing pretends to be a model.

## Data & backup

Everything lives in `.swos-data/` (JSON collections + markdown vault + uploads).
Copy that folder to back up the whole OS. Point Obsidian at `.swos-data/vault/` to
browse your memory. Override the location with `SWOS_DATA_DIR`.

## Scripts

```bash
npm run dev        # dev server on :3737
npm run build      # production build
npm start          # production server on :3737
npm run typecheck  # tsc --noEmit
npm test           # vitest unit tests (store, vault, router, generators, terminal)
npm run lint       # eslint
```

## Honest limitations

- Media **generation** requires a configured multimodal provider; without one, Studio saves prompt packages and uploads only (clearly labeled).
- SEO **rank tracking** needs an external rank API — not connected; the tracker stores keywords/pages and generates schema, briefs, and internal links locally.
- Notebook exports NotebookLM-compatible markdown; it does not sync to NotebookLM directly.
- Single-user local app: no auth. Don't expose the port publicly.
