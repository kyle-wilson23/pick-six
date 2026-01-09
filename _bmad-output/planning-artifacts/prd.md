---
stepsCompleted: [1, 2, 3, 4, 7, 8, 9, 10, 11]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-pick-six-2026-01-05.md
  - README.md
workflowType: 'prd'
lastStep: 11
briefCount: 1
researchCount: 0
brainstormingCount: 0
projectDocsCount: 1
date: 2026-01-05
author: Kyle
project_name: pick-six
workflowComplete: true
completionDate: 2026-01-09
---

# Product Requirements Document - pick-six

**Author:** Kyle
**Date:** 2026-01-05

## Executive Summary

Pick Six is a web application that automates the complete lifecycle of custom NFL pick'em league operations, transforming manual spreadsheet-based management into an integrated, automated platform. The application serves league administrators who are burning out from unsustainable weekly manual work (spreadsheet maintenance, email coordination, odds research, rule validation) and participants navigating fragmented workflows across multiple tools.

The platform delivers comprehensive automation for league operations—from automated Tuesday reminder emails with standings and jailed team identification, to real-time pick validation, to automatic scoring updates as games complete. It provides a unified interface where participants can study live NFL odds, view historical picks, check standings, and submit validated picks all in one place.

Built with Next.js and modern web technologies, Pick Six targets a specific market gap: existing fantasy football platforms (ESPN, Yahoo) cannot support the custom rules that make private pick'em leagues unique—jailed team mechanics, anti-jailed bonuses, season-long unique team enforcement, and flexible deadline extensions. Pick Six's custom rule engine handles these nuanced requirements that generic platforms simply cannot accommodate.

The application serves approximately 14 league participants, with a primary goal of reducing administrator weekly time investment from hours to less than 15 minutes while achieving 90%+ pick submission rates and maintaining complete system reliability throughout the 18-week NFL season.

### What Makes This Special

**Custom Rule Engine for Underserved Market**
Pick Six addresses a fundamental gap in the fantasy football platform market. Generic platforms are built for their own standardized rulesets and cannot accommodate the custom mechanics that define unique pick'em leagues—jailed team identification (blocking the week's biggest favorite), double-point bonuses for picking against designated teams, season-long unique team selection enforcement, and configurable deadline extensions. Pick Six's flexible rule configuration system supports these nuanced requirements, serving a market segment that has no viable alternative beyond manual management.

**Built on Real User Need with Immediate Validation**
Unlike speculative products, Pick Six solves an actual pain point experienced by a functioning league that has operated for 5+ seasons. This ensures genuine need validation with an immediate feedback loop from real participants during development and deployment. The administrator burnout is real and reaching a critical point, making this solution necessary rather than nice-to-have.

**Timing Convergence Creating Market Opportunity**
Multiple factors align to make this the right moment: (1) Sports betting mainstream adoption has made odds data publicly accessible and socially acceptable, (2) COVID-era digital adoption has normalized web-based league management, (3) Administrator burnout is reaching critical levels where manual management is no longer sustainable. What was once a "nice to have" automation has become a necessity.

**Architecture for Growth Beyond Single League**
While the MVP serves a single private league, the technical architecture supports multiple independent leagues with different custom rulesets. This creates organic growth potential as other league administrators discover the platform and recognize their similar needs, positioning Pick Six as a platform for the broader custom pick'em league market.

**Learning-Driven Development Ensuring Quality**
Comprehensive application of the BMAD methodology from planning through implementation ensures thorough architectural solutioning, maintainable code, and quality implementation practices. This disciplined approach results in a well-documented codebase that can evolve reliably as user needs and technical requirements change over time.

## Project Classification

**Technical Type:** Web Application (SPA)  
**Domain:** General (Sports/Gaming)  
**Complexity:** Medium  
**Project Context:** Greenfield - new project

**Classification Rationale:**

This is a web application built on Next.js/React targeting modern browsers with responsive mobile support. The project exhibits medium complexity due to several sophisticated requirements: third-party NFL odds API integration, automated scheduling and email delivery system, real-time data processing and leaderboard updates, complex rule validation engine, and season-long state management across 18 weeks.

While the domain (fantasy sports leagues) is well-understood and not subject to heavy regulation like healthcare or fintech, the technical implementation requires careful handling of real-time data synchronization, deadline enforcement precision, automated workflows, and data integrity across a full NFL season. The custom rule engine adds complexity beyond standard CRUD operations, requiring flexible validation logic that can adapt to different league configurations.

The greenfield nature means establishing all patterns and architecture from scratch, with Next.js as the foundation and technology decisions (database, hosting, email service, odds API provider) being finalized during the architecture phase.

## Success Criteria

### User Success

**Administrator Success Indicators:**

The primary success signal for league administrators is the transition from "doing" to "monitoring"—when weekly operations happen automatically without manual intervention. Success is achieved when:

- **Automation Working Invisibly:** Administrators notice things happening (Tuesday emails sent, jailed teams calculated, deadlines enforced, scores updated) that have always previously required their manual effort and attention
- **Time Liberation:** Weekly administrative time reduced from hours to less than 15 minutes
- **Zero Manual Data Entry:** Complete elimination of spreadsheet maintenance, email composition, and manual tracking
- **Confidence in System:** Trust that nothing falls through the cracks without their active involvement
- **Aha Moment:** First Tuesday when the weekly reminder email goes out automatically and the admin realizes they did nothing

**Measured by:**

- Admin self-reported time investment: target <15 minutes per week
- 100% automated email delivery by Tuesday evening without admin intervention
- Zero manual spreadsheet updates throughout the season
- Admin qualitative feedback: "I can't imagine going back to the old way"

**Participant Success Indicators:**

Success for league participants is achieved through a guided, frictionless workflow that eliminates the fragmented experience of the old system. Success is achieved when:

- **Guided Workflow Excellence:** Participants are seamlessly guided from email notification → login → informed pick selection → submission without friction or confusion
- **Single Destination Experience:** All necessary information (odds, standings, historical picks, submission) available in one place, eliminating manual searches for NFL odds across multiple betting sites
- **Real-time Validation:** Immediate feedback preventing rule violations (duplicate teams, jailed team selection) before submission
- **Quick Completion:** Complete pick workflow in under 5 minutes
- **Aha Moment:** When participants realize they're guided through the flow end-to-end, understanding the dramatic improvement versus the old fragmented workflow

**Measured by:**

- Pick submission rate: ≥90% of active participants submit picks weekly
- Workflow completion time: Email → pick submission in <5 minutes
- Multi-visit engagement: ≥60% of participants check leaderboards beyond just pick submission
- Elimination of "where do I find odds?" questions to admin
- Zero email-based pick submissions (100% through app)

### Business Success

**Primary Success Threshold: "No One Wants to Go Back"**

The fundamental business success metric is that the system becomes reliable and valuable enough that no participant or administrator would want to revert to the old manual process at any point during or after the first season.

**Phase 1: First Season Success (September 2026 - January 2027)**

- **Full Season Completion:** Successfully complete entire 18-week NFL regular season without system failures requiring manual intervention fallback
- **Rapid Adoption:** 100% league participant adoption by Week 2 of NFL season
- **Operational Excellence:** 90%+ weekly pick submission rate maintained throughout season
- **Data Integrity:** Zero scoring disputes due to system calculation errors
- **Deadline Precision:** 100% accurate enforcement of weekly pick deadlines
- **Jailed Team Accuracy:** 100% correct identification of jailed team each week
- **System Reliability:** 99.5%+ uptime with 100% availability during critical periods (Tuesday email send, game day deadlines)

**Phase 2: Ultimate Validation - Admin Renewal (Post-Season 1)**

The ultimate business success indicator is the league administrator's decision to renew the league for a subsequent season using Pick Six. This single metric validates that the platform delivered sufficient value to earn continued trust and use.

