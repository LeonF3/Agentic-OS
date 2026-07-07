# Phase 1: Chats Sidebar Tab — Implementation Log

**Date:** 2026-07-06  
**Scope:** Minimal Chats UI over existing `AgentRun` records (no new backend models or API routes)

---

## Summary

Phase 1 adds a **Chats** sidebar tab with a workspace-scoped chat list, detail view for past runs, and a "New chat" compose flow. One `AgentRun` = one chat turn (matches current architecture). No new `/api/chats` routes or schema changes.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/Shell.tsx` | Added **Chats** nav item under Command (`/chats`, `MessageSquare` icon). Command palette picks it up automatically via `NAV`. |
| `src/app/chats/page.tsx` | **New** — full two-column Chats page (list + detail/compose). |
| `src/app/workspace/page.tsx` | Chats bucket items now link to `/chats?run={id}` (was `href: null`). |
| `src/app/page.tsx` | Mission Control "Recent agent runs" → **Recent chats**; items link to `/chats?run={id}`; footer link → All chats. |

---

## New Page: `/chats`

**Path:** `src/app/chats/page.tsx`

### Layout

- **Left column (1/4):** "New chat" button + scrollable list of workspace runs (newest first)
- **Right column (3/4):** Compose panel OR selected run detail

### Data fetching (no new APIs)

```ts
useApi("/api/workspaces/active")           // active workspace
useApi(`/api/runs?workspaceId=${ws.id}&limit=100`)  // chat list
useApi("/api/agents")                      // agent picker
```

### Features

| Feature | Implementation |
|---------|----------------|
| Workspace-scoped list | Filters runs via `?workspaceId=` on `GET /api/runs` |
| Deep link | `?run={id}` selects run; synced with `useSearchParams` + `router.replace` |
| New chat | Compose mode with agent `Select`, `Textarea`, ⌘⏎ to send |
| Create run | `POST /api/agents/{id}/run` with `{ input, workspaceId }` |
| Detail view | Input bubble, Markdown output, expandable timeline logs, agent link |
| Empty states | No workspace, no agents, no chats |
| Polling | Runs refresh every 15s (`useApi` refreshInterval) |

### Reused components

- `PageHeader`, `Card`, `Badge`, `Button`, `Select`, `Textarea`, `EmptyState`, `Spinner`
- `Markdown` (output rendering)
- `useApi`, `api`, `refresh` from `@/lib/useApi`
- `timeAgo`, `truncate` from `@/lib/format`
- `Suspense` wrapper for `useSearchParams` (Next.js requirement)

---

## Sidebar Navigation

**File:** `src/components/Shell.tsx`

```
Command
  Mission Control  /
  Chats            /chats   ← NEW
  Agent Roster     /agents
  Goals            /goals
  Kanban           /kanban
```

---

## Cross-links Added

| Surface | Before | After |
|---------|--------|-------|
| Workspace Buckets → Chats bucket | Not clickable | Links to `/chats?run={id}` |
| Mission Control → Recent runs | Title only, link to Agent Roster | Clickable rows → `/chats?run={id}`, header → `/chats` |

---

## APIs Used (unchanged)

All existing endpoints; **no request/response shape changes**.

| Endpoint | Usage |
|----------|-------|
| `GET /api/workspaces/active` | Resolve active workspace |
| `GET /api/runs?workspaceId=&limit=100` | Chat list |
| `GET /api/agents` | Agent picker (filters `status !== "disabled"`) |
| `POST /api/agents/[id]/run` | Create new chat (`RunInput`: `input`, `workspaceId`) |

### Not modified (preserved contracts)

- `POST /api/agents/[id]/run`
- `GET /api/runs`, `GET /api/runs/[id]`, `DELETE /api/runs/[id]`
- `GET /api/agents`, `GET /api/agents/[id]`
- `GET/PUT /api/workspaces/active`, `GET /api/workspaces`
- `{ ok, data, error }` envelope

---

## Data Model

No changes. Chats are `AgentRun` records in `.swos-data/runs.json`:

- `workspaceId` — scopes list to active workspace
- `agentId` — shown in list + detail
- `input` — user message / list preview
- `output` — agent response (Markdown)
- `title`, `status`, `logs`, `startedAt` — metadata

---

## Verification

```bash
npm run typecheck   # pass
npm run lint        # pass
```

### Manual test plan

1. Open app → sidebar shows **Chats** under Command
2. Switch workspace → chat list updates
3. Click **New chat** → compose with agent select → Send → new run appears, detail opens
4. Click past chat in left list → detail shows input + output + timeline
5. Visit `/chats?run={id}` directly → run pre-selected
6. Workspace Buckets → Chats → item opens correct chat
7. Mission Control → Recent chats row opens correct chat
8. ⌘K command palette → "Chats" navigates to `/chats`

---

## Not in Phase 1 (deferred)

- Multi-turn chat sessions / threading (`ChatSession` model)
- `/api/chats` routes
- Reply-in-thread on existing chat (would create new isolated run today)
- `GET /api/runs/[id]` dedicated fetch (list payload is sufficient)
- Delete chat from Chats UI (`DELETE /api/runs/[id]` exists but not wired)

---

## Phase 2 Preview (if needed later)

True multi-turn conversations require a new schema, e.g.:

```ts
ChatSession { id, workspaceId, agentId, title, runIds: string[], createdAt, updatedAt }
```

Plus `/api/chats` CRUD and engine changes to append runs to a session. Do **not** overload `AgentRun` without a grouping field — Loop, audit, and bucket logic assume one run = one vault write.
