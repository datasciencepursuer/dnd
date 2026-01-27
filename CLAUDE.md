# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

D&D Map Editor - A React Router v7 full-stack application for creating and managing tabletop RPG maps. Uses React 19, TypeScript (strict mode), and Tailwind CSS v4.

## Commands

- `pnpm run dev` - Start development server with HMR (http://localhost:5173)
- `pnpm run typecheck` - Run TypeScript type checking and generate route types
- `pnpm drizzle-kit push` - Push schema changes to database

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

### Required Environment Variables
- `BETTER_AUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `BETTER_AUTH_URL` - App URL (defaults to http://localhost:5173)
- `DATABASE_URL` - Neon PostgreSQL connection string
- `UPLOADTHING_TOKEN` - UploadThing API token for image uploads

### Map Editor (`app/features/map-editor/`)
Canvas-based map editor using Konva.js (`react-konva`).

**State Management** - Four Zustand stores:
- `map-store.ts` - Persisted map data (tokens, grid, fog). Uses `zundo` temporal middleware for undo/redo (50 history limit)
- `editor-store.ts` - Ephemeral UI state (selected tool, selection, permissions). No persistence.
- `dice-store.ts` - Dice rolling state and history (keeps last 8 rolls)
- `presence-store.ts` - Real-time user presence tracking for collaborative editing

**Key Types** (`types.ts`):
- `DnDMap` - Complete map document (grid, tokens, walls, areas, fog, viewport)
- `Token` - Map token with position (`GridPosition`), layer, size, image/color
- `GridSettings` - Grid config (type: square/hex, cellSize, dimensions)
- `EditorTool` - Tool enum (select, pan, draw, erase, token, wall, area, text, fog-reveal, fog-hide)
- `PlayerPermissions` - Granular permissions for token/map operations
- `EditorContext` - Current user's permission context

**Persistence**:
- LocalStorage via `features/map-editor/utils/storage-utils.ts`
- Database: Drizzle/Neon PostgreSQL (`app/.server/db/schema.ts`)

**Routes**:
- `/maps` - Map list
- `/playground` - New map
- `/playground/:mapId` - Edit existing map
- `/invite/:token` - Accept map invitation

**API Routes**:
- `/api/maps` - Map CRUD
- `/api/maps/:mapId` - Single map operations
- `/api/maps/:mapId/share` - Share map with users
- `/api/maps/:mapId/transfer` - Transfer map ownership
- `/api/maps/:mapId/presence` - Get/update user presence
- `/api/maps/:mapId/presence/leave` - Remove user presence on disconnect
- `/api/uploadthing` - Image upload endpoint

### Map Sharing & Permissions
Database tables in `app/.server/db/schema.ts`:
- `mapPermissions` - User access levels (view/edit/owner) with optional custom permissions
- `mapInvitations` - Email-based invites with tokens for users who may not have accounts
- `mapPresence` - Tracks users currently viewing a map (connectionId-based)

### File Uploads
Uses UploadThing for image uploads (token images, map backgrounds).
- Server config: `app/.server/uploadthing.ts`
- Client utilities: `app/utils/uploadthing.ts`
- Two uploaders: `imageUploader` (single, 4MB) and `tokenImageUploader` (up to 10 images, 4MB each)

### Styling
- Tailwind CSS v4 with Vite plugin
- Dark mode via `prefers-color-scheme`