**Supporting renewal indicators:**

- Admin qualitative satisfaction: time saved, stress reduced, pride in delivering quality experience
- Participant retention: ≥90% of participants return for Season 2 (natural attrition acceptable)
- Participant qualitative praise: active preference for new system over old method
- Zero critical bugs or trust-breaking issues during Season 1

**Phase 3: Long-term Success (Beyond Year 1)**

- Continued seasonal use with consistent reliability and trust
- Platform becomes the "obvious" and "only reasonable" way to run the league
- Sustained admin satisfaction with minimal time investment
- Optional growth signal: Unsolicited interest from other league administrators (validation of broader market need)

**Secondary: Learning & Development Objectives**

While secondary to product success, this project serves important professional development goals:

- Demonstrable expertise in Next.js full-stack development through real production application
- Comprehensive application of BMAD methodology from product brief through deployment
- Portfolio-quality project showcasing product thinking, technical execution, and user-centered design
- Maintainable, well-documented codebase suitable for long-term evolution
- Real-world experience integrating user feedback and managing production systems

### Technical Success

**Reliability Requirements:**

- **Uptime Target:** 99.5%+ system availability across full season
- **Critical Period Availability:** 100% uptime during Tuesday evening (email send window) and game day deadline periods
- **Data Accuracy:** Zero calculation errors in scoring, jailed team identification, or rule validation
- **Deadline Enforcement:** Perfect precision in pick deadline enforcement (no early lockouts, no late submissions accepted)
- **Email Delivery:** 100% successful delivery of weekly reminder emails by Tuesday evening

**Automation Success:**

- **Autonomous Weekly Cycle:** Complete weekly operations (email send, jailed team calculation, deadline enforcement, scoring updates) execute automatically without admin intervention
- **Real-time Processing:** Game results processed and leaderboards updated within 1 hour of game completion
- **Validation Accuracy:** 100% accuracy in preventing duplicate team picks and jailed team violations
- **Audit Trail:** Complete historical data integrity maintained throughout season for transparency and dispute resolution

**Integration Success:**

- **NFL Odds API Integration:** Reliable real-time odds data for all NFL games, updated at least daily during the week
- **Email Service Integration:** Reliable transactional email delivery with tracking and confirmation
- **Responsive Performance:** Fast page loads and responsive interactions on both desktop and mobile browsers

**Maintainability:**

- Clean, well-documented codebase following Next.js best practices
- Comprehensive error handling and logging for troubleshooting
- Deployment pipeline enabling confident updates during season if needed
- Architecture supporting future enhancements without major refactoring

### Measurable Outcomes

**Week 1 Success Signals:**

- 100% of participants successfully create accounts and access league
- ≥90% of participants submit first pick via app (not email)
- Admin reports successful pre-season setup completion
- Zero critical bugs blocking core workflows

**Week 2 Success Signals:**

- 100% migration from email-based picks to app-based picks
- First automated Tuesday email delivered successfully
- Admin confirms <15 minutes of time investment for week

**Mid-Season Success Signals (Week 9):**

- ≥90% average pick submission rate maintained
- Zero system failures or manual intervention requirements
- Participants voluntarily checking leaderboards multiple times per week
- Admin actively monitoring rather than executing tasks

**End of Season Success Signals (Week 18):**

- Complete season with zero scoring disputes or data integrity issues
- Admin reports dramatic time savings and reduced stress
- Participants express strong preference for new system
- Crown season winner with complete, auditable historical data

**Post-Season Ultimate Success Signal:**

- Admin commits to renewing league for subsequent season using Pick Six
- Admin reports: "I can't imagine going back to the old way"
- ≥90% of participants plan to return for Season 2

## Product Scope

### MVP - Minimum Viable Product

The MVP delivers a complete, automated pick'em league management system focused on successfully completing one full NFL season (18 weeks) without any participant or administrator wanting to revert to manual processes.

**Core Scope Requirements:**

**League Administration:**

- Create and initialize league with participant roster (up to ~14 participants)
- Email-based invitation system for participant signup
- Hardcoded rule configuration matching current league requirements (jailed team mechanics, no duplicate picks, 1-point standard wins, 2-point anti-jailed wins)
- Admin participates as full league member with own picks and points
- Admin override capabilities: submit/modify picks on behalf of any participant at any time (including post-deadline)
- Admin monitoring dashboard showing pick submission status for all participants
- Admin verification interface for weekly jailed team calculation

**Participant Experience:**

- User signup and secure authentication
- View current week's NFL matchups with live moneyline odds
- Visual indication of previously picked teams (preventing duplicates)
- Visual indication of jailed team (blocked from selection)
- Submit weekly pick with real-time validation
- Option to pick against jailed team for 2-point bonus
- Modify pick unlimited times before weekly deadline
- Clear deadline countdown display
- Live leaderboard showing all participants' points and rankings
- Personal pick history (all weeks, teams selected, outcomes)
- League-wide transparency into who picked what
- Responsive design for mobile browser access

**Automation Engine:**

- Automated Tuesday evening email delivery with current standings, jailed team identification, and pick submission link
- Automated jailed team identification (team with worst odds/biggest favorite each week)
- Automated pick deadline enforcement (locks 5 minutes before first game of week, typically Thursday ~8:10pm EST)
- Automated scoring calculation after game completion
- Automated leaderboard updates as games complete
- Season-long rule validation enforcement (no duplicate picks, jailed team blocking)

**Technical Infrastructure:**

- Third-party NFL odds API integration for real-time moneyline data
- Game result processing and outcome tracking
- Full NFL regular season schedule data (18 weeks)
- Transactional email delivery service integration
- Database for participant profiles, pick history, point totals, and leaderboard state
- Audit trail for admin overrides and system actions

**Success Criteria for MVP:**

- Complete 18-week regular season without system failures
- No participant or administrator wants to revert to old manual process
- Admin time investment reduced to <15 minutes per week
- 90%+ weekly pick submission rate
- Admin commits to using platform for subsequent season

**Explicitly Out of MVP Scope:**

The following capabilities are intentionally excluded to maintain focus and ensure timely first-season delivery:

- **League renewal workflow** - Will handle manually for Season 2 transition if needed
- **Multi-league support** - Focus on proving single-league value first
- **Configurable rule engine** - Hardcode current league rules to reduce complexity
- **Advanced analytics** - Historical analysis, trend identification, consistency metrics
- **Native mobile applications** - Responsive web sufficient for MVP
- **Social features** - In-app messaging, trash talk, activity feeds beyond email
- **Advanced notifications** - Push notifications, SMS, custom notification preferences
- **Payment processing** - Prize logistics handled externally, explicit non-goal

### Growth Features (Post-MVP)

Features to consider after successful first season completion and admin renewal commitment:

**Season 2 Enhancements (Year 2 Priority):**

- **League Renewal Workflow:** Year-over-year league continuation with roster management

  - "Renew League for New Season" workflow
  - Remove/replace participants between seasons
  - Carry forward league settings with option to adjust
  - Archive previous season data while initializing new season

- **Roster Management:** Improved participant administration

  - Invite new participants to replace departing members
  - Participant status management (active/inactive)
  - Historical participation tracking across seasons

- **Historical Archives:** Season-over-season data preservation

  - View previous season standings and results
  - Compare participant performance across seasons
  - Complete historical pick records

- **Enhanced Analytics:** Deeper statistical insights
  - Streak tracking (consecutive wins/losses)
  - Pick pattern analysis
  - Head-to-head comparisons
  - Consistency metrics

**Multi-League Expansion (Years 2-3):**

After proving reliability with single league, expand to support multiple independent leagues:

- **Multi-League Architecture:** Support for multiple concurrent leagues with independent state
- **League Creation Self-Service:** Workflow for new admins to create and configure their own leagues
- **Multi-League Admin Dashboard:** Interface for admins managing multiple leagues simultaneously
- **Platform Scalability:** Infrastructure supporting dozens or hundreds of concurrent leagues

**Customization & Flexibility (Years 2-3):**

Evolve from hardcoded rules to flexible configuration:

- **Configurable Rule Engine:** Admin-defined variations on jailed team mechanics, scoring systems, deadline rules
- **Custom Scoring Systems:** Support for different point structures and bonus scenarios
- **Adjustable Deadlines:** Custom deadline timing and special circumstance extensions
- **League Size Flexibility:** Support for different league sizes and participant counts
- **Format Variations:** Different season structures and competition formats

### Vision (Future)

Long-term vision for Pick Six as a platform serving the broader custom pick'em league market:

**Advanced Features (Years 3+):**

- **Enhanced Analytics & Insights:** Advanced statistical analysis, machine learning pattern detection, predictive insights
- **Native Mobile Applications:** iOS and Android apps with native features (push notifications, offline support)
- **Social & Community Features:** In-app messaging, community discussions, league discovery
- **Expanded Data Integration:** Additional data sources (injuries, weather, expert picks, team news)
- **Advanced Automation:** AI-powered insights, smart recommendations, automated content generation
- **Public League Discovery:** Marketplace for open leagues, league templates, community-contributed formats

**Growth & Scale (Long-term):**

- **Word-of-Mouth Growth:** Organic discovery by other league administrators seeking custom pick'em solutions
- **Niche Market Position:** Establish Pick Six as the platform for custom pick'em leagues that generic platforms can't serve
- **Community Contributions:** User-contributed rule variations, league formats, and enhancement ideas
- **Platform Maturity:** Robust, proven system enabling consideration of broader public availability

**Learning & Portfolio Evolution:**

- **Technical Expertise Showcase:** Comprehensive demonstration of Next.js and full-stack development mastery
- **BMAD Methodology Validation:** Real-world proof of BMAD approach from concept through multi-season production use
- **Continuous Learning:** Platform for ongoing experimentation with modern web technologies, AI/ML integration, and advanced features
- **Career Asset:** Portfolio-quality project demonstrating product thinking, technical execution, user feedback integration, and production system management

## User Journeys

### Journey 1: Mike's Liberation - The Tuesday Night That Changed Everything

Mike has been running the Gridiron Gladiators league for 7 years. What started as a fun way to stay connected with college friends during football season has become a weekly chore. Every Tuesday evening, he faces the same routine: open last week's spreadsheet, manually calculate scores, update the standings, research betting sites to find the biggest favorite (the "jailed team"), compose an email with screenshots of the leaderboard, and send reminders to all 14 participants. The whole process takes 2-3 hours, and he's starting to resent it.

It's Week 1 of the new season, and Mike just finished setting up his league in Pick Six during the pre-season. He invited all his participants via email, they created accounts, and everyone's ready to go. Tuesday arrives, and Mike finds himself glancing at his phone throughout the afternoon. He knows the system is supposed to send the weekly emails automatically at 6:00 PM. Part of him wonders if it will actually work—if he'll really get his Tuesday nights back.

At 6:00 PM, his phone buzzes: "Weekly reminder emails sent successfully to all Gridiron Gladiators participants." Mike immediately opens Pick Six on his laptop. There it is—the system has identified the Kansas City Chiefs as this week's jailed team (biggest favorite at -450 odds), generated the current standings, and sent personalized emails to all 14 participants with links to make their picks. He clicks through to verify: yes, the emails went out. Yes, the jailed team is correct. Yes, the standings are accurate.

That's the moment. The validation moment. It actually worked. Mike didn't spend 2-3 hours on spreadsheets and email composition—he spent 2 minutes verifying everything looked right. By Thursday evening, he logs in briefly to see that 13 of 14 participants have already submitted picks—all validated automatically, no duplicate teams, nobody accidentally picked the jailed team. Sunday and Monday, as games complete, the leaderboard updates automatically. Mike watches the season unfold from the sidelines instead of managing every detail.

Six weeks into the season, Mike realizes he can't remember the last time he opened a spreadsheet for league management. His Tuesday evenings are his own again.

### Journey 2: Sarah's Strategy Session - The Die-Hard Engaged Participant

Sarah is a lifelong NFL fanatic who lives for the Gridiron Gladiators league. She's in it to win it every season, and she takes her picks seriously. In the old system, her Tuesday-through-Thursday routine involved opening multiple browser tabs: one for the admin's email with last week's standings (usually a screenshot), another for her betting site of choice to check the latest odds, a third tab with her personal spreadsheet tracking which teams she'd already picked this season, and a notes app where she'd draft her pick before sending it via email.

It's Week 3, Tuesday evening. Sarah receives the automated email from Pick Six: current standings show her tied for second place (updated after Monday Night Football completed last night), the Miami Dolphins are this week's jailed team, and there's a link to make her pick. She clicks through and immediately sees everything she needs in one interface: all 14 matchups with live moneyline odds, a sidebar showing which teams she's already picked this season (Weeks 1 and 2: Eagles, Ravens), and the Dolphins clearly marked as jailed.

Sarah starts her analysis. The Baltimore Ravens are playing at home as -7 favorites, but she already picked them in Week 2—they're grayed out, unavailable. She considers the San Francisco 49ers at -6.5, clicks to select them, and the interface shows her pick preview. But wait—she wants to study more. Wednesday morning, new injury reports come out. She logs back into Pick Six, changes her pick to the Buffalo Bills at -5.5. Thursday afternoon, she has one more thought—what if she goes contrarian and picks AGAINST the jailed Dolphins for the 2-point bonus? She logs in again, switches her pick to the Dolphins' opponent. The system validates it: picking against the jailed team, 2-point opportunity confirmed.

Thursday evening, 5 minutes before the deadline, Sarah makes her final decision: back to the Bills. She confirms, and her pick locks in. Over the weekend, she watches the games anxiously. Her Bills win on Sunday! But she has to wait until Tuesday to see the updated standings—she knows the scoring happens after Monday Night Football completes.

Tuesday morning, the Week 4 email arrives. Sarah eagerly opens it: the leaderboard has updated overnight, and she's moved into first place! Her Bills pick earned her the point she needed. Now it's time to study Week 4's matchups and defend her lead.

Sarah's aha moment came in Week 1: she realized she was no longer juggling multiple tabs, spreadsheets, and email drafts. Everything she needed to make informed, strategic picks was in one place, and she could change her mind as many times as she wanted until Thursday night. The friction disappeared, and the strategy became pure fun again.

### Journey 3: Tom's Quick Pick - The Casual Consistent Participant

Tom joined the Gridiron Gladiators league because his college buddies were in it, and he likes football well enough. He's not obsessive about it—he just wants to make his pick each week, see how he's doing, and maybe talk some trash in the group chat. In the old system, Tom would wait until Thursday morning, quickly skim the admin's email for standings, open a betting site, find the game with the best-looking favorite, and fire off a quick email reply: "I'll take the Chiefs this week."

It's Week 5, Thursday morning. Tom wakes up to the Tuesday email from Pick Six still sitting in his inbox. He's been meaning to make his pick but keeps forgetting. During his coffee break at work, he clicks the link from his phone. The mobile interface loads instantly: he sees he's in 8th place (standings updated from last week's results), the New England Patriots are jailed this week, and all the matchups are right there with odds.

Tom scrolls through, sees the Dallas Cowboys at -6, thinks "Yeah, Dallas should win that," taps to select them, and hits submit. The system shows a green confirmation: "Pick submitted successfully. Dallas Cowboys, 1 point." Total time: 90 seconds. Tom goes back to his coffee.

