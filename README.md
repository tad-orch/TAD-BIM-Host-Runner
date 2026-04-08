# TAD BIM Platform

This repository is an npm-workspaces monorepo. The backend/API/MCP gateway lives in `apps/mcp`, and the Phase 5 frontend now lives in `apps/web`.

## Three-Repo System

The current Revit operations flow spans three repositories:

- `TadOcRevitBridge`
  - Revit add-in execution layer
  - source of truth for Revit API execution, active document state, cloud model opening, 3D view listing, and NWC export
- `TAD-Bridge-OC`
  - Windows bridge and secure HTTP surface
  - handles process checks, Revit launch, and relays structured requests to the add-in
- `TAD-BIM-Host-Runner`
  - MCP/backend orchestrator and web API
  - owns typed tool contracts, host routing, APS discovery, jobs, audit, conversations, and deterministic chat routing

## Current Workspace

- `apps/mcp`
  - the existing Revit MCP gateway and backend API
  - preserves the current bridge execution flow
  - preserves MCP, API, health, execute, and legacy job routes
  - uses SQLite for hosts, jobs, audit logs, conversations, and messages
- `apps/web`
  - React + Vite + TypeScript frontend
  - Tailwind CSS with lightweight shadcn-style UI primitives
  - routes for chat, jobs, hosts, and schedules
  - talks to the existing backend without changing bridge logic or backend flow

Implemented backend routes remain unchanged:

- `GET /health`
- `POST /execute`
- `GET /jobs/:jobId`
- `POST /mcp/tools/mcp-arch-system-health`
- `POST /mcp/tools/mcp-arch-walls-create`
- `POST /mcp/tools/mcp-arch-revit-session-status`
- `POST /mcp/tools/mcp-arch-revit-launch`
- `POST /mcp/tools/mcp-arch-revit-open-cloud-model`
- `POST /mcp/tools/mcp-arch-revit-list-3d-views`
- `POST /mcp/tools/mcp-arch-revit-export-nwc`
- `POST /api/chat`
- `GET /api/jobs`
- `GET /api/jobs/:jobId`
- `GET /api/hosts`
- `GET /api/conversations`
- `GET /api/conversations/:id/messages`
- `GET /api/aps/projects`
- `GET /api/aps/projects/:projectId/top-folders`
- `GET /api/aps/projects/:projectId/folders/:folderId/contents`
- `GET /api/aps/projects/:projectId/items/:itemId/cloud-model-info`

## Run From Root

Install dependencies:

```bash
npm install
```

Start only the backend in development:

```bash
npm run dev:mcp
```

Start only the frontend in development:

```bash
npm run dev:web
```

Start backend and frontend together:

```bash
npm run dev
```

Build only the backend:

```bash
npm run build:mcp
```

Build only the frontend:

```bash
npm run build:web
```

Run backend tests:

```bash
npm run test:mcp
```

Run backend typecheck:

```bash
npm run typecheck:mcp
```

Run frontend typecheck:

```bash
npm run typecheck:web
```

Convenience aliases from the root:

- `npm run dev` runs `apps/mcp` and `apps/web` together
- `npm run build` builds `apps/mcp` and `apps/web`
- `npm run test`
- `npm run typecheck` typechecks `apps/mcp` and `apps/web`

## Frontend Pages

The web app lives at `apps/web` and currently includes:

- `/chat`
  - target host selector
  - recent conversation list
  - dedicated scrollable conversation history
  - anchored compose area with quick actions
  - uses `GET /api/hosts`, `GET /api/conversations`, `GET /api/conversations/:id/messages`, and `POST /api/chat`
- `/jobs`
  - latest-first job list
  - filters for status, target host, and tool
  - split table/detail panel from `GET /api/jobs/:jobId`
- `/hosts`
  - registered hosts, machine type, enabled tools, and active status
- `/schedules`
  - lightweight scaffold page for the next scheduler phase

## Frontend Dev Notes

- default frontend dev server: `http://127.0.0.1:5173`
- default backend target in local frontend proxy: `http://127.0.0.1:8080`
- the frontend assumes the backend runs separately and calls the existing API without backend changes
- recommended frontend env example: `apps/web/.env.example`
- if you need a non-default backend origin for the frontend, set `VITE_DEV_BACKEND_URL` for local Vite proxying or `VITE_API_BASE_URL` when building

## Environment Setup

