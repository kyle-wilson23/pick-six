---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - README.md
  - _bmad-output/planning-artifacts/bmm-workflow-status.yaml
date: 2026-01-05
author: Kyle
---

# Product Brief: pick-six

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

Pick Six is a purpose-built web application designed to automate and streamline the operation of custom NFL pick'em leagues with unique ruleset requirements. Born from a real need within a long-running private league, Pick Six eliminates the manual administrative burden of spreadsheet management, email coordination, and weekly tracking while providing participants with an integrated, user-friendly experience for studying odds and making selections.

The application addresses a critical gap in the fantasy football platform market: existing platforms (ESPN, Yahoo, etc.) do not support the specific custom rules that make private pick'em leagues unique. Pick Six transforms what has become an increasingly time-consuming weekly administrative task into an automated, reliable system - giving league administrators their time back while improving the experience for all participants.

Built with Next.js and modern web technologies, Pick Six serves as both a practical solution for real users and a comprehensive learning project exploring the BMAD methodology and full-stack web development.

---

## Core Vision

### Problem Statement

Running a custom NFL pick'em league has become unsustainable for administrators who manually manage every aspect of league operations. Each week, league admins spend significant time maintaining spreadsheets tracking participants, selections, point totals, and previously picked teams. They must remember to send weekly reminder emails, calculate the "jailed team" (the week's biggest favorite), update leaderboards, and manually validate that participants haven't violated selection rules.

Meanwhile, participants navigate a fragmented experience: receiving leaderboard screenshots via email, separately visiting betting sites to study odds, then replying to emails with their picks. This disjointed workflow increases the likelihood of missed picks, duplicate team selections, and general friction in what should be an enjoyable weekly ritual during NFL season.

### Problem Impact

**For League Administrators:**

- **Time Burden:** Weekly manual work including spreadsheet updates, email composition, odds research for jailed team determination, and leaderboard management
- **Risk of Error:** Manual point calculations and selection tracking prone to mistakes
- **Mental Load:** Remembering to complete weekly tasks on schedule, responding to discrepancy challenges
- **Burnout Risk:** Administrators reaching their limit and potentially abandoning league management altogether

**For Participants:**

- **Fragmented Workflow:** Juggling multiple browser tabs (email, betting sites, old leaderboards) to make informed picks
- **Poor Visibility:** Relying on screenshot leaderboards rather than live, interactive standings
- **Validation Anxiety:** No real-time validation preventing duplicate team picks or jailed team violations
- **Engagement Friction:** Cumbersome process reduces the enjoyment of weekly participation

### Why Existing Solutions Fall Short

Major fantasy football platforms (ESPN, Yahoo Fantasy, etc.) do not accommodate the specific custom rules that define unique pick'em leagues:

- No support for "jailed team" mechanics (blocking selection of the week's biggest favorite)
- No double-point bonuses for picking against designated teams
- Lack of season-long unique team selection enforcement (can't pick same team twice)
- Inflexible scoring systems that don't match custom league rules
- No support for extending deadlines for specific weeks or games

These platforms are built for their own rulesets, leaving custom leagues with no choice but manual management through spreadsheets and email coordination.

### Proposed Solution

Pick Six is a dedicated web application that automates the complete lifecycle of custom pick'em league operations while providing an integrated, modern user experience.

**For League Administrators:**

- **Automated Weekly Cycle:** System automatically sends reminder emails by Tuesday nights with current standings, jailed team identification, and pick submission links
- **Real-time Leaderboards:** Live standings automatically updated as games complete, eliminating manual spreadsheet updates
- **Rule Enforcement Engine:** Automated validation of all league rules (no duplicate teams, jailed team restrictions, deadline enforcement)
- **Zero Manual Tracking:** All participant selections, point totals, and historical data managed by the system

**For League Participants:**

- **Unified Interface:** Single web application displaying matchups, live odds, current standings, and pick submission in one place
- **Intelligent Validation:** Real-time feedback preventing rule violations (duplicate picks, jailed team selection)
- **Historical Context:** Clear visibility of previously picked teams and remaining options
- **Pick Flexibility:** Change selections as many times as desired before the weekly deadline
- **Email Integration:** Convenient reminders with direct login links to make picks

**Technical Foundation:**

- Built with Next.js and React for modern, responsive UI
- Real-time NFL odds integration via third-party API
- Robust authentication and user management
- Automated email delivery system for notifications
- Flexible rule engine supporting custom league configurations

### Key Differentiators

**Custom Rule Engine:**
Pick Six's flexible rule configuration system supports the nuanced mechanics that generic platforms cannot handle - including jailed team identification, anti-jailed bonuses, unique team enforcement, and configurable deadline extensions for special circumstances (e.g., week 1 signup window).

**Real Problem, Real Users:**
Built to solve an actual pain point experienced by a functioning league, ensuring the solution addresses genuine needs rather than hypothetical use cases. Immediate feedback loop from real participants during development and deployment.

**Learning-Driven Development:**
Developed using the comprehensive BMAD methodology, ensuring thorough planning, architectural solutioning, and quality implementation practices. This disciplined approach results in a maintainable, well-documented codebase that can evolve as needs change.

**Timing Advantage:**
Sports betting becoming mainstream has made odds data more accessible and publicly acceptable, while COVID-era digital adoption has made participants comfortable with web-based league management. Administrator burnout is reaching a critical point, making this transition necessary rather than optional.

**Growth Potential:**
While initially serving a single private league, the architecture supports multiple leagues with different custom rulesets, creating opportunity for organic growth as other league administrators discover the platform and recognize their similar needs.

---

## Target Users

### Primary Users

#### The League Administrator

**Context & Background:**

- Running the league for 5+ seasons - has established rhythms and relationships with participants
- Technically comfortable but time-constrained - can use tech tools but manual processes eating into personal time
- Started enjoying the admin role, but time burden converting it into an obligation
- Values delivering a good experience to participants but needs to be more hands-off

**Current Problem Experience:**

- Weekly spreadsheet maintenance and manual tracking becoming unsustainable
- Mental load of remembering weekly tasks (Tuesday emails, deadline enforcement, scoring updates)
- Time commitment growing as life gets busier
- Risk of burnout threatening the league's continuation

**Success Vision:**

- Hands-off league management - system handles routine operations automatically
- More time for personal life while still maintaining the league tradition
- Pride in delivering a modern, easy-to-use experience to participants
- Confidence that nothing falls through the cracks

**Primary Goal:** Reduce weekly time investment from hours to minutes while maintaining (or improving) league quality

#### The League Participant

**Context & Background:**

- One of ~14 participants in a competitive league with cash prizes (external to the app)
- Range from die-hard NFL fans to casual participants
- All technically comfortable enough to use modern web applications
- Some highly engaged, some forget picks for consecutive weeks

**Current Problem Experience:**

- Fragmented workflow: email for standings, betting site for odds, email reply for picks
- No visibility into previously picked teams or validation of selections
- Manual process creates friction in what should be enjoyable weekly ritual
- Screenshot leaderboards lack interactivity and real-time updates

**Success Vision:**

- Single destination for everything: odds, standings, historical picks, submission
- Real-time validation preventing rule violations (duplicate teams, jailed team)
- Quick, frictionless pick submission - in and out in minutes
- Clear visibility of remaining team options as season progresses

**User Segments within Participants:**

- **Die-hard Engaged:** Log in early in week, study matchups carefully, change picks multiple times
- **Casual Consistent:** Make picks reliably but quickly, less strategic analysis
- **Inconsistent Participants:** Forget picks some weeks, need maximum convenience to participate

**Primary Goal:** Make weekly picks efficiently with all needed information in one place

### Secondary Users

**Future League Creator:**

- Another admin who discovers Pick Six and wants to run their own custom pick'em league
- Needs league creation workflow and configuration capabilities
- May have similar but slightly different rule variations
- Not MVP scope but architectural consideration for future scalability

**System Maintainer (Author):**

- Long-term maintainer ensuring system health and evolution
- Needs maintainable, well-documented codebase
- Must handle updates to odds APIs, NFL schedule changes, etc.
- Benefits from BMAD methodology's emphasis on quality architecture

### User Journeys

#### League Administrator Journey

**Pre-Season Setup (New League):**

1. Creates league with custom rule configuration (jailed team rules, scoring, deadlines)
2. Invites participants via email with signup links
3. Reviews league settings and confirms everything matches desired ruleset

**Pre-Season Setup (Returning League):**

1. Views existing league from previous season
2. Chooses to "Renew League for New Season"
3. Reviews previous season's participant roster
4. Removes participants who won't return
5. Invites new participants to replace departing members
6. Confirms league rules/settings (with option to adjust if needed)
7. Activates league for new season

**Weekly During Season (Tuesday-Thursday):**

1. Receives notification that weekly email has been automatically sent (or reviews before sending)
2. Logs in to verify jailed team calculation is correct
3. Monitors pick submissions throughout the week via dashboard
4. Receives confidence that deadline enforcement happens automatically

**Weekly During Season (Games Active):**

1. System automatically tracks game outcomes and updates scoring
2. Admin can monitor in real-time but doesn't need to take action
3. Leaderboard updates automatically as games complete

**End of Season:**

1. Reviews final standings
2. Identifies prize winners (top 3, most losses)
3. League wraps cleanly with complete historical record
4. League enters "off-season" state, ready for renewal next year

**Aha Moment:** First Tuesday when weekly email goes out automatically and admin realizes they did nothing

#### League Participant Journey

**Pre-Season:**

1. Receives email invitation to join league
2. Creates account and joins league
3. Reviews league rules within the app

**Weekly Pick Flow:**

1. Receives automated Tuesday email with standings and jailed team info
2. Clicks link to web app (or visits directly)
3. Views current week's matchups with live odds
4. Sees which teams already picked this season (validation helper)
5. Selects pick - gets immediate validation feedback
6. Confirms selection (can return to change before deadline)

**Monitoring & Engagement:**

1. Checks leaderboard throughout week to see how others are doing
2. Views historical picks and performance trends
3. Engages with competitive aspect through clear standings visibility

**Aha Moment:** First time making a pick where they see all info in one place and get instant validation

---

## Success Metrics

### User Success Metrics

#### League Administrator Success

**Primary Success Indicator: Time Liberation**

- **Target:** Reduce weekly administrative time from hours to less than 15 minutes
- **Measurement:** Admin self-reported time tracking (voluntary feedback)
- **Success Behavior:** Admin transitions from "doing" to "monitoring" - checking rather than executing weekly tasks

**Operational Success Indicators:**

- **Automated Email Delivery:** 100% of weekly reminder emails sent automatically by Tuesday evening without admin intervention
- **Automated Scoring:** Game results processed and leaderboards updated automatically within 1 hour of game completion
- **Zero Manual Data Entry:** Admin never touches a spreadsheet for league management

**Qualitative Success Signal:**

- Admin feedback: "I can't imagine going back to the old way"
- Admin willingness to renew league for subsequent season using Pick Six
- Reduced admin stress and increased satisfaction with league management role

#### League Participant Success

**Primary Success Indicator: Frictionless Pick Submission**

- **Target:** 90%+ pick submission rate among active participants
- **Measurement:** (Picks submitted / Active participants) per week
- **Success Behavior:** Email → App → Pick → Done workflow in under 5 minutes

**Engagement Success Indicators:**

- **Weekly Return Rate:** Participants return week over week to make picks
- **Multi-visit Engagement:** Participants check leaderboards and standings beyond just pick submission
- **Pick Modification Rate:** Participants feel comfortable changing picks before deadline (indicator of system trust)

**User Experience Success Signals:**

- Elimination of "where do I find odds?" questions to admin
- Reduction in duplicate team pick violations (prevented by validation)
- Zero email replies for pick submission (all done through app)

**Qualitative Success Signal:**

- Participants praise the unified experience
- Participants voluntarily check app throughout the week (beyond required pick submission)

### Business Objectives

#### Phase 1: First Season Success (Months 1-5)

**Adoption & Migration:**

- **Target:** 100% league participant adoption (all 14 participants actively using the platform)
- **Critical Success Factor:** Full migration from email-based picks to app-based picks by Week 2 of NFL season
- **Admin Buy-in:** League admin successfully completes pre-season setup and weekly monitoring without reverting to manual methods

**Reliability & Trust:**

- **Uptime Target:** 99.5%+ uptime (system accessible 24/7)
- **Jailed Team Accuracy:** 100% accurate identification of jailed team each week (correct odds-based calculation)
- **Scoring Accuracy:** Zero scoring disputes due to system error
- **Deadline Enforcement:** 100% accurate enforcement of weekly pick deadlines

**Operational Success:**

- Complete full NFL regular season (18 weeks) with zero system failures requiring manual intervention
- Crown season winner with complete, auditable historical data
- Minimal complaints or friction from participants

#### Phase 2: One-Year Success (First Full Season Complete)

**User Retention & Satisfaction:**

- **League Renewal:** Admin renews league for subsequent season using Pick Six platform
- **Participant Retention:** 90%+ returning participants (natural attrition acceptable)
- **Qualitative Praise:** Users actively praise the platform and express preference over old method

**System Maturity:**

- Zero critical bugs or system failures during season
- Successful year-over-year league renewal workflow completion
- Historical data integrity maintained across seasons

#### Phase 3: Long-term Success (Beyond Year 1)

**Sustained Value Delivery:**

- Continued use season after season with consistent reliability
- Platform becomes the "obvious" way to run the league
- Admin maintains pride in delivering quality experience with minimal effort

**Growth Potential (Optional):**

- Interest expressed by other league admins (word-of-mouth validation)
- Architecture supports multi-league expansion if opportunity arises
- Platform stability enables consideration of wider availability

**Learning Objectives Achievement:**

- Demonstrable expertise in Next.js full-stack development
- Comprehensive application of BMAD methodology from planning through implementation
- Maintainable, well-documented codebase serving as portfolio piece
- Real-world product management and user feedback integration experience

### Key Performance Indicators

#### User Engagement KPIs

**Pick Submission Rate:**

- **Formula:** (Total picks submitted / Total active participants) per week
- **Target:** ≥90% weekly submission rate
- **Leading Indicator:** Early-week login rate (Tuesday-Wednesday)

**System Return Rate:**

- **Formula:** (Participants logging in multiple times per week / Total participants)
- **Target:** ≥60% multi-visit engagement
- **Insight:** Indicates value beyond just pick submission

**Admin Time Savings:**

- **Measurement:** Self-reported weekly time investment (voluntary survey)
- **Target:** <15 minutes per week (down from hours)
- **Success Threshold:** Admin reports "hands-off" management experience

#### System Reliability KPIs

**Uptime & Availability:**

- **Target:** 99.5%+ uptime
- **Critical Periods:** Tuesday (email send) and game day deadlines must be 100% available
- **Measurement:** Automated health monitoring

**Data Accuracy:**

- **Jailed Team Calculation:** 100% accuracy (validated against odds sources)
- **Scoring Accuracy:** Zero calculation errors
- **Rule Enforcement:** 100% validation accuracy (no duplicate picks, no jailed team violations slip through)

**Email Delivery:**

- **Target:** 100% successful delivery of weekly reminder emails by Tuesday evening
- **Measurement:** Email service provider delivery confirmations

#### Adoption & Growth KPIs

**First Season Adoption:**

- **Week 1 Adoption:** ≥90% of participants make first pick via app
- **Week 2 Adoption:** 100% of participants migrated from email-based picks
- **Admin Adoption:** Admin completes pre-season setup without assistance

**Season-over-Season Retention:**

- **League Renewal Rate:** Admin renews league for subsequent season
- **Participant Retention:** ≥90% returning participants year-over-year
- **Organic Interest:** Unsolicited inquiries from other potential league admins (nice-to-have)

#### Learning & Development KPIs

**Technical Mastery:**

- Complete implementation using Next.js best practices
- Full BMAD methodology execution from product brief through deployment
- Code quality metrics (maintainability, test coverage, documentation completeness)

**Product Validation:**

- Real users in production
- User feedback collection and integration
- Portfolio-quality project demonstrating full-stack capability

---

## MVP Scope

### Core Features

The MVP delivers a fully automated pick'em league management system with the following essential capabilities:

#### League Administration Features

**League Setup & Management:**

- Create league with participant roster (up to ~14 participants)
- Invite participants via email with signup links
- Static rule configuration (hardcoded to match current league rules: jailed team mechanics, no duplicate picks, 1-point standard wins, 2-point anti-jailed wins)
- Pre-season league initialization before NFL season starts

**Admin as Participant:**

- Admin participates as a full league member
- Submits own weekly picks through standard participant interface
- Earns points and appears on leaderboard like any other participant
- No special treatment in scoring or standings

**Admin Override Capabilities:**

- Submit picks on behalf of any participant at any time
- Modify any participant's pick at any time (including post-deadline)
- Handle edge cases: technical issues, text-based pick submissions, corrections

**Monitoring & Oversight:**

- Dashboard showing all participants' pick submission status
- Real-time view of current week's picks (before and after deadline)
- Access to all historical picks and standings
- Verification interface for weekly jailed team calculation

**Automated Operations:**

- Weekly reminder emails sent automatically by Tuesday evening
- Email includes: current standings, jailed team identification, pick submission link
- Automated scoring updates as games complete throughout the week
- Leaderboard automatically refreshes with latest results

#### Participant Features

**Account & Access:**

- User signup and authentication
- Email-based invitation acceptance
- Secure login to access league

**Weekly Pick Workflow:**

- View current week's NFL matchups with live odds
- See which teams already picked this season (preventing duplicates)
- Visual indication of jailed team (blocked from selection)
- Submit weekly pick with real-time validation
- Modify pick unlimited times before deadline
- Clear deadline countdown display

**Validation & Rules Enforcement:**

- Real-time validation preventing duplicate team selections
- Automatic blocking of jailed team selection
- Option to pick against jailed team (2-point bonus opportunity)
- Pick deadline enforcement (locks 5 minutes before first game of week)

**Standings & History:**

- Live leaderboard showing all participants' points and rankings
- Personal pick history (all weeks, teams selected, outcomes)
- League-wide visibility into who picked what (transparency)
- Season-long tracking of wins, losses, and forgotten picks

**User Experience:**

- Responsive design for mobile browser access
- Single-page workflow from email → login → pick → done
- All necessary information in one place (no external odds sites needed)

#### System Core Capabilities

**NFL Data Integration:**

- Third-party API integration for real-time NFL moneyline odds
- Automated jailed team identification (team with worst odds/biggest favorite each week)
- Game result processing and outcome tracking
- Schedule data for all regular season games

**Automation Engine:**

- Scheduled weekly email delivery (Tuesday evening)
- Automated deadline enforcement (Thursday ~8:10pm EST, or first game of week)
- Automated scoring calculation after game completion
- Season-long rule validation (no duplicate picks, jailed team enforcement)

**Data Management:**

- Participant profiles and authentication
- Season-long pick history and outcomes
- Point totals and leaderboard state
- Audit trail for admin overrides and system actions

**Email System:**

- Transactional email delivery service integration
- Weekly reminder template with standings, jailed team, pick link
- Invitation emails for new participants
- System-generated content with league-specific data

### Out of Scope for MVP

The following capabilities are explicitly excluded from MVP to maintain focus and ensure timely delivery:

**Custom Rule Configuration:**

- Configurable league rules (scoring, jailed team mechanics, etc.)
- Multiple ruleset support
- Admin-defined custom rule variations
- _Rationale:_ Hardcoding current league rules reduces complexity and accelerates MVP development

**League Renewal & Multi-Season Management:**

- Year-over-year league renewal workflow
- Participant roster management for returning seasons
- Historical season comparison and archives
- _Rationale:_ Can be handled manually for season 2 if needed; focus on proving single-season value first

**Multi-League Support:**

- Creating and managing multiple independent leagues
- Cross-league features or integrations
- League discovery or marketplace
- _Rationale:_ MVP validates single-league experience before scaling

**Advanced Analytics & Reporting:**

- Detailed statistical analysis of picks and outcomes
- Trend identification and pattern recognition
- Advanced leaderboard views (streaks, consistency metrics, etc.)
- Exportable reports or data dumps
- _Rationale:_ Nice-to-have but not essential for core value delivery

**Native Mobile Applications:**

- iOS native app
- Android native app
- Mobile-specific features beyond responsive web
- _Rationale:_ Responsive web app serves mobile users adequately for MVP

**Social & Community Features:**

- In-app messaging or comments
- Trash talk or banter features
- Social sharing or integration
- Activity feeds or notifications beyond email
- _Rationale:_ Social dynamics already exist outside the app; focus on core functionality

**Advanced Notifications:**

- In-app push notifications
- SMS notifications
- Custom notification preferences
- _Rationale:_ Email reminders sufficient for MVP; additional channels add complexity

**Payment Processing:**

- In-app prize pool management
- Payment collection or distribution
- Financial transaction handling
- _Rationale:_ Prize logistics handled externally; explicit non-goal for platform

### MVP Success Criteria

The MVP will be considered successful when it achieves the following outcomes:

**Pre-Season Validation (May-August 2026):**

- MVP development completed by May 2026
- Successful test run during summer 2026 using historical odds data
- Real participants validate complete workflow end-to-end
- Admin validates all administrative workflows function as expected
- System demonstrates technical reliability and data accuracy

**Launch Readiness (September 2026):**

- 100% participant adoption for NFL season start
- Admin confidence to launch for real season with stakes
- Zero critical bugs or blockers identified during testing
- All automated workflows tested and validated

**First Season Success (September 2026 - January 2027):**

- Complete full 18-week regular season without system failures
- 90%+ weekly pick submission rate
- Admin weekly time investment reduced to <15 minutes
- Zero scoring disputes due to system errors
- Participants prefer new system over old email-based method

**Go/No-Go Decision Point:**
After first season completion, evaluate:

- Did we eliminate admin's manual burden?
- Did participants find it easier than the old way?
- Is the system reliable enough to trust for future seasons?
- Should we invest in enhancements (league renewal, multi-league, etc.)?

### Planning alignment (epics and stories)

Implementation-level breakdown (stories, acceptance criteria, sequencing) is maintained in **`_bmad-output/planning-artifacts/epics.md`**. The following product intents are captured there and should stay consistent with this brief and the PRD:

- **Mid-season start:** Leagues can be configured at creation with a **first NFL week** later than Week 1 if launch slips after September—competition begins at that week instead of waiting for the next season.
- **Pre-season validation:** Before picks open, users can still load **Week 1** (or preview) **odds and weather** so third-party integrations are verified in July/August.
- **Team logos:** Move from abbreviation-only `TeamLogo` to real marks where licensing allows (see UX spec + epics).
- **Rehearsal / test leagues:** Optional **test leagues** (per-league flag), simulated time and fixtures for multi-week dry runs with invited users, **deletable** when done—reduces risk before the real season.

### Future Vision

While MVP focuses on single-league, single-season value delivery, the long-term vision for Pick Six includes:

**Season 2+ Enhancements (Year 2):**

- League renewal workflow for year-over-year continuity
- Improved participant roster management (remove/add between seasons)
- Historical season archives and comparisons
- Enhanced analytics and statistics

**Multi-League Expansion (Years 2-3):**

- Support for multiple independent leagues
- League creation self-service for new admins
- Multi-league management dashboard for admins running multiple leagues
- Platform scalability to support dozens or hundreds of concurrent leagues

**Customization & Flexibility (Years 2-3):**

- Configurable rule engine supporting variations on jailed team mechanics
- Custom scoring systems
- Adjustable deadlines and season structures
- Support for different league sizes and formats

**Advanced Features (Years 3+):**

- Enhanced analytics and insights (streak tracking, consistency metrics, pick pattern analysis)
- Native mobile applications (iOS/Android)
- Social features and community building
- Integration with additional data sources (injuries, weather, expert picks)
- Public league discovery and marketplace

**Growth & Scale (Long-term):**

- Word-of-mouth growth as other admins discover platform
- Potential for niche market position serving custom pick'em leagues
- Community-contributed rule variations and league formats
- Platform maturity enabling consideration of broader availability

**Learning & Portfolio Value:**

- Comprehensive demonstration of Next.js expertise and full-stack development
- Real-world application of BMAD methodology from concept to production
- Portfolio-quality project showcasing product thinking, technical execution, and user-centered design
- Foundation for continued learning and experimentation with modern web technologies
