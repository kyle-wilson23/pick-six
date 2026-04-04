# Story 1.1: Initialize Next.js app with MUI shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the repository scaffolded with Next.js App Router, TypeScript, ESLint, and MUI theming per architecture,
so that all features build on a consistent, deployable foundation.

## Acceptance Criteria

1. **Given** a clean repo ready for application code  
   **When** the project is initialized with `create-next-app@latest` (TypeScript, App Router, ESLint) and MUI is added with the project dark theme (emerald/gold accent, Inter) using **Stack** for flex layouts  
   **Then** `pnpm dev` (or npm/yarn) starts the app and a root layout renders without errors  
   **And** `src/` structure matches architecture (`src/app`, `src/components`, `src/lib` placeholders as needed) and **NFR53** (Vercel-compatible Next app) is satisfied at scaffold level  

2. Root `page.tsx` demonstrates the theme (e.g. typography using Inter, primary button using emerald primary) using **MUI `Stack`** for layout (not ad-hoc `Box` grids for flex rows/columns).

3. ESLint runs clean for the scaffolded files (no new-disable comments to hide errors).

## Tasks / Subtasks

- [x] Run `create-next-app@latest` in repo root with **TypeScript**, **ESLint**, **App Router**, **`src/` directory** — align with [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app) (use non-interactive flags if preferred for reproducibility).
- [x] Add **MUI** + Emotion + official Next App Router integration (`@mui/material-nextjs` per [MUI Next.js docs](https://mui.com/material-ui/guides/next-js-app-router/)); wrap root layout with cache provider + `ThemeProvider` using a **client** theme module.
- [x] Implement **dark theme** tokens from UX spec: charcoal background `#121212`, emerald primary (see UX palette: primary `#2ECC71` / `#27AE60` variants), **gold accent** for special highlights (`accent.gold` family in `theme.palette` extension), **Inter** font via `next/font/google`.
- [x] Create minimal folder placeholders: `src/components/.gitkeep` or a trivial `src/components/common/` export; `src/lib/` with empty `index` or README placeholder — **do not** wire Prisma/auth yet (Epic 1 later stories).
- [x] Verify `pnpm` (or chosen package manager) scripts: `dev`, `build`, `lint` succeed; `build` proves Vercel-style deployability (**NFR53** at scaffold level).
- [x] Document in `README.md` (short) how to install and run — update existing “Where things stand” to reflect app exists.

## Dev Notes

### Epic context

- **Epic 1** establishes identity and sessions. This story is **foundation only** — no database, Auth.js, or protected routes yet (Stories 1.2–1.6).
- Later stories assume **single** `src/` tree per architecture; avoid generating app outside `src/`.

### Technical requirements

- **Package manager:** Prefer **pnpm** if the team standardizes on it; otherwise lock one manager and document it (`packageManager` field optional).
- **create-next-app:** Use `@latest` at implementation time; pin resulting versions in `package.json` — do not invent version numbers in planning docs.
- **Tailwind:** Default CNA may ship Tailwind. Architecture says **MUI is source of truth** for UI; avoid duplicating layout/spacing with Tailwind for the same surfaces. Either omit Tailwind at CLI if allowed, or keep it minimal and unused until a conscious decision.
- **MUI layout rule:** Use **`Stack`** for flex layouts (project convention); `Box` only when a single wrapper is clearly enough.
- **Theme:** Extend MUI theme for `accent.gold` / `accent.goldLight` / `accent.goldDark` per UX spec (`_bmad-output/planning-artifacts/ux-design-specification.md` — Visual Design / color tables).
- **Fonts:** `next/font/google` for **Inter**; apply via theme `typography.fontFamily`.

### Architecture compliance

- **Starter:** First implementation slice = **`create-next-app@latest`** — [Source: `_bmad-output/planning-artifacts/architecture.md` — Starter Template Evaluation]
- **Target tree:** After scaffold, align with `src/app`, `src/components`, `src/lib` as in architecture “Complete project directory structure” — full route groups `(auth)`, `(app)`, `api/*` are **targets**; for **this story** only `layout.tsx`, `page.tsx`, `globals.css` under `src/app` are required; optional stub folders are fine.
- **NFR53:** Deployability to Vercel-class hosts — `next build` must pass; no custom server required.
- **Forbidden:** No `NEXT_PUBLIC_*` secrets; no second `utils/` tree at repo root — use `src/lib` only when adding helpers [Source: `docs/project-context.md`]

### Library & framework requirements

| Area | Requirement |
|------|-------------|
| Framework | Next.js App Router, TypeScript strict (enable when scaffold allows) |
| UI | `@mui/material`, `@mui/material-nextjs` (App Router cache), `@emotion/*` as per MUI install docs |
| Lint | ESLint config from CNA + ESLint flat config if generated (`eslint.config.mjs`) |
| Icons | `@mui/icons-material` optional — only if needed for placeholder page |

Follow MUI’s **version-specific** import for `AppRouterCacheProvider` (e.g. `v15-appRouter` vs `v14-appRouter`) matching the **installed Next.js major** after scaffold.

### File structure requirements

Minimum after completion:

```
src/
├── app/
│   ├── layout.tsx      # html/body, providers, font
│   ├── page.tsx        # themed shell demo
│   └── globals.css     # global resets; MUI handles most styling
├── components/         # at least placeholder or one shared component
└── lib/                # placeholder for future db.ts, etc.
```

Do **not** add `prisma/` or Auth routes until Story 1.2+.

### Testing requirements

- **This story:** Manual verification — dev server, production build, lint. No test framework required unless CNA already adds Vitest/Jest; if present, keep default hello test passing.
- **Later:** Co-located tests per architecture when features land.

### Git intelligence (recent repo state)

- Recent commits are planning/artifact updates (`README`, epics, sprint planning). **No application `src/` yet** — this story is greenfield scaffold.

### Latest technical notes (verify at implementation)

- **Next.js:** Read current CNA docs for non-interactive flags (`--ts`, `--eslint`, `--app`, `--src-dir`, `--no-tailwind` if available).
- **MUI:** Use official [Next.js App Router integration](https://mui.com/material-ui/guides/next-js-app-router/) — `AppRouterCacheProvider` + `ThemeProvider` for correct SSR/flicker-free styles.

### Project context reference

- Short rule list: `docs/project-context.md`
- Full decisions: `_bmad-output/planning-artifacts/architecture.md`
- UX colors/typography: `_bmad-output/planning-artifacts/ux-design-specification.md` (Visual Design System)

### Story completion status

- **done** — Code review complete; `npm run build` and `npm run lint` pass; see **Senior Developer Review (AI)**.

## Dev Agent Record

### Agent Model Used

Cursor / Composer (implementation agent)

### Debug Log References

### Completion Notes List

- Scaffolded with `create-next-app@latest` in `tmp-next` (npm; pnpm unavailable in environment), merged into repo root because CNA refuses non-empty parent directory.
- Next.js **16.2.2**, MUI **7.x**, `AppRouterCacheProvider` from `@mui/material-nextjs/v16-appRouter`.
- Theme: dark palette, UX hex values, `palette.accent` augmented in TypeScript; home page uses **Stack** + primary `Button` + **GoldAccentChip** (client; reads `theme.palette.accent.gold`).

### File List

- `package.json`
- `package-lock.json`
- `.gitignore`
- `next.config.ts`
- `next-env.d.ts` (generated; listed in `.gitignore` — not committed)
- `eslint.config.mjs`
- `postcss.config.mjs`
- `tsconfig.json`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/favicon.ico`
- `src/components/app-providers.tsx`
- `src/components/gold-accent-chip.tsx`
- `src/components/common/index.ts`
- `src/lib/README.md`
- `src/theme/create-app-theme.ts`
- `src/theme/mui-augmentation.d.ts`
- `public/` (CNA assets)
- `README.md`

## Senior Developer Review (AI)

**Reviewer:** BMAD code-review workflow (adversarial)  
**Date:** 2026-04-04  
**Outcome:** **Approve**

### Summary

Acceptance criteria and completed tasks were verified against the repo. `npm run lint` and `npm run build` succeed. One **medium** issue (gold accent duplicated as a hex on the home page instead of using the augmented theme) was **fixed** by introducing `src/components/gold-accent-chip.tsx` so the demo exercises `palette.accent.gold` and `getContrastText`.

### Findings

| Severity | Topic | Resolution |
|----------|--------|------------|
| ~~Medium~~ | Gold `Chip` used hardcoded `#FFD700` — duplicated UX palette vs `theme.palette.accent` | **Fixed** — client chip uses theme |
| Low | `next-env.d.ts` in File List but gitignored | Documented in File List as generated / not committed |
| Low | Tailwind v4 still in `package.json` / `globals.css` from CNA | Acceptable per story (MUI as source of truth); prune later if unused |
| Low | No `packageManager` field for optional pnpm standard | Optional follow-up |

### Checklist (review)

- [x] ACs cross-checked against implementation  
- [x] File list reconciled with git scope  
- [x] Lint / build verified  
- [x] Security review at scaffold level (no secrets, no client env abuse)  

## Change Log

- **2026-04-04:** Story 1.1 — Next.js App Router scaffold + MUI shell (theme, providers, demo page); README install/run; sprint status → review.
- **2026-04-04:** Senior code review — gold accent wired to theme (`GoldAccentChip`); story status → **done**; sprint status synced.