Backend example env:

```bash
cp apps/mcp/.env.example apps/mcp/.env
```

Frontend example env:

```bash
cp apps/web/.env.example apps/web/.env
```

Notes:

- real `.env` files are ignored and should not be committed
- replace the placeholder bridge URL and bearer token in `apps/mcp/.env`
- `apps/web/.env` is optional for local development when the backend runs at `http://127.0.0.1:8080`
- if a real bridge token was ever committed in a previous `apps/mcp/.env`, rotate it manually

## Backend Notes

- backend package path: `apps/mcp`
- backend env file path: `apps/mcp/.env`
- backend example env file path: `apps/mcp/.env.example`
- default backend data directory: `apps/mcp/data`
- default SQLite path: `apps/mcp/data/app.db`

`HOSTS_JSON`, bridge dispatch, MCP mappings, deterministic `/api/chat` routing, and the existing async polling flow are unchanged.

The current Revit workflow is:

1. `mcp-arch-revit-session-status`
2. `mcp-arch-revit-launch`
3. APS discovery through `/api/aps/*`
4. `mcp-arch-revit-open-cloud-model`
5. `mcp-arch-revit-list-3d-views`
6. `mcp-arch-revit-export-nwc`

The current deterministic `/api/chat` support now includes:

- Revit health checks
- Revit session status checks
- Revit launch requests
- wall creation with numeric length

The canonical MCP payload for cloud opening now uses:

- `projectGuid`
- `modelGuid`
- `region`
- `openInUi`
- `audit`
- `worksets.mode`
- `cloudOpenConflictPolicy`

Temporary compatibility aliases remain accepted on the MCP route for existing callers:

- `projectId` -> `projectGuid`
- `openInCurrentSession` -> `openInUi`
- `detach=true` -> `cloudOpenConflictPolicy=detach_from_central`

## APS Discovery Notes

- APS discovery lives inside `apps/mcp/src/integrations/aps`
- it uses two-legged auth from the backend, not the bridge and not the add-in
- it supports the current env naming conventions used in this workflow:
  - `APS_CLIENT_ID`
  - `APS_CLIENT_SECRET`
  - `APS_BASE_URL`
  - `APS_SCOPES`
  - `APS_ACCOUNT_ID`
  - `APS_USER_ID`
  - `APS_TOKEN_STORAGE_PATH`
- `APS_CALLBACK_URL` is optional and reserved for future three-legged flows; it is not required for this phase
- `/api/aps/projects/:projectId/items/:itemId/cloud-model-info` resolves ACC/BIM 360 version metadata and returns `projectGuid`, `modelGuid`, `region`, `versionExtensionType`, and an `openCloudModelRequest` payload ready for `mcp-arch-revit-open-cloud-model`
- callers still add `targetHost` when invoking the MCP tool
- token caching is supported in memory and on disk; by default the cache file lives under `apps/mcp/data/auth/aps-token.json`
- APS discovery only provides metadata and GUIDs; Revit still needs an authenticated local Autodesk/Revit user session on the target machine to actually open the cloud model

Example setup:

```bash
cp apps/mcp/.env.example apps/mcp/.env
```

Then set:

- `APS_CLIENT_ID`
- `APS_CLIENT_SECRET`
- optionally `APS_ACCOUNT_ID` to pin discovery to a known ACC hub/account context
- optionally `APS_USER_ID` if your local conventions expect a user context value
- optionally `APS_TOKEN_STORAGE_PATH` to override the token cache file location
- optionally `APS_SCOPES` if `data:read` is not sufficient

## Backend Docs

- [Architecture](apps/mcp/docs/architecture.md)
- [Database](apps/mcp/docs/database.md)

## Current Contract Caveats

- `TadOcRevitBridge` already implements `revit_open_cloud_model`, `revit_list_3d_views`, and `revit_export_nwc`
- `TAD-Bridge-OC` already exposes HTTP routes for those tools, but its current action files still return `NOT_IMPLEMENTED` instead of queueing to the add-in
- `revit_launch` is live and sync at the bridge layer, so the MCP/backend now treats it as sync as well
- APS discovery is backend-only in this phase; `/api/chat` still stays intentionally narrow and deterministic

## Planned Later

Not implemented yet:

- `apps/telegram`
- scheduler APIs and scheduler execution flow
- Telegram integration
- LLM-assisted chat interpretation on the execution path
