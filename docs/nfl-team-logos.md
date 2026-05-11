# NFL team logos (Story 3.8)

## Decision

**Approach:** Static PNG assets checked into `public/nfl-logos/<ABBR>.png`, keyed by uppercase `Team.abbreviation` matching `prisma/data/nfl-teams.json`.

**Rejected options (and why):**

| Option | Why not (for this MVP) |
|--------|-------------------------|
| **The Odds API thumbnails** | Documented as out of scope for logos in `docs/nfl-odds-integration.md`; no guaranteed mark usage rights for in-app presentation. |
| **Hotlinked provider / third-party imagery URLs** | Requires ongoing `next.config` remote patterns, caching policy, and a clear license for our use case; adds runtime dependency on external hosts. |
| **Paid sports-imagery API** | Extra cost, keys, and compliance review; deferred until product needs dynamic or non-ESPN artwork. |

## Compliance and trademarks

NFL team names and logos are **trademarks** of their respective owners. This app uses logos **only** to identify the same teams already represented by abbreviations in league data. **Before a public or commercial launch**, legal review should confirm permitted use, any required notices, and whether a different asset pack or league program is required.

**Source of current files:** One-time download from ESPN’s public CDN (`a.espncdn.com` team logo paths, 500px-class assets), saved locally so the app does **not** depend on live hotlinking and does **not** ship API keys. ESPN / league display policies may change; local copies are for **development and internal pilots** until counsel approves production use.

## Fallback behavior

If a file is missing, corrupt, or fails to load, `TeamLogo` **silently** falls back to the existing abbreviation + colored `Avatar` (no thrown errors, no broken-image icon as the only affordance).

## Performance

Logos render with `next/image` using fixed **width/height** per size variant and a `sizes` hint tied to the rendered diameter. Local files use the image optimizer without `images.remotePatterns`.

## Maintenance

### Add or replace a logo

1. Add or overwrite `public/nfl-logos/<ABBR>.png` where `<ABBR>` matches the DB seed (uppercase, same as `nfl-teams.json`).
2. Prefer **square** artwork with transparent or theme-appropriate background; component clips to a circle.
3. If a team **rebrands** or the abbreviation in data changes, update the filename to match the new abbreviation (and adjust seed data in the same change).

### Attribution

If a future license requires per-page or global attribution, add copy in app chrome or `/rules` as counsel directs (open item from Story 3.8).

## Size alignment (UX)

UX specification targets **24 / 32 / 40 px** diameters for `sm` / `md` / `lg`. **Touch targets** on matchup rows remain ≥ 44px via row padding and layout (`MatchupCard`), not by enlarging the glyph beyond these sizes.
