# Pick Six 🏈

A modern web application for managing and participating in fantasy football pick'em leagues with real-time NFL odds integration and comprehensive league management features.

**This is being built with the intention of providing me the opportunity to experiment with BMAD and Next.js.**

## Overview

Pick Six transforms traditional email-based fantasy football pick'em leagues into a streamlined, automated web experience. Built to handle the strict ruleset and weekly operations of competitive pick'em leagues, this application eliminates manual coordination and provides a centralized platform for league administration and player participation.

## Project Status

📋 **Currently in Planning Phase** - This project is being developed using the [BMAD Method](https://github.com/brendan-mccaffrey/bmad) for comprehensive product and system design.

**Current Phase:** Planning & Requirements Definition

**Completed Artifacts:**

- ✅ Product Brief (January 2026)
- ✅ Product Requirements Document (January 2026)

**Next Steps:** UX Design → Technical Architecture → Epic Breakdown

## Key Features (Planned MVP)

### Multi-League Management

- **League Creation** - Support for multiple concurrent leagues with unique configurations
- **Participant Invitations** - Email-based invitation system with signup links
- **Admin Override Capabilities** - Submit/modify picks on behalf of participants with full audit trail
- **League Rules Reference** - Accessible documentation of all scoring rules and mechanics

### Automated Weekly Operations

- **Email Automation** - Automatic pick reminders with standings, jailed team, and pick submission link
- **Jailed Team Calculation** - Automated identification with tie-breaker logic (odds → spread → random)
- **Deadline Enforcement** - Automatic pick lockout at Thursday ~8:10 PM or 5 minutes before first game
- **Automated Scoring** - Game result processing and leaderboard updates after Monday Night Football

### Pick Submission Experience

- **Live Odds Integration** - Real-time NFL moneyline odds and point spreads
- **Smart Validation** - Prevents duplicate team picks and jailed team violations
- **Pick Modification** - Unlimited changes before weekly deadline
- **Mobile-Optimized Workflow** - 60-90 second pick submission on mobile devices
- **Clear Status Indicators** - Visual confirmation of submitted picks

### Transparency & Reporting

- **Live Leaderboards** - Updated standings revealed every Tuesday after MNF
- **Historical Pick Tracking** - Complete season-long pick history for all participants
- **Admin CSV Export** - Complete league state export as fail-safe backup
- **Audit Trail** - Complete logging of all admin override actions

## Technology Stack

_Technology decisions are being finalized during the architecture phase. The stack will include:_

- **Frontend:** Next.js and React
- **Backend:** API and business logic layer (TBD)
- **Database:** Data persistence layer (TBD)
- **External APIs:** NFL odds provider (being evaluated)
- **Email Service:** Transactional email provider (TBD)
- **Hosting:** Cloud deployment platform (TBD)

## Getting Started

This project is currently in the planning and design phase. Once implementation begins, this section will include:

- Installation instructions
- Development environment setup
- Configuration guide
- Running the application locally

For now, refer to the planning artifacts in `_bmad-output/planning-artifacts/` to understand the product vision and requirements.

## Project Structure

```
pick-six/
├── _bmad/                  # BMAD Method framework files
├── _bmad-output/           # Planning artifacts and documentation
│   ├── planning-artifacts/ # Product Brief ✓, PRD ✓, Architecture (TBD), UX designs (TBD)
│   └── implementation-artifacts/ # Sprint plans, stories (TBD)
├── docs/                   # Additional documentation (TBD)
└── src/                    # Source code (coming soon)
```

## Planning Artifacts

- **Product Brief** (`_bmad-output/planning-artifacts/product-brief-pick-six-2026-01-05.md`)
  - Executive summary and product vision
  - Problem statement and target users
  - Success metrics and MVP scope definition
- **Product Requirements Document** (`_bmad-output/planning-artifacts/prd.md`)
  - Complete functional requirements (60 FRs across 8 capability areas)
  - Non-functional requirements (53 NFRs covering performance, security, reliability)
  - User journeys (5 comprehensive narratives)
  - Technical specifications for web application architecture

## Contributing

This project is currently in early planning stages. Contribution guidelines will be established once the implementation phase begins.

## License

_License to be determined_

## Contact

For questions or interest in the project, please open an issue.

---

**Built with the BMAD Method** - A comprehensive approach to software product development emphasizing thorough planning, UX design, and architectural solutioning before implementation.
