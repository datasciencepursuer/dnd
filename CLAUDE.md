# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

D&D Map Editor - A React Router v7 full-stack application for creating and managing tabletop RPG maps. Uses React 19, TypeScript (strict mode with `verbatimModuleSyntax`), and Tailwind CSS v4.

## Commands

- `pnpm run dev` - Start development server with HMR (http://localhost:5173)
- `pnpm run dev:party` - Start PartyKit WebSocket server for real-time sync
- `pnpm run dev:all` - Start both React Router and PartyKit servers concurrently
- `pnpm run typecheck` - Generate route types (`react-router typegen`) then run `tsc`
- `pnpm run email:dev` - Preview email templates at http://localhost:3000
- `pnpm drizzle-kit generate` - Generate migration files
- `pnpm drizzle-kit migrate` - Apply pending migrations
- `pnpm run party:deploy` - Deploy PartyKit to production
- `pnpm start` - Serve production build via `react-router-serve`

**Important**: Do not run `pnpm run build` automatically. Ask the user to run it manually for testing. Running `pnpm build` while dev server is active will crash it. The build command runs three steps: `drizzle-kit generate` → `drizzle-kit migrate` → `react-router build`.

**No test suite**: There are no tests configured. No test runner, no test files.

## Architecture

### Routing
- React Router v7 with routes **explicitly configured** in `app/routes.ts` (not auto-discovered from filenames)
- Route types auto-generated in `.react-router/types/`
- Path alias `~/` maps to `app/` directory

### Server-Side Code
- Files in `app/.server/` are server-only (never bundled to client)
- Environment variables: `app/.server/env.ts`

### Database
Drizzle ORM with Neon PostgreSQL serverless.
- Schema: `app/.server/db/schema.ts`
- Client: `app/.server/db/index.ts`
- Config: `drizzle.config.ts`

### Authentication
Uses better-auth for email/password authentication.
- Server config: `app/.server/auth/auth.server.ts`
- Client: `app/lib/auth-client.ts` (exports `signIn`, `signUp`, `signOut`, `useSession`)
- API routes: `/api/auth/*` handled by `app/routes/api.auth.$.tsx`
- Session helper: `app/.server/auth/session.ts` - use `requireAuth(request)` in loaders (throws redirect to `/login` if unauthenticated)
- Schema: Auth tables (user, session, account, verification) in `app/.server/db/schema.ts`
- Rate limiting: 3 signups per IP per 12 hours

### Required Environment Variables
- `BETTER_AUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `BETTER_AUTH_URL` - App URL (defaults to http://localhost:5173)
- `DATABASE_URL` - Neon PostgreSQL connection string
- `UPLOADTHING_TOKEN` - UploadThing API token for image uploads
- `RESEND_API_KEY` - Resend API key for sending emails (verification, password reset)
- `VITE_PARTYKIT_HOST` - PartyKit host (defaults to `127.0.0.1:1999` in dev)

### Map Editor (`app/features/map-editor/`)
Canvas-based map editor using Konva.js (`react-konva`).

**Vite SSR note**: Konva requires both `ssr.noExternal` AND `optimizeDeps.include` for `["konva", "react-konva"]` in `vite.config.ts`.

**Konva Performance Pattern**: Avoid React state updates during high-frequency events (mouse/touch move). Use refs for intermediate values and update Konva nodes imperatively via `node.x()`, `node.width()`, `node.getLayer().batchDraw()`. React state should only change on start/end of interactions (e.g., mousedown/mouseup), not during drag/move. See `MapCanvas.tsx` viewport handling and drag rectangle as examples.

**State Management** - Five Zustand stores:
- `map-store.ts` - Persisted map data (tokens, grid, fog, combat, drawings, character sheets). Uses `zundo` temporal middleware for undo/redo (50 history limit). Implements dirty token tracking with 10-second staleness window for optimistic updates.
- `editor-store.ts` - Ephemeral UI state (selected tool, selection, permissions, ping rate limiting). No persistence.
- `dice-store.ts` - Dice rolling state and history (keeps last 8 rolls)
- `presence-store.ts` - Real-time user presence tracking for collaborative editing
- `chat-store.ts` - Chat messages, unread count, and pending persistence buffer. Max 200 messages in memory. Includes dice notation parser and roller.

**Key Types** (`types.ts`):
- `DnDMap` - Complete map document (grid, tokens, walls, areas, fog, viewport, combat, drawings)
- `Token` - Map token with position (`GridPosition`), layer, size, image/color, character sheet
- `GridSettings` - Grid config (type: square/hex, cellSize, dimensions)
- `EditorTool` - Tool enum (select, pan, draw, erase, token, wall, area, text, fog-reveal, fog-hide, ping)
- `CharacterSheet` - Full D&D 5e character sheet (abilities, skills, weapons, spells, equipment, death saves)
- `CombatState` - Initiative order and turn tracking
- `MonsterGroup` - Groups monsters for shared initiative
- `PlayerPermissions` - Granular permissions for token/map operations
- `EditorContext` - Current user's permission context

**Persistence**:
- LocalStorage via `features/map-editor/utils/storage-utils.ts`
- Database: Drizzle/Neon PostgreSQL (`app/.server/db/schema.ts`)

**Page Routes**:
- `/maps` - Map list
- `/playground` - New map
- `/playground/:mapId` - Edit existing map
- `/groups` - Group list
- `/groups/:groupId` - Group detail with maps
- `/characters` - Character library
- `/invite/group/:token` - Accept group invitation

**Map API Routes**:
- `/api/maps` - Map CRUD (GET list, POST create)
- `/api/maps/:mapId` - Single map operations (GET, PUT, DELETE)
- `/api/maps/:mapId/tokens/:tokenId` - Token CRUD
- `/api/maps/:mapId/tokens/:tokenId/move` - Token movement
- `/api/maps/:mapId/chat` - Chat history (GET) and single message (POST, max 500 chars)
- `/api/maps/:mapId/chat/batch` - Batch chat persistence (POST, called by `useChatPersistence`)
- `/api/uploadthing` - Image upload endpoint
- `/api/uploadthing/files` - File operations
- `/api/uploads` - Upload management

**Group API Routes**:
- `/api/groups` - Group CRUD (GET list, POST create)
- `/api/groups/:groupId` - Single group operations
- `/api/groups/:groupId/members` - Group member management
- `/api/groups/:groupId/members/:userId` - Individual member operations
- `/api/groups/:groupId/invite` - Send group invitations
- `/api/groups/:groupId/leave` - Leave a group
- `/api/groups/:groupId/tokens` - Group token library
- `/api/groups/:groupId/meetups` - Group meetup scheduling (GET list, POST create)
- `/api/groups/:groupId/meetups/:meetupId` - Single meetup operations

**Character API Routes**:
- `/api/characters` - Character library CRUD (GET list, POST create)
- `/api/characters/:characterId` - Single character operations

### Groups & Team Collaboration
- `groups` - Team organizations with name and owner
- `groupMembers` - Membership with roles (owner/admin/member)
- `groupInvitations` - Email-based invites with tokens
- Permission helpers: `app/.server/permissions/group-permissions.ts`

### Map Presence
- `mapPresence` - Tracks users currently viewing a map (connectionId-based)
- Permission helpers: `app/.server/permissions/map-permissions.ts`

### Real-Time Collaboration (PartyKit)
WebSocket-based real-time sync using PartyKit (`party/map.ts`).
- Config: `partykit.json`
- Client hooks: `useMapSync.ts` (HTTP sync), `usePartySync.ts` (WebSocket)
- Message types use a discriminated union pattern (e.g., `token-move`, `token-update`, `fog-paint`, `fog-erase`, `map-sync`)
- Syncs: token operations, fog painting, pings, drawings, combat, dice rolls, chat messages, token stats, DM transfer, and presence
- Chat: real-time via WebSocket, persisted to DB in JSONB chunks (`mapChatChunks` table). `useChatPersistence` hook flushes pending messages every 30 seconds (skips if no new messages). Also flushes on disconnect, unmount, and beforeunload via `navigator.sendBeacon`.
- Auto-save: 1-2 second debounce after changes
- Dirty token tracking: Prevents server updates from overwriting local optimistic updates during 10-second staleness window
- Broadcasts exclude sender (they already have the update)

### File Uploads
Uses UploadThing for image uploads (token images, map backgrounds).
- Server config: `app/.server/uploadthing.ts`
- Client utilities: `app/utils/uploadthing.ts`
- Upload limits constants: `app/lib/upload-limits.ts`
- Two uploaders: `tokenImageUploader` (16MB, up to 10 images) and `mapBackgroundUploader` (32MB, single image)

### Email Templates
- React Email templates in `app/.server/emails/`
- Verification email and password reset email
- Preview with `pnpm run email:dev`
- Uses Resend API; dev mode sends from `onboarding@resend.dev`

### Styling
- Tailwind CSS v4 with Vite plugin
- Dark mode via `prefers-color-scheme`

### Permissions Model
- Map owner = Dungeon Master (DM) with full permissions
- Group members viewing a map = Player with limited permissions
- `PlayerPermissions` interface defines granular permissions (create/edit/delete/move tokens)
- Permission checks via `editor-store.ts`: `isDungeonMaster()`, `canEditToken()`, `canMoveToken()`
- Server-side permission checks: `app/.server/permissions/map-permissions.ts` and `group-permissions.ts`

### Patch Notes
- Version tracking and changelog in `app/lib/patch-notes.ts`
