# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Router v7 full-stack application with server-side rendering, created from the `create-react-router` template. It uses React 19, TypeScript (strict mode), and Tailwind CSS v4.

## Commands

- `pnpm run dev` - Start development server with HMR (http://localhost:5173)
- `pnpm run typecheck` - Run TypeScript type checking and generate route types
- `pnpm run start` - Start production server (after build)

**Important**: Do not run `pnpm run build` automatically. Ask the user to run it manually for testing. Running `pnpm build` while dev server is active will crash it.

## Architecture

### Routing
- React Router v7 file-based routing configured in `app/routes.ts`
- Route types are auto-generated in `.react-router/types/`
- Path alias `~/` maps to `app/` directory

### Server-Side Rendering
- SSR is enabled by default (`react-router.config.ts`)
- `app/root.tsx` contains the root layout, meta tags, and error boundary
- Environment detection available via `import.meta.env.DEV`

### Styling
- Tailwind CSS v4 with Vite plugin integration
- Global styles in `app/app.css`
- Dark mode configured via `prefers-color-scheme`

### Build Output
- `/build/server/` - Server-side code
- `/build/client/` - Static assets
