# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

D&D Map Editor - A React Router v7 full-stack application for creating and managing tabletop RPG maps. Uses React 19, TypeScript (strict mode), and Tailwind CSS v4.

## Commands

- `pnpm run dev` - Start development server with HMR (http://localhost:5173)
- `pnpm run typecheck` - Run TypeScript type checking and generate route types
- `pnpm drizzle-kit push` - Push schema changes to database (requires DATABASE_URL in .env)

**Important**: Do not run `pnpm run build` automatically. Ask the user to run it manually for testing. Running `pnpm build` while dev server is active will crash it.

## Architecture

### Routing
- React Router v7 file-based routing configured in `app/routes.ts`
- Route types auto-generated in `.react-router/types/`
- Path alias `~/` maps to `app/` directory

### Server-Side Code
- Files in `app/.server/` are server-only (never bundled to client)
- Environment variables: `app/.server/env.ts`

### Authentication
Uses better-auth for email/password authentication.
- Server config: `app/.server/auth/auth.server.ts`
- Client: `app/lib/auth-client.ts` (exports `signIn`, `signUp`, `signOut`, `useSession`)
- API routes: `/api/auth/*` handled by `app/routes/api.auth.$.tsx`
- Session helper: `app/.server/auth/session.ts` - use `requireAuth(request)` in loaders
- Schema: Auth tables (user, session, account, verification) in `app/.server/db/schema.ts`

**Required env vars:**
- `BETTER_AUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `BETTER_AUTH_URL` - App URL (defaults to http://localhost:5173)
- `DATABASE_URL` - Neon PostgreSQL connection string

### Map Editor (`app/features/map-editor/`)
Canvas-based map editor using Konva.js (`react-konva`).

**State Management** - Two Zustand stores with different purposes:
- `map-store.ts` - Persisted map data (tokens, grid, fog). Wraps with `zundo` temporal middleware for undo/redo (50 history limit)
- `editor-store.ts` - Ephemeral UI state (selected tool, selection, drawing state). No persistence or undo.

**Key Types** (`types.ts`):
- `DnDMap` - Complete map document (grid, tokens, walls, areas, fog, viewport)
- `Token` - Map token with position (`GridPosition`), layer, size, image/color
- `GridSettings` - Grid config (type: square/hex, cellSize, dimensions)
- `EditorTool` - Tool enum (select, pan, token, wall, area, text, fog-reveal, fog-hide)

**Persistence**:
- Currently LocalStorage via `utils/storage-utils.ts` (index + individual map storage)
- Database schema ready in `app/.server/db/schema.ts` (Drizzle/Neon PostgreSQL)

**Routes**: `/maps` (list), `/playground` (new), `/playground/:mapId` (edit)

### Styling
- Tailwind CSS v4 with Vite plugin
- Dark mode via `prefers-color-scheme`
