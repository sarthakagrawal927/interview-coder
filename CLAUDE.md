# Project: Interview Coder

## Overview
Full-stack interview preparation platform covering DSA, LLD, HLD, and Behavioral interviews. React 19 + Vite + TypeScript frontend with Supabase auth. Local CLI proxy server for AI chat via Claude/Codex/Gemini CLIs.

## Architecture
- `src/` — React frontend (Vite, TailwindCSS, Monaco Editor)
- `server/` — Express CLI proxy (spawns claude/codex/gemini CLI tools, streams SSE)
- `src/data/` — Problem sets per category (JSON, ProblemsData format)
- `src/hooks/` — Custom hooks (useProblems, useProgress, useAI)
- `src/contexts/` — React contexts (CategoryContext, AuthContext)
- `src/pages/` — Route pages (Dashboard, Patterns, ProblemView, AnkiReview, ImportProblem, Home)

## Key Patterns
- **Unified Problem type** — single interface with optional fields per category (DSA, LLD, HLD, Behavioral)
- **Category-aware routing** — `/:category/*` with CategoryProvider context
- **Lazy data loading** — dynamic imports for category JSON files
- **SSE streaming** — `data: {"text": "..."}\n\n` protocol for AI responses
- **LOCAL_PROVIDERS** — set of CLI-based providers that skip API key validation

## Agent Guidelines
- Use `haiku` model for research, exploration, and simple tasks
- Use `sonnet` for code generation and complex reasoning
- Keep code DRY — no repeated types, no duplicate logic
- Guard optional Problem fields with `|| []`, `|| ''`, conditional rendering
- All category data must conform to `ProblemsData` format: `{ patterns: Pattern[], problems: Problem[] }`

## Commands
- `npm run dev` — Start Vite dev server (port 5173)
- `npm run server` — Start CLI proxy server (port 3456)
- `npm run build` — Build for production