Over the weekend, Tom watches the games on TV and sees his Cowboys win. Nice! He knows he earned a point, but the suspense of seeing the full standings keeps him engaged. Tuesday morning, the Week 6 email arrives with updated standings—Tom moved up to 6th place. Even better.

Tom's aha moment was realizing he no longer needed to track down odds or compose emails. The entire workflow—check standings, see games, make pick, confirm—took less time than his old method of just finding the betting site. No friction meant he actually made his pick on time every week instead of occasionally forgetting.

### Journey 4: Jessica's Rescue - The Inconsistent Participant

Jessica loves being part of the Gridiron Gladiators league—it's a connection to her college friend group that's scattered across the country now. But honestly, she forgets to make her pick about half the time. Between work deadlines, kids' activities, and everything else, checking email on Thursday for a fantasy football reminder just doesn't make it to the top of her priority list. In the old system, she'd see the admin's Tuesday email, think "I'll do that later," and then completely forget until Friday when she'd see the group chat discussion about Thursday night's game.

It's Week 7. Jessica receives the Tuesday email from Pick Six with her personalized reminder. She reads it during lunch: she's in 11th place (lots of forgotten picks), the Tampa Bay Buccaneers are jailed, and there's a link to make her pick. She clicks it, the interface loads, but her meeting is starting in 2 minutes. She closes her phone.

Wednesday evening, another email lands: "Reminder: You haven't made your Week 7 pick yet. Deadline is Thursday at 8:10 PM." Jessica sees it while scrolling her phone before bed. She clicks the link, sees the matchups with odds, quickly picks the Los Angeles Chargers at -4.5, submits, and confirms. Total time: 60 seconds. She's in bed 2 minutes later.

Thursday, 7:00 PM. Jessica's phone buzzes: "Final reminder: 1 hour until Week 7 deadline." She checks—wait, did she already make her pick? She opens Pick Six and immediately sees a green banner at the top: "Your Week 7 pick is submitted: Los Angeles Chargers." Relief. She's good.

Jessica's aha moment came around Week 4 when she realized she hadn't forgotten a single pick yet this season. The combination of email reminders with direct links, the dead-simple mobile interface that made picks possible in 60 seconds, and the clear confirmation banner showing her pick status meant she could stay consistent for the first time ever.

### Journey 5: Mike's Emergency Override - The Admin Safety Net

It's Week 10, Thursday at 7:45 PM. Mike is watching TV when his phone buzzes with a text from Dave, one of his league participants: "Dude, my phone died and I'm stuck at my kid's soccer practice. Can you submit the Packers for me? Please!!! 25 min til deadline."

In the old system, Mike would have opened his massive spreadsheet, found Dave's row, manually typed in "Packers" under Week 10, then sent a confirmation email. With Pick Six, Mike opens his laptop and logs in. He sees his admin dashboard showing that 12 of 14 participants have submitted picks—Dave and one other person are still missing.

Mike clicks "Admin Override" and selects Dave's name from the dropdown. The interface loads Dave's pick view, showing which teams Dave has already used this season and highlighting the jailed team (Detroit Lions this week). Mike scrolls through the matchups, finds the Green Bay Packers at -7, selects them, and the system immediately validates: Dave hasn't picked the Packers yet this season, they're not the jailed team, and it's still before the deadline. Mike submits the pick on Dave's behalf.

The system logs the action with a timestamp: "Admin submitted pick for Dave Thompson - Green Bay Packers - 7:48 PM." Mike texts Dave back: "Got you. Packers are in. Good luck!" Dave responds with a thank-you emoji.

Sunday afternoon, the Packers win. When Tuesday's standings email goes out, Dave sees his point counted and knows Mike had his back. The system maintains complete transparency—anyone can see all picks after the Tuesday reveal, and the admin audit trail shows Mike's override action.

Later in the season, Mike needs the override feature again when Sarah emails him saying the website isn't loading on her work computer (IT firewall issue). Mike submits her pick from his admin dashboard while she figures out the technical issue. Another week, Tom realizes at 8:05 PM (5 minutes after the deadline) that he forgot to hit "submit" even though he'd selected a team. Mike checks the audit log, sees Tom did select a team before the deadline but didn't confirm, and uses his admin override to officially submit it—fairness preserved.

Mike's aha moment with the admin override feature came when he realized he could handle edge cases in 30 seconds instead of 10 minutes of spreadsheet surgery. The audit trail gave him confidence that every action was logged and transparent, and the validation system prevented him from accidentally submitting invalid picks even when helping someone in a rush.

### Journey Requirements Summary

The five user journeys reveal distinct capability areas required for Pick Six to deliver value:

**From Journey 1 (Mike's Liberation - Admin Weekly Operations):**

- Pre-season league setup and participant invitation system
- Automated Tuesday evening email delivery (6:00 PM) with personalized content
- Automated jailed team identification from live NFL odds data
- Automated scoring engine that processes game results and updates standings
- Admin monitoring dashboard showing pick submission status for all participants
- Admin verification interface for jailed team calculation and standings
- Admin as full participant (Mike makes his own picks, earns points, appears on leaderboard)

**From Journey 2 (Sarah's Strategy - Die-Hard Engaged Participant):**

- Participant pick interface displaying all weekly NFL matchups with live moneyline odds
- Visual indication of previously picked teams (grayed out, unavailable for selection)
- Clear visual marking of jailed team with explanation
- Real-time pick validation preventing duplicate team selection
- Anti-jailed pick option allowing participants to pick against jailed team for 2-point bonus
- Unlimited pick modifications before weekly deadline
- Pick confirmation and preview before final submission
- Tuesday standings reveal schedule (after Monday Night Football completion)
- Historical view of participant's season-long pick history

**From Journey 3 (Tom's Quick Pick - Casual Consistent Participant):**

- Mobile-responsive interface optimized for quick interactions
- Streamlined pick workflow: view standings → see matchups → select → submit in under 90 seconds
- Clear current standings display in every email and interface
- Simple, intuitive UX requiring minimal NFL knowledge or strategic analysis
- Instant pick confirmation with point value display

**From Journey 4 (Jessica's Rescue - Inconsistent Participant):**

- Mid-week reminder email system (Wednesday evening) for participants who haven't submitted picks
- Final deadline reminder email (Thursday, 1 hour before deadline)
- Prominent pick status banner/indicator visible immediately upon login
- Clear visual confirmation of submitted pick (team name, point value)
- Direct links from all emails to authenticated pick submission interface
- Fast mobile workflow enabling 60-second pick submissions from any device

**From Journey 5 (Mike's Emergency Override - Admin Safety Net):**

- Admin override capability to submit picks on behalf of any participant
- Admin override capability to modify any participant's pick (including post-deadline)
- Admin override interface showing participant's season context (teams already picked, jailed team status)
- Validation system that applies even during admin override (prevent invalid picks)
- Complete audit trail logging all admin override actions with timestamps
- Transparency of admin actions (visible in system logs, maintains trust)
- Edge case handling for technical issues, deadline misses, and emergency submissions

**Cross-Cutting Requirements Revealed:**

- User authentication and secure login system
- Email delivery infrastructure with personalized content generation
- NFL odds API integration for real-time moneyline data
- NFL schedule and game result data integration
- Deadline enforcement system (Thursday ~8:10 PM EST or 5 minutes before first game)
- Database for participant profiles, pick history, point totals, team selections
- Real-time data synchronization across all user interfaces
- Responsive design supporting desktop and mobile browsers
- Automated weekly cycle orchestration (Tuesday emails → deadline enforcement → scoring → repeat)

## Web Application Specific Requirements

### Project-Type Overview

Pick Six is architected as a Single Page Application (SPA) built with Next.js and React, targeting modern web browsers with full responsive mobile support. The application prioritizes straightforward implementation over extreme performance optimization, focusing on delivering a reliable, accessible experience for a private league of approximately 14 participants. The technical architecture emphasizes session persistence for user convenience and static odds data per week to ensure consistency in the pick submission workflow.

### Technical Architecture Considerations

**Application Architecture:**

- Single Page Application (SPA) pattern with client-side routing
- Next.js framework providing React-based component architecture
- Server-side capabilities for API routes, authentication, and data operations
- Component-based UI with clear separation of concerns (admin vs. participant views)

**Data Flow & State Management:**

- Client-side state management for pick workflow and UI interactions
- Server-authoritative for all critical operations (pick validation, deadline enforcement, scoring)
- Session-based authentication with extended session duration for user convenience
- No offline data persistence required—all operations require network connectivity

**API Integration Strategy:**

- Third-party NFL odds API integration via server-side endpoints (not direct client calls)
- Odds data fetched and cached server-side, delivered to clients as static data after Tuesday 6:00 PM
- No client-side odds refresh after weekly snapshot—ensures consistency across all participants
- Game results processing handled server-side on automated schedule

### Browser Support Matrix

**Supported Browsers:**

- Chrome/Chromium: Latest stable version
- Firefox: Latest stable version
- Safari: Latest stable version (macOS and iOS)
- Edge: Latest stable version

**Browser Requirements:**

- Modern JavaScript (ES6+) support
- CSS Grid and Flexbox support
- Fetch API for network requests
- Local Storage for session persistence

**Explicitly Not Supported:**

- Internet Explorer (any version)
- Legacy browser versions (>2 years old)
- Browser extensions or modifications that interfere with JavaScript execution

**Mobile Browser Support:**

- iOS Safari: Latest 2 major versions
- Chrome Mobile (Android): Latest stable version
- Focus on mobile browser experience rather than native app wrappers

### Responsive Design Strategy

**Design Approach:**

- Mobile-first responsive design principles
- Full feature parity between desktop and mobile experiences
- All admin and participant functionality available on mobile browsers

**Responsive Breakpoints:**

- Mobile: 320px - 767px (primary design target for participants)
- Tablet: 768px - 1023px (secondary consideration)
- Desktop: 1024px+ (admin dashboard optimized for this range)

**Mobile-Specific Considerations:**

- Touch-optimized interactions (tap targets ≥44px)
- Simplified navigation for small screens
- Optimized pick selection interface for mobile workflow (goal: 60-90 second completion)
- Mobile-friendly email templates with clear CTAs for pick submission

**Desktop-Specific Enhancements:**

- Admin dashboard with richer data visualization and monitoring tools
- Multi-column layouts for standings and pick history
- Hover states and tooltips for additional context

### Performance Targets

**Page Load Performance:**

- Initial page load: <3 seconds on standard broadband connection
- Subsequent navigation: <1 second (SPA routing)
- Time to Interactive (TTI): <4 seconds
- Focus on "feels fast" rather than extreme optimization

**Interaction Responsiveness:**

- Pick selection feedback: <200ms
- Form submissions: <1 second (excluding network latency)
- Validation feedback: Immediate (client-side pre-validation)

**Network Performance:**

- Minimize initial bundle size through code splitting
- Lazy load non-critical components and routes
- Optimize images and assets for web delivery
- No aggressive caching required—acceptable to fetch fresh data on page loads

**Scalability Considerations:**

- Optimized for ~14 concurrent users during peak (Tuesday-Thursday)
- No need for CDN or edge caching in MVP
- Standard database queries sufficient (no complex optimization required)
- Single region deployment acceptable

### SEO Strategy

**SEO Requirements:**

- **MVP Scope:** No SEO requirements—application is private and authentication-required
- **Future Consideration:** Potential public landing page for league discovery (post-MVP)
- **Current Approach:** Authenticated routes do not need to be crawlable
- **Meta Tags:** Basic meta tags for browser tab display and social sharing of login page

**Technical Implementation:**

- No server-side rendering (SSR) required for authenticated pages
- Client-side rendering sufficient for all MVP functionality
- Login/signup pages can be static or client-rendered

### Accessibility Standards

**Accessibility Level: Basic (WCAG 2.1 Level A Target)**

Given the private league context with technically comfortable participants, Pick Six targets basic accessibility compliance rather than full WCAG AA/AAA conformance.

**Core Accessibility Requirements:**

- Semantic HTML structure (proper heading hierarchy, landmark regions)
- Keyboard navigation for all interactive elements (pick selection, form submission, navigation)
- Sufficient color contrast for text and interactive elements (4.5:1 for normal text)
- Form labels and error messages clearly associated with inputs
- Focus indicators visible for keyboard navigation

**Screen Reader Support:**

- Basic ARIA labels for key interactive elements
- Meaningful alt text for any images or icons
- Logical tab order through pick submission workflow
- Clear announcement of validation errors and success messages

**Not Required in MVP:**

- Full screen reader optimization
- ARIA live regions for dynamic updates
- Advanced keyboard shortcuts or navigation patterns
- High contrast mode or theme customization

**Rationale:**
All league participants are technically comfortable individuals capable of using modern web applications. While basic accessibility is important for usability, advanced assistive technology support is not a priority for this private league context.

### Session Management & Authentication

**Session Strategy:**

- Extended session duration: 30-day "remember me" by default
- Secure, HTTP-only session cookies
- Automatic session refresh on active use
- Graceful session expiration handling (redirect to login with return URL)

**Authentication Flow:**

- Email-based signup from admin invitation links
- Password-based authentication (password requirements TBD during implementation)
- Optional "remember me" enabled by default for convenience
- Logout functionality available in user menu

**Security Considerations:**

- HTTPS required for all production traffic
- Secure password storage (hashed and salted)
- CSRF protection for state-changing operations
- Rate limiting on authentication endpoints

### Data Refresh & Real-Time Considerations

**Data Refresh Strategy:**

- Manual page refresh acceptable for all data updates
- No automatic polling or real-time websocket connections required
- Odds data fetched once per week (Tuesday before 6:00 PM email) and remains static for that week

**Pick Visibility & Privacy:**

- Participant picks remain hidden from other participants until Tuesday standings reveal
- No real-time pick submission counts or leaderboard during the week
- Admin can view all picks at any time through admin dashboard
- Complete transparency after Tuesday reveal (all picks visible to all participants)

**Future Stretch Goal:**

- Live NFL game score updates during game days (displayed within app)
- This is explicitly post-MVP and should not influence current architecture decisions

### Implementation Considerations

**Framework & Tooling:**

- Next.js as primary framework (routing, API routes, SSR capabilities if needed later)
- React for component architecture and UI rendering
- CSS approach TBD during architecture phase (Tailwind, CSS Modules, styled-components, or MUI components per user preference)
- TypeScript consideration TBD during implementation planning

**Development Priorities:**

- Prioritize functional correctness over performance optimization
- Focus on clear, maintainable code over clever optimizations
- Leverage Next.js conventions and best practices
- Build for 14 users first, scale considerations secondary

**Testing Strategy:**

- Focus on critical path testing (pick submission, validation, deadline enforcement)
- Manual testing acceptable for MVP given small user base
- Automated testing for core business logic (rule validation, scoring calculations)

**Deployment Strategy:**

- Single environment deployment for MVP (production)
- Standard web hosting (Vercel, Netlify, or similar Next.js-optimized platforms)
- No complex CI/CD pipeline required initially
- Ability to deploy updates during off-season or between games

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach: Problem-Solving MVP**

Pick Six follows a problem-solving MVP strategy focused on eliminating the manual administrative burden and participant friction experienced by a real, functioning pick'em league. The MVP targets complete automation of the weekly league cycle for a full 18-week NFL season, proving that the system can reliably replace manual spreadsheet management without anyone wanting to revert to the old process.

**Strategic MVP Goals:**

- Solve the core problem completely: automate weekly operations end-to-end
- Prove reliability over a full season with real stakes
- Reduce admin time from hours to <15 minutes per week
- Achieve 90%+ participant pick submission rate
- Earn admin commitment to Season 2 renewal

**Resource Requirements:**

- Solo development (primary developer/product owner)
- Part-time development through pre-season and early season (May-September 2026)
- Focus on Next.js learning while delivering production value
- BMAD methodology application for comprehensive planning and quality implementation

**Development Timeline:**

- MVP completion target: May 2026
- Pre-season testing: Summer 2026 (historical odds data)
- Production launch: September 2026 (NFL season start)
- Success evaluation: January 2027 (post-season)

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**

The MVP supports all five identified user journeys:

1. **Admin Weekly Operations** - Mike's liberation from manual spreadsheet management
2. **Die-Hard Engaged Participant** - Sarah's strategic multi-day pick workflow
3. **Casual Consistent Participant** - Tom's quick 90-second pick submission
4. **Inconsistent Participant** - Jessica's rescue through reminder emails
5. **Admin Emergency Override** - Mike's safety net for edge cases

**Must-Have Capabilities:**

**League Administration:**

- League creation UI supporting multiple concurrent leagues (multi-tenancy from day 1)
- Participant invitation system via email with signup links
- Pre-season league initialization before NFL season starts
- Admin participates as full league member (own picks, points, leaderboard presence)
- Admin monitoring dashboard showing real-time pick submission status
- Admin verification interface for weekly jailed team calculation
- Admin override capabilities: submit/modify picks for any participant at any time
- Complete audit trail for all admin override actions
- **CSV export functionality** for complete league state (participants, week-by-week picks, point totals) - serves as fail-safe if system abandonment becomes necessary mid-season

**Participant Experience:**

- User authentication with extended 30-day session duration
- Pick interface displaying all weekly NFL matchups with live moneyline odds
- Visual indication of previously picked teams (grayed out, unavailable)
- Visual indication of jailed team with clear explanation
- Real-time pick validation preventing duplicate team selection and jailed team violations
- Option to pick against jailed team for 2-point bonus opportunity
- Unlimited pick modifications before weekly deadline
- Clear deadline countdown display
- Pick confirmation with prominent status banner ("Your pick is submitted: [Team Name]")
- Live leaderboard showing all participants' points and rankings (updated Tuesdays after MNF)
- Personal pick history (all weeks, teams selected, outcomes)
- League-wide transparency: all picks visible to all participants after Tuesday reveal
- Mobile-responsive interface optimized for 60-90 second pick workflow
- **League rules reference page** accessible to all participants and admin at any time

**Email Automation:**

- Automated Tuesday 6:00 PM reminder email with current standings, jailed team, and pick submission link
- Mid-week reminder email (Wednesday evening) for participants who haven't submitted picks
- Final deadline reminder email (Thursday, 1 hour before deadline) for outstanding picks
- All emails include direct authentication links to pick submission interface
- Personalized email content based on participant status

**Automation Engine:**

- Automated jailed team identification (team with worst odds/biggest favorite each week)
- **Jailed team tie-breaker logic:** Primary criterion: worst moneyline odds → Tie-breaker 1: largest point spread → Tie-breaker 2: random selection with logged seed for auditability
- Automated pick deadline enforcement (locks 5 minutes before first game of week, typically Thursday ~8:10 PM EST)
- Automated scoring calculation after game completion
- Automated leaderboard updates processing after Monday Night Football completion
- Season-long rule validation enforcement (no duplicate picks, jailed team blocking)
- Automated weekly cycle orchestration (Tuesday emails → deadline enforcement → scoring → repeat)

**Rule Configuration (Hardcoded for MVP):**

- Jailed team mechanics: biggest favorite each week blocked from selection
- Anti-jailed bonus: picking against jailed team earns 2 points instead of 1
- Standard scoring: 1 point per correct pick
- No duplicate team selections allowed throughout season
- 18-week regular season support
- Pick deadline: Thursday ~8:10 PM EST or 5 minutes before first game of week (whichever is earlier)

**Technical Infrastructure:**

- Third-party NFL odds API integration for real-time moneyline data and point spreads
- Odds data fetched and cached Tuesday before 6:00 PM email, remains static for week
- Game result processing and outcome tracking
- Full NFL regular season schedule data (18 weeks)
- Transactional email delivery service integration
- Database supporting multi-league architecture (participant profiles, pick history, point totals, team selections, league configurations)
- Session-based authentication with extended duration
- Admin audit trail for override actions and system events
- CSV export functionality for league data extraction

**Success Criteria for MVP:**

- Complete 18-week regular season without system failures requiring manual intervention fallback
- No participant or administrator wants to revert to old manual process at any point
- Admin time investment reduced to <15 minutes per week
- 90%+ weekly pick submission rate maintained throughout season
- Zero scoring disputes due to system calculation errors
- Admin commits to using platform for subsequent season

**Explicitly Out of MVP Scope:**

The following capabilities are intentionally excluded to maintain focus and ensure timely first-season delivery:

- **League renewal workflow** - Admin will create new league via UI for Season 2 (manual roster transfer)
- **Configurable rule engine** - Rules hardcoded to match current league requirements; variations deferred to post-MVP
- **Advanced analytics** - Historical analysis, trend identification, consistency metrics, streak tracking
- **Native mobile applications** - Responsive web browser experience sufficient for MVP
- **Social features** - In-app messaging, trash talk, activity feeds beyond email notifications
- **Advanced notifications** - Push notifications, SMS reminders, custom notification preferences
- **Payment processing** - Prize logistics handled externally, explicit non-goal for platform
- **Public league discovery** - No marketplace or league browsing; leagues created by known participants only
- **Live game score updates** - Stretch goal explicitly deferred; participants use external sources for live scores during games
- **SEO optimization** - Private, authentication-required application; no public pages to optimize
- **Advanced accessibility** - Basic WCAG Level A compliance; full AA/AAA conformance deferred

### Post-MVP Features

**Phase 2: Season 2 Enhancements (Year 2)**

After successful first season completion and admin renewal commitment:

- **Enhanced League Renewal Workflow:**

  - "Renew League for New Season" feature automating roster and settings transfer
  - Participant roster management (remove/replace members between seasons)
  - Carry forward league settings with option to adjust rules
  - Archive previous season data while initializing new season
  - Historical season comparison and navigation

- **Advanced Analytics & Reporting:**

  - Streak tracking (consecutive wins/losses)
  - Pick pattern analysis and trends
  - Head-to-head participant comparisons
  - Consistency metrics and reliability scoring
  - Season-over-season performance comparisons

- **Enhanced User Experience:**

  - Improved mobile interface optimizations
  - Additional reminder and notification options
  - Enhanced leaderboard visualizations
  - Personal performance dashboards

- **System Improvements:**
  - Performance optimizations based on Season 1 learnings
  - Enhanced error handling and recovery
  - Improved admin tools and monitoring
  - Additional export formats and reporting options

**Phase 3: Platform Expansion (Years 2-3)**

After proving reliability with multiple seasons:

- **Configurable Rule Engine:**

  - Admin-defined variations on jailed team mechanics
  - Custom scoring systems and point structures
  - Adjustable deadlines and special circumstance extensions
  - League size flexibility and format variations
  - Support for different season structures

- **Multi-League Management:**

  - Multi-league admin dashboard for admins running multiple leagues simultaneously
  - Cross-league analytics and comparisons
  - Bulk operations and league templates
  - League cloning and rule variation management

- **Enhanced Features:**
  - Live NFL game score integration within app interface (stretch goal from MVP)
  - Advanced notification systems (push, SMS, custom preferences)
  - Social features and community building (opt-in messaging, discussions)
  - Additional data integrations (injuries, weather, expert picks)

**Phase 4: Growth & Scale (Years 3+)**

Long-term vision for broader platform availability:

- **Public Availability Considerations:**

  - League discovery and marketplace features
  - Public landing pages with SEO optimization
  - Self-service league creation for external administrators
  - Community-contributed rule variations and formats

- **Native Mobile Applications:**

  - iOS and Android apps with native features
  - Push notifications and offline capabilities
  - App-specific performance optimizations

- **Advanced Automation:**

  - AI-powered insights and recommendations
  - Predictive analytics and pattern detection
  - Automated content generation for league communications

- **Platform Maturity:**
  - Enterprise-grade reliability and monitoring
  - Advanced security and compliance features
  - API access for third-party integrations
  - White-label or customization options

### Scope Decisions & Rationale

**Key MVP Inclusions:**

1. **Multi-League Support (Day 1):** Building multi-tenancy from the start prevents costly architectural refactoring later. Supports multiple leagues among friend group if desired (different rule variations, different participant sets).

2. **Jailed Team Tie-Breaker Logic:** Edge case handling essential for rule correctness and trust. Without proper tie-breaker cascade (odds → spread → random), Week 1 ambiguity could undermine confidence in system.

3. **Admin CSV Export:** Critical risk mitigation providing escape hatch if catastrophic failure occurs mid-season. Reduces "all or nothing" adoption risk and gives admin confidence that league data isn't locked in system.

4. **League Rules Reference Page:** Simple but essential transparency feature reducing support burden and building trust through clear rule documentation accessible at any time.

5. **Comprehensive Email Reminders:** Three-tier reminder system (Tuesday, Wednesday, Thursday) essential for achieving 90%+ submission rate target, particularly for inconsistent participants.

**Key MVP Exclusions:**

1. **Configurable Rules Engine:** Hardcoding current league rules dramatically reduces MVP complexity while delivering full value for target users. Rule variations can be added post-MVP if additional leagues need different mechanics.

2. **League Renewal Workflow:** Manual league creation for Season 2 via UI is acceptable trade-off. Automated renewal nice-to-have but not essential for proving core value.

3. **Advanced Analytics:** Historical analysis and trend tracking enhance experience but aren't essential for core weekly workflow or success criteria.

4. **Live Game Scores:** Explicitly deferred stretch goal. Participants comfortable using external sources (ESPN, etc.) for live scores during games. Focus on pick submission workflow and standings reveal.

### Risk Mitigation Strategy

**Technical Risks:**

**Risk: Third-party NFL odds API reliability or availability**

- **Mitigation:** Research and select established, reliable API provider during architecture phase; implement fallback manual odds entry capability for admin if API fails; cache odds data server-side after Tuesday fetch to eliminate mid-week API dependencies
- **Contingency:** Admin can manually set jailed team and odds if API completely fails for a week

**Risk: Deadline enforcement precision failure**

- **Mitigation:** Thoroughly test deadline logic across timezone scenarios; implement server-authoritative deadline checks; include buffer mechanisms for clock skew; comprehensive logging of deadline events
- **Contingency:** Admin override capabilities allow manual pick submission if automated deadline fails

**Risk: Email delivery failures**

- **Mitigation:** Use established transactional email service (SendGrid, AWS SES, etc.); implement delivery confirmation tracking; retry logic for failed sends; admin notification if email batch fails
- **Contingency:** Admin can manually notify participants via external channels if automated emails fail; CSV export provides league state for manual communication

**Risk: Scoring calculation errors**

- **Mitigation:** Thoroughly test scoring logic with historical season data; automated test coverage for rule validation; clear audit trails for all scoring decisions; admin verification interface showing calculation details
- **Contingency:** Admin can manually adjust scores if calculation error discovered; audit trail supports dispute resolution

**Market Risks:**

**Risk: Participants resistant to changing from familiar manual process**

- **Mitigation:** Pre-season testing with historical data allowing participants to experience system before real season; clear communication of benefits and "try it for one season" positioning; admin CSV export providing safety net
- **Validation:** Summer 2026 test run with real participants using historical odds data

**Risk: MVP doesn't deliver sufficient value to justify continued use**

- **Mitigation:** Focus MVP on complete workflow automation (admin time savings) and friction elimination (participant experience); maintain alignment with documented success criteria; regular check-ins during first season
- **Validation:** Mid-season check (Week 9) assessing participant satisfaction and admin time savings

**Resource Risks:**

**Risk: Solo development timeline overruns**

- **Mitigation:** Conservative MVP scope excluding nice-to-haves; leverage Next.js ecosystem and existing libraries; prioritize functional correctness over optimization; BMAD methodology ensuring thorough planning before implementation
- **Contingency:** Delay season launch if necessary (pre-season testing reveals critical gaps); return to manual process for Season 1 if MVP not ready

**Risk: Insufficient time for pre-season testing**

- **Mitigation:** Target May 2026 MVP completion providing 3-4 months testing buffer; use historical odds data for realistic test scenarios; engage real participants in summer testing
- **Contingency:** Manual first season if testing reveals fundamental issues; treat Season 1 as extended beta with participant understanding

**Risk: Developer unavailable during season for critical issues**

- **Mitigation:** Thorough testing reducing likelihood of critical failures; admin CSV export and override capabilities providing manual workarounds; comprehensive error logging for post-incident debugging
- **Contingency:** Admin manages emergencies via override capabilities; league continues manually if system completely fails

## Functional Requirements

### League Management

- **FR1:** League admins can create new leagues with unique names and configurations
- **FR2:** League admins can invite participants to leagues via email with signup links
- **FR3:** League admins can initialize leagues for pre-season preparation before NFL season starts
- **FR4:** League admins can view list of all leagues they administer
- **FR5:** League admins can access league settings and configuration details
- **FR6:** Participants can view league information including name, season, and participant roster
- **FR7:** Participants can access a league rules reference page explaining all scoring rules, jailed team mechanics, tie-breaker logic, deadline policies, and game rules

### User Management & Authentication

- **FR8:** New users can create accounts via invitation signup links
- **FR9:** Users can log in with email and password authentication
- **FR10:** Users can remain logged in for extended periods (session persistence)
- **FR11:** Users can log out of their account
- **FR12:** League admins can view complete list of participants in their league
- **FR13:** League admins participate as full league members with their own picks and points

### Pick Submission & Management

- **FR14:** Participants can view current week's NFL matchups with moneyline odds
- **FR15:** Participants can view point spread information for all current week matchups
- **FR16:** Participants can view which NFL teams they have previously picked during the current season
- **FR17:** Participants can see visual indication of teams they are not allowed to pick (previously selected teams)
- **FR18:** Participants can see visual indication of the jailed team for the current week
- **FR19:** Participants can select one NFL team as their pick for the current week
- **FR20:** Participants can select to pick against the jailed team for 2-point bonus opportunity
- **FR21:** Participants can modify their pick unlimited times before the weekly deadline
- **FR22:** Participants can see confirmation of their submitted pick including team name and point value
- **FR23:** Participants can see clear countdown to weekly pick deadline
- **FR24:** Participants receive real-time validation preventing selection of previously picked teams
- **FR25:** Participants receive real-time validation preventing direct selection of jailed team (unless picking against)
- **FR26:** The system enforces pick deadline (Thursday ~8:10 PM EST or 5 minutes before first game, whichever earlier)
- **FR27:** Participants cannot submit or modify picks after the weekly deadline has passed

### Admin Operations & Overrides

- **FR28:** League admins can view real-time pick submission status for all participants (submitted vs. not submitted)
- **FR29:** League admins can submit picks on behalf of any participant at any time
- **FR30:** League admins can modify any participant's pick at any time (including post-deadline)
- **FR31:** Admin override operations apply the same validation rules (no duplicates, jailed team restrictions)
- **FR32:** The system logs all admin override actions with timestamps in an audit trail
- **FR33:** League admins can view audit trail of all admin override actions for transparency
- **FR34:** League admins can verify weekly jailed team calculation and see tie-breaker logic applied if needed

### Email Notifications & Reminders

- **FR35:** The system sends automated Tuesday 6:00 PM reminder emails to all league participants
- **FR36:** Tuesday reminder emails include current standings, jailed team identification, and pick submission link
- **FR37:** The system sends mid-week reminder emails (Wednesday evening) to participants who haven't submitted picks
- **FR38:** The system sends final deadline reminder emails (Thursday, 1 hour before deadline) to participants who haven't submitted picks
- **FR39:** All reminder emails include direct authentication links to pick submission interface
- **FR40:** Email content is personalized based on participant status (pick submitted vs. outstanding)

### Scoring, Results & Leaderboard

- **FR41:** The system automatically processes game results after games complete
- **FR42:** The system calculates participant points based on pick outcomes (1 point standard, 2 points anti-jailed)
- **FR43:** The system updates leaderboard after Monday Night Football completion each week
- **FR44:** Participants can view live leaderboard showing all participants' points and rankings
- **FR45:** Leaderboard displays updated standings every Tuesday after MNF processing
- **FR46:** Participants can view their personal pick history (all weeks, teams selected, outcomes)
- **FR47:** Participants can view all participants' picks after Tuesday standings reveal (full transparency)
- **FR48:** Participant picks remain hidden from other participants until Tuesday standings reveal
- **FR49:** League admins can view all participant picks at any time (real-time visibility)

### Jailed Team & Rule Automation

- **FR50:** The system automatically identifies the jailed team each week (team with worst/biggest favorite moneyline odds)
- **FR51:** If multiple teams are tied for worst odds, the system applies tie-breaker logic: largest point spread
- **FR52:** If teams are still tied after point spread tie-breaker, the system randomly selects jailed team with logged seed for auditability
- **FR53:** The system enforces no duplicate team selection rule throughout the season (each team can be picked only once per participant)
- **FR54:** The system enforces anti-jailed bonus rule (picking against jailed team earns 2 points instead of 1)

### Data Export & Reporting

- **FR55:** League admins can export complete league state to CSV format at any time
- **FR56:** CSV export includes participant list, week-by-week picks for all weeks, and point totals
- **FR57:** CSV export provides complete league snapshot suitable for external spreadsheet management if needed

### Season Management

- **FR58:** The system supports complete 18-week NFL regular season tracking
- **FR59:** The system maintains season-long state including all participant picks, outcomes, and point totals
- **FR60:** The system provides weekly cycle orchestration (Tuesday emails → deadline enforcement → scoring → repeat)

## Non-Functional Requirements

### Performance

**Page Load Performance:**

- **NFR1:** Initial page load must complete within 3 seconds on standard broadband connection
- **NFR2:** Subsequent page navigation must complete within 1 second (SPA routing)
- **NFR3:** Time to Interactive (TTI) must be within 4 seconds for primary user workflows

**Interaction Responsiveness:**

- **NFR4:** Pick selection feedback must display within 200 milliseconds
- **NFR5:** Form submissions must complete within 1 second (excluding network latency)
- **NFR6:** Client-side validation feedback must be immediate (synchronous)

**Mobile Performance:**

- **NFR7:** Mobile pick workflow must be completable within 60-90 seconds on typical mobile connections
- **NFR8:** Touch interactions must respond within 100 milliseconds

### Security

**Authentication & Session Management:**

- **NFR9:** All production traffic must be served over HTTPS
- **NFR10:** User passwords must be hashed and salted before storage
- **NFR11:** Session cookies must be HTTP-only and secure
- **NFR12:** Failed login attempts must be rate-limited to prevent brute force attacks

**Data Protection:**

- **NFR13:** User authentication credentials must never be logged or transmitted in plain text
- **NFR14:** Admin audit trails must be tamper-evident and include timestamps
- **NFR15:** CSRF protection must be implemented for all state-changing operations

**Access Control:**

- **NFR16:** Admin override capabilities must be restricted to authenticated league administrators only
- **NFR17:** Participant picks must remain inaccessible to other participants until Tuesday standings reveal
- **NFR18:** Admin access to participant picks must be logged in audit trail

### Reliability & Availability

**System Uptime:**

- **NFR19:** System must maintain 99.5% uptime across full NFL season (18 weeks)
- **NFR20:** Critical period availability (Tuesday evening email send, game day deadlines) must be 100%
- **NFR21:** Planned maintenance must not occur during critical periods (Tuesday 5-7pm, Thursday 7-9pm)

**Data Integrity:**

- **NFR22:** Scoring calculations must have zero errors (100% accuracy)
- **NFR23:** Jailed team identification must be 100% accurate based on odds data
- **NFR24:** Pick deadline enforcement must have zero false positives (no early lockouts) and zero false negatives (no late submissions accepted)
- **NFR25:** All participant picks and historical data must be preserved without loss throughout season

**Failure Recovery:**

- **NFR26:** System must provide graceful degradation if NFL odds API fails (admin manual override capability)
- **NFR27:** Email delivery failures must be logged and retried automatically
- **NFR28:** Database transactions must be atomic to prevent partial state updates

### Integration

**NFL Odds API Integration:**

- **NFR29:** Odds data must be fetched and cached Tuesday before 6:00 PM email without fail
- **NFR30:** API failures must not block weekly email sending (fallback to admin manual entry)
- **NFR31:** Odds data must remain consistent for entire week after Tuesday cache (no mid-week refreshes)

**Email Service Integration:**

- **NFR32:** Email delivery confirmations must be tracked and logged
- **NFR33:** Failed email sends must retry with exponential backoff
- **NFR34:** Weekly reminder emails must be delivered to all participants by 6:00 PM Tuesday

**Game Results Integration:**

- **NFR35:** Game results must be processed and scores updated within 1 hour of game completion
- **NFR36:** Monday Night Football results must process and trigger Tuesday standings update by 6:00 AM Tuesday

### Accessibility

**WCAG Level A Compliance:**

- **NFR37:** All interactive elements must be keyboard navigable
- **NFR38:** Text and interactive elements must maintain 4.5:1 color contrast ratio
- **NFR39:** Form inputs must have clearly associated labels
- **NFR40:** Focus indicators must be visible for keyboard navigation
- **NFR41:** Semantic HTML structure must be used (proper heading hierarchy, landmark regions)

**Screen Reader Support:**

- **NFR42:** Key interactive elements must have appropriate ARIA labels
- **NFR43:** Validation errors and success messages must be announced to screen readers
- **NFR44:** Pick submission workflow must have logical tab order

### Maintainability & Operational Excellence

**Error Handling & Logging:**

- **NFR45:** All system errors must be logged with context (timestamp, user, action attempted)
- **NFR46:** Critical failures (deadline enforcement, scoring, email delivery) must generate immediate alerts
- **NFR47:** Admin must have visibility into system health and recent errors

**Data Backup & Recovery:**

- **NFR48:** Complete league state must be exportable to CSV format at any time (admin fail-safe)
- **NFR49:** Database backups must be automated and restorable
- **NFR50:** Audit trail of admin actions must be complete and preserved

**Deployment & Updates:**

- **NFR51:** Updates must be deployable during off-season or between games without data loss
- **NFR52:** Database migrations must be reversible in case of deployment issues
- **NFR53:** System must support deployment to standard web hosting platforms (Vercel, Netlify)
