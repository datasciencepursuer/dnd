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

**No linting/formatting**: No ESLint, Prettier, or Biome configured. Relies on editor defaults.

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
Uses better-auth for email/password + Google OAuth authentication.
- Server config: `app/.server/auth/auth.server.ts`
- Client: `app/lib/auth-client.ts` (exports `signIn`, `signUp`, `signOut`, `useSession`)
- API routes: `/api/auth/*` handled by `app/routes/api.auth.$.tsx`
- Session helper: `app/.server/auth/session.ts` - use `requireAuth(request)` in loaders (throws redirect to `/login` if unauthenticated)
- Schema: Auth tables (user, session, account, verification) in `app/.server/db/schema.ts`
- Rate limiting: 3 signups per IP per 12 hours
- Google OAuth with account linking (`trustedProviders: ["google"]`)

### Required Environment Variables
- `BETTER_AUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `BETTER_AUTH_URL` - App URL (defaults to http://localhost:5173)
- `DATABASE_URL` - Neon PostgreSQL connection string
- `UPLOADTHING_TOKEN` - UploadThing API token for image uploads
- `RESEND_API_KEY` - Resend API key for sending emails (verification, password reset)
- `VITE_PARTYKIT_HOST` - PartyKit host (defaults to `127.0.0.1:1999` in dev)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth (optional, enables social login)
- `GEMINI_API_KEY` - Google Gemini API key (optional, enables AI DM assistant)

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
- `CombatState` - Initiative order, turn tracking, and precomputed `distances: DistanceEntry[]`
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
- `/g/:groupId` - Group landing page (public-facing)
- `/g/:groupId/schedule` - Group schedule/availability calendar
- `/characters` - Character library
- `/settings` - User settings
- `/invite/group/:token` - Accept group invitation

**Map API Routes**:
- `/api/maps` - Map CRUD (GET list, POST create)
- `/api/maps/:mapId` - Single map operations (GET, PUT, DELETE)
- `/api/maps/:mapId/tokens/:tokenId` - Token CRUD
- `/api/maps/:mapId/tokens/:tokenId/move` - Token movement
- `/api/maps/:mapId/chat` - Chat history (GET) and single message (POST, max 500 chars)
- `/api/maps/:mapId/chat/batch` - Batch chat persistence (POST, called by `useChatPersistence`)
- `/api/maps/:mapId/ai` - AI DM combat assistant (POST, DM-only, requires active combat)
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
- `/api/groups/:groupId/availability` - Weekly availability blocks (GET, POST)
- `/api/groups/:groupId/availability/:id` - Single availability block operations
- `/api/groups/:groupId/schedule-votes` - Local/virtual voting on free time slots

**Character API Routes**:
- `/api/characters` - Character library CRUD (GET list, POST create)
- `/api/characters/:characterId` - Single character operations

### Groups & Team Collaboration
- `groups` - Team organizations with name and owner
- `groupMembers` - Membership with roles (owner/admin/member)
- `groupInvitations` - Email-based invites with tokens
- Permission helpers: `app/.server/permissions/group-permissions.ts`

### Schedule & Availability (`app/features/schedule/`)
Weekly availability calendar for group scheduling.
- `WeeklyCalendar.tsx` - Main calendar component with drag-to-select time blocks
- `AllFreeSlots.tsx` - Shows overlapping availability across members with local/virtual voting
- `MiniMonthCalendar.tsx` - Month navigation
- Real-time sync via `useScheduleSync.ts` hook
- Database tables: `groupAvailabilities` (time blocks), `groupScheduleVotes` (local/virtual preferences)

### Map Presence
- `mapPresence` - Tracks users currently viewing a map (connectionId-based)
- Permission helpers: `app/.server/permissions/map-permissions.ts`

### Real-Time Collaboration (PartyKit)
WebSocket-based real-time sync using PartyKit (`party/map.ts`).
- Config: `partykit.json`
- Client hooks: `useMapSync.ts` (HTTP sync), `usePartySync.ts` (WebSocket)
- Message types use a discriminated union pattern (e.g., `token-move`, `token-update`, `fog-paint`, `fog-erase`, `map-sync`)
- Syncs: token operations, fog painting, pings, drawings, combat, dice rolls, chat messages, token stats, DM transfer, and presence
- Chat: real-time via WebSocket, persisted to DB in JSONB chunks (`mapChatChunks` table). `useChatPersistence` hook flushes pending messages every 30 seconds (skips if no new messages). Also flushes on disconnect, unmount, and beforeunload via `navigator.sendBeacon`. Whisper messages routed server-side to only sender + recipient connections.
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

### AI DM Assistant (`app/.server/ai/`)
Google Gemini-powered combat narration and rules adjudication. DM-only feature.
- `gemini.ts` - Gemini 2.5 Flash integration, serializes full combat context (initiative, distances, HP, conditions, abilities, recent chat)
- `srd-lookup.ts` - SRD monster data lookup with caching from `app/features/map-editor/data/srd-monsters.json`
- `enrich-combat-context.ts` - Matches character abilities to SRD descriptions for richer AI context
- AI never rolls dice for player characters, only monsters/NPCs
- AI never discloses exact monster/NPC HP, max HP, or AC numbers — uses descriptive hints ("badly wounded", "heavily armored") instead. Conditions (e.g. Poisoned, Stunned, Prone) are always OK to reveal
- Enforces D&D 5e action economy (movement, action, bonus action, reaction)
- Max prompt: 500 characters, temperature: 0.8, max output: 8192 tokens

### Monster Compendium
- SRD monster browser in `MonsterCompendium.tsx` with 350+ monsters from `data/srd-monsters.json`
- Filter by Challenge Rating, monster type, and text search
- Override monster stats (HP, AC, abilities) before creating tokens
- `monsterToCharacterSheet()` auto-generates character sheets from SRD data
- `mapMonsterTokenSize()` maps monster size category to grid cell size

### Distance Calculation (`utils/distance-utils.ts`)
D&D 5e closest-edge distance system for combat.
- `computeDistanceMatrix()` - Builds pairwise distance matrix for all combatants (expands monster groups)
- `cellGapDistance()` - Measures gap between token footprint edges
- `gridMovementDistance()` - Center-to-center movement tracking for drag operations
- Distances stored in `CombatState.distances` as `DistanceEntry[]`

### Chat System
- Real-time via WebSocket, persisted to DB in JSONB chunks
- Whisper system: `recipientId`/`recipientName` fields for private messages, routed server-side to only sender + recipient connections
- Chat metadata flags: `aiResponse` (AI DM responses), `playerIntent` (player action declarations), `diceRoll` (dice roll results)
- Dice notation parser and roller built into chat store

### Patch Notes
- Version tracking and changelog in `app/lib/patch-notes.ts`

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->