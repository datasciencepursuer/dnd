# Repository Guidelines

## Project Structure & Module Organization

Application code lives in `app/`. React Router routes are registered in `app/routes.ts`; page and API handlers live in `app/routes/`. Reusable UI belongs in `app/components/`, while domain code is grouped under `app/features/`. Keep database, authentication, email, and permission code in `app/.server/` so it is never bundled for clients. PartyKit logic is in `party/map.ts`, public assets are in `public/`, and database migrations are committed under `drizzle/`.

## Build, Test, and Development Commands

Use the pnpm 10 version pinned in `package.json`.

- `pnpm install` installs workspace dependencies.
- `pnpm dev` starts the React Router and PartyKit development processes.
- `pnpm dev:party` runs only the real-time server.
- `pnpm typecheck` generates route types and runs TypeScript checks.
- `pnpm build` creates the production bundle; do not run it while the development server is active.
- `pnpm start` serves an existing production build.
- `pnpm db:generate` creates SQL migrations after schema changes; commit the generated files.
- `pnpm db:migrate` applies pending migrations locally.

## Coding Style & Naming Conventions

Write strict TypeScript and functional React components. Follow the existing two-space indentation and semicolon style. Use `PascalCase` for components and types, `camelCase` for functions, and `kebab-case` for utility modules. Hooks begin with `use`. Prefer the `~/` alias for application imports. Keep high-frequency Konva pointer and drag updates in refs or imperative node calls rather than React state.

No ESLint, Prettier, or Biome configuration is present; match surrounding code and rely on `pnpm typecheck` before submitting.

## Testing Guidelines

There is no automated test suite or coverage threshold. Validate changes with `pnpm typecheck` and focused manual testing of affected routes, APIs, real-time synchronization, or mobile behavior. If adding tests, colocate `*.test.ts` or `*.test.tsx` files with the feature and add a runner command.

## Commit & Pull Request Guidelines

Recent commits use short, imperative, sentence-case summaries without Conventional Commit prefixes (for example, `Improve rendering latency`). Keep commits focused. Pull requests should include a summary, validation performed, linked issue when applicable, and screenshots or recordings for UI changes. Call out migrations, new environment variables, PartyKit protocol changes, and deployment considerations.

## Security & Configuration

Never commit secrets or local environment files. Access server environment values through the lazy getters in `app/.server/env.ts`; eager reads can break secret-free builds and CI. Enforce authorization in server handlers even when the client already hides an action.
