---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-pick-six-2026-01-05.md
  - _bmad-output/planning-artifacts/prd.md
---

# UX Design Specification pick-six

**Author:** Kyle
**Date:** 2026-02-16

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

Pick Six transforms the management of custom NFL pick'em leagues from a manual, fragmented experience into an integrated, automated platform. The UX design challenge is twofold: liberate league administrators from 2-3 hours of weekly manual work through invisible automation, while transforming the participant experience from a multi-tab chore into an enjoyable weekly ritual completed in 60-90 seconds.

The application must orchestrate complex weekly operations (automated emails, jailed team identification, deadline enforcement, scoring updates) while maintaining complete transparency, real-time validation, and flexibility. The UX must serve multiple distinct user segments—from die-hard strategists analyzing matchups across multiple days to inconsistent participants making last-minute mobile picks—through a single, intuitive interface that requires no tutorial or onboarding.

Success is measured not just by efficiency, but by emotional transformation: administrators transitioning from "doing" to "monitoring," and participants rediscovering the fun in their weekly football ritual.

### Target Users

**Primary User: League Administrator (Mike)**
- Running the league for 5+ seasons, technically comfortable but time-constrained
- Currently burning out from hours of weekly spreadsheet maintenance, email coordination, and odds research
- **UX Success Criteria:** "Hands-off" monitoring experience reducing weekly time from hours to <15 minutes
- **Critical Aha Moment:** First Tuesday when automated email goes out without any manual action required
- **Dual Role Complexity:** Participates as full league member while maintaining administrative oversight
- **Device Context:** No assumptions—must work equally well on desktop and mobile for both admin and participant workflows

**Primary User Segments: League Participants**

1. **Die-Hard Engaged (Sarah)**
   - Studies matchups carefully across multiple days, changes picks multiple times
   - **UX Success:** Unified interface with current week's odds and standings supporting multi-session engagement without overwhelming casual users
   - **Aha Moment:** Realizing all necessary information for making informed picks exists in one place instead of scattered across multiple tabs

2. **Casual Consistent (Tom)**
   - Makes picks reliably but quickly, minimal strategic analysis required
   - **UX Success:** Streamlined workflow enabling 90-second pick completion from any device
   - **Aha Moment:** Completing entire pick workflow faster than composing an email reply

3. **Inconsistent Participants (Jessica)**
   - Forgets picks frequently, needs maximum convenience and reminders
   - **UX Success:** 60-second mobile workflow with prominent pick status clarity eliminating "did I submit?" anxiety
   - **Aha Moment:** Not forgetting a single pick all season due to friction-free mobile experience

4. **Emergency Cases (Everyone, occasionally)**
   - Technical issues, last-minute deadline scenarios, forgotten picks
   - **UX Success:** Admin override safety net handling edge cases transparently without compromising trust

**Cross-Segment User Characteristics:**
- All technically comfortable with modern web applications (no tutorial required)
- Mix of desktop and mobile usage—cannot assume device preference by user type or context
- Previous experience with fantasy football platforms (ESPN, Yahoo) establishes baseline expectations
- Varying NFL expertise: from die-hard fans to casual participants
- Understanding of league's jailed team mechanic varies (7-year veterans vs. potential new participants)

### Key Design Challenges

**1. Full Feature Parity Across Devices**
Unlike typical mobile-first approaches that simplify features for mobile, Pick Six requires identical functionality and information density on both mobile and desktop. Participants and administrators need access to complete feature sets regardless of device—no "check desktop for full experience" compromises. This demands sophisticated responsive patterns that maintain information architecture integrity while adapting to screen constraints.

**2. Multi-Segment Single Interface**
One interface must elegantly serve die-hard strategists requiring multi-day analysis and multiple pick modifications alongside inconsistent participants needing 60-second mobile completion. Neither group can feel the UI is "not for them." The solution requires progressive disclosure patterns that surface essentials immediately while making deeper context available on-demand—fast path for casual users, rich exploration for engaged users, same interface.

**3. Jailed Team Clarity Without Clutter**
The unique "jailed team" mechanic (blocking the week's biggest favorite) and anti-jailed bonus opportunity (2 points for picking against jailed team) must be crystal clear to new participants while not patronizing experienced users. Visual design must educate without cluttering, using subtle but unmistakable prominence for the bonus opportunity. In-context explanation needed without tutorial friction.

**4. Transforming Chore to Ritual**
The emotional shift from "weekly obligation" to "enjoyable ritual" requires more than operational efficiency. The UX needs moments of delight, clear progress indicators, reduced anxiety through validation and state clarity, and restoration of the competitive fun that originally motivated league participation. Current fragmented workflow has drained enjoyment—design must reignite it.

**5. Admin Dual-Role Navigation**
Mike participates as a full league member (making picks, earning points, appearing on leaderboard) while maintaining administrative oversight (monitoring submissions, handling overrides, verifying jailed team calculations). The interface must make this role-switching seamless without causing confusion about which "hat" he's wearing at any moment. Admin capabilities must be accessible without polluting the participant experience.

**6. Invisible Automation with Visible Confidence**
Administrator success hinges on trusting that automated operations (Tuesday emails, jailed team identification, deadline enforcement, scoring updates) execute correctly without manual intervention. The UX must provide confidence through visibility (monitoring dashboards, verification interfaces, audit trails) while keeping the automation invisible to participants. Admin needs to "know it worked" without "doing the work."

**7. No-Tutorial Intuitiveness**
Despite unique mechanics (jailed team, anti-jailed bonuses, season-long team uniqueness), the interface must be immediately usable without tutorials or onboarding flows. Users should "just get it" through visual hierarchy, familiar fantasy football patterns, and contextual in-line explanations. Complexity hidden behind intuitive interactions, not buried in help documentation.

### Design Opportunities

**1. Progressive Disclosure for Speed & Depth**
Smart information hierarchy that surfaces essentials immediately (current standings, jailed team identification, matchups with odds, pick submission) while making deeper context available on-demand (detailed pick history, rules reference, audit trails). Design enables Tom's 90-second workflow and Sarah's multi-day strategic analysis through the same interface—priority-based progressive disclosure rather than feature removal.

**2. Visual Language for Bonus Opportunities**
Sophisticated visual cues (subtle color highlights, distinctive outlines, iconography) that make the anti-jailed bonus opportunity immediately noticeable without screaming for attention. Think: visual design that rewards attention and creates "discovery moments" for engaged users while remaining unobtrusive for quick-pick users. Bonus opportunities should feel like strategic advantages, not promotional noise.

**3. Anxiety-Reducing State Clarity**
Prominent, persistent indicators showing pick status ("Your pick is submitted: Buffalo Bills, 1 point") that eliminate the "did I actually submit?" worry experienced in email-based workflows. Green confirmation banners, clear visual states, unmistakable feedback. Peace of mind through state transparency—participants should never question whether their action completed successfully.

**4. Contextual Intelligence**
Interface adapts to user context: different information prominence based on day of week (Tuesday: standings focus and competitive positioning, Thursday: deadline urgency and submission status), reminder visibility based on submission status (prominent for outstanding picks, subtle confirmation for submitted), progressive urgency as deadline approaches. Intelligent prioritization reduces cognitive load.

**5. Unified Information Architecture**
Elimination of the current fragmented workflow (email for standings, betting sites for odds, spreadsheets for history) through comprehensive single-interface design. All decision-making information co-located: live odds, current standings, personal pick history, remaining team options, jailed team identification. Strategic advantage through information consolidation—no external tabs required.

**6. Rules/Help Reference Architecture**
Dedicated Rules/Help page living outside the main pick workflow, providing comprehensive reference for new participants learning league mechanics and seasoned participants checking specific rulings. Accessible anytime without disrupting active workflows. Covers jailed team mechanics, anti-jailed bonuses, tie-breaker logic, deadline policies, scoring rules—complete league rulebook as safety net and educational resource.

**7. Mobile-Responsive Without Compromise**
Full feature set delivered on mobile without "desktop-only" limitations or compromised experiences. Touch-optimized interactions, optimized information density, streamlined navigation—but zero functionality sacrificed. Opportunity to prove responsive design can deliver complete experiences, not just simplified subsets. Mobile as primary design target with desktop as layout enhancement, not the reverse.

**8. Competitive Engagement Through Leaderboard**
Clear standings visibility restoring the competitive aspect that makes pick'em leagues enjoyable. Current leaderboard after Tuesday reveals, historical performance tracking, transparent pick visibility (everyone sees everyone's picks after reveal). Design emphasizes competitive positioning without creating anxiety—celebration of success, clear understanding of standings, motivation to stay engaged week-over-week.

## Core User Experience

### Defining Experience

**Primary User Action: Weekly Pick Submission**

The weekly pick submission workflow is the core action for all users in Pick Six, including the league administrator. Every user—regardless of role, engagement level, or device—participates in the same fundamental ritual: evaluating matchups, selecting a team, and submitting their pick before the weekly deadline. This unified primary action ensures that administrative oversight remains grounded in the participant experience rather than divorced from it.

The pick submission experience must accommodate extreme variability in user behavior while maintaining consistency in interface and outcome. Die-hard engaged participants may visit multiple times across several days, analyzing odds changes and modifying picks strategically. Inconsistent participants may make a single 60-second mobile visit on Thursday afternoon. Both users navigate the same interface, access the same information, and complete the same fundamental action—but the design enables radically different engagement patterns without compromise.

**Critical Success: 60-90 Second Completion Window**

The baseline success metric for the pick submission workflow is completion within 60-90 seconds for users with basic decision-making clarity. This target encompasses the entire flow from email click-through to final pick confirmation:

1. Email link → authenticated application load
2. Immediate context recognition (standings, jailed team, matchups)
3. Pick selection with real-time validation
4. Submission and clear confirmation

This aggressive timeline requirement drives fundamental UX decisions around information hierarchy, visual clarity, and interaction efficiency. Every additional second of cognitive load or interaction friction multiplies across 14 participants over 18 weeks—transforming a "minor inconvenience" into a systemic failure to deliver value.

**Secondary Admin Action: Monitoring League Operations**

For the league administrator, monitoring represents the secondary workflow that validates automation success. Mike needs visibility into league operations without manual execution—seeing pick submission status, verifying jailed team calculations, reviewing automated email delivery, and accessing override capabilities when edge cases arise.

The monitoring experience must provide confidence that automation executed correctly while remaining completely unintrusive. Mike should feel like a "supervisor observing a well-oiled machine" rather than an "operator managing a complex system." The UX challenge is delivering sufficient visibility for confidence without creating perceived obligation for action.

### Platform Strategy

**Responsive Web Application (Next.js/React)**

Pick Six is architected as a responsive web application built on Next.js and React, targeting modern web browsers with zero native mobile application components in the MVP scope. This platform decision prioritizes rapid development velocity, cross-platform consistency, and deployment simplicity over native mobile capabilities like push notifications or offline functionality.

**Browser Support Matrix:**
- Chrome/Chromium: Latest stable version
- Firefox: Latest stable version  
- Safari: Latest stable (macOS and iOS)
- Edge: Latest stable version
- Explicitly excludes: Internet Explorer (all versions), legacy browsers >2 years old

**Full Device Parity Requirement**

Unlike typical mobile-first responsive design that simplifies mobile experiences by removing features, Pick Six requires identical functionality and information density across all screen sizes. Every feature accessible on desktop must be equally accessible and functional on mobile—no "view on desktop for full experience" compromises permitted.

This full parity requirement creates significant UX design challenges around information hierarchy, touch target sizing, and interaction patterns. Solutions must optimize for mobile constraints (small screens, touch interactions, potentially slower connections) while delivering desktop-class feature completeness. Progressive disclosure, collapsible sections, and intelligent prioritization become essential techniques rather than optional enhancements.

**Input Modalities: Touch and Mouse/Keyboard**

The application must treat touch-based mobile interactions and mouse/keyboard desktop interactions as equal first-class citizens. Touch targets must meet 44px minimum sizing standards, hover states must have touch-equivalent alternatives, and keyboard navigation must support all workflows without mouse dependency.

**Session Management: Rolling 30-Day Activity-Based Timeout**

Authentication sessions persist through a rolling 30-day timeout that resets with each user interaction. Active participants engaging week-over-week remain authenticated indefinitely without re-login friction. Only participants inactive for 30+ consecutive days require re-authentication.

This rolling session strategy dramatically reduces authentication friction for consistent participants (the majority) while maintaining reasonable security for abandoned sessions. The UX implication: login should feel like a "once per season" action for engaged users rather than a recurring weekly obstacle.

**Email as Primary Engagement Channel**

Email serves as the critical engagement mechanism connecting users to the application. Tuesday automated reminder emails, mid-week reminder emails, and deadline alerts drive traffic and participation. Email deep links must authenticate users (when sessions remain valid) and route directly to relevant interfaces (pick submission, standings view, admin dashboard).

**Admin Email Configuration Control**

The admin must have configuration control over Tuesday reminder email content week-over-week before automated sending. This enables contextual messaging (holiday schedule adjustments, rule reminders, league-specific banter) while maintaining automation benefits. The UX challenge: providing rich email content editing without creating administrative burden that undermines automation value.

**Weather Data Integration: Home Team Identification + Conditions**

The pick submission interface must display current weather conditions for each matchup, clearly identifying home teams and relevant weather factors (temperature, precipitation, wind, stadium type). Weather significantly impacts game outcomes—particularly for outdoor stadiums in cold weather cities—and provides strategic context currently absent from the old email-based workflow.

Weather data integration leverages free weather APIs, requires minimal implementation complexity, and delivers disproportionate strategic value for engaged participants. For casual participants, weather data remains unobtrusive background context rather than required analysis.

**Pre-season Week 1 preview (integration validation)**

Before the league’s pick window opens (e.g. July–August), signed-in users should still be able to view **NFL regular season Week 1** matchups with **live or early odds** and **weather** when APIs return data—matching the in-season pick UI as closely as practical. Use clear **preview** labeling and disable or hide pick actions until competition is active so users can **validate third-party integrations** before September without confusing rehearsal data for real picks. Detailed acceptance criteria: **`_bmad-output/planning-artifacts/epics.md`** (Epic 3, Stories 3.1–3.2, 3.6).

**Mid-season league start**

If the league is configured to begin at **NFL Week N** (not Week 1), copy and navigation should make that explicit (e.g. league home, rules): competition and pick history start at Week **N**; earlier NFL weeks are not part of this league. See **`_bmad-output/planning-artifacts/epics.md`** — Story 2.7.

**Test / rehearsal leagues**

Optional **test leagues** must be visually distinct (banner/chip) so participants do not mistake simulated or accelerated weeks for the real season. Deletion and cleanup are product/ops concerns documented in **Epic 8** in **`epics.md`**.

**No Offline Functionality Required**

Pick submission, validation, deadline enforcement, and standings access all require server connectivity and real-time data. No offline capability needed or designed—users must have network access to interact with the application.

### Effortless Interactions

**Real-Time Validation: Mistakes Prevented, Not Caught**

Validation must occur in real-time during pick selection, preventing invalid submissions rather than catching errors post-facto. Users should never be able to select a previously picked team, directly select the jailed team (without anti-jailed intention), or submit after deadline expiration.

Validation feedback must be immediate (synchronous client-side pre-validation), visually unmistakable (grayed-out unavailable teams, prominent jailed team indicators), and anxiety-reducing (users gain confidence that the system protects them from mistakes).

**Critical Validation Areas:**
- **Duplicate Team Prevention:** Previously picked teams grayed out and unselectable with clear "Already picked Week X" indication
- **Jailed Team Blocking:** Jailed team visually prominent with inline explanation, blocked from direct selection unless anti-jailed bonus explicitly chosen
- **Deadline Enforcement:** Pick submission disabled after deadline with clear "Deadline passed" messaging; no ambiguous edge cases

**Pick Status Clarity: Persistent Visual Confirmation**

After pick submission, users must see persistent, prominent confirmation of their current pick status. A green banner displaying "Your pick is submitted: Buffalo Bills, 1 point" should remain visible throughout the application until the next week's cycle begins.

This persistent status indicator eliminates the "Did I actually submit?" anxiety pervasive in email-based workflows where confirmation is ambiguous. Users should never need to navigate through multiple screens or recall past actions to verify pick status—it's always visible, always clear, always reassuring.

**Deadline Countdown: Always Visible Time Awareness**

The weekly pick deadline (Thursday ~8:10 PM EST or 5 minutes before first game of week) must be continuously visible through a countdown timer. Users should develop intuitive time awareness without manually tracking calendars or remembering deadlines.

As the deadline approaches, the countdown should increase in visual prominence—progressive urgency that alerts users without creating panic. Thursday afternoon should feel meaningfully different from Tuesday morning through contextual interface adjustments.

**Unified Information Architecture: Zero External Context Switching**

All decision-making information required for informed pick submission must exist within the single pick submission interface:
- Current week's NFL matchups with live moneyline odds
- Point spread data for each matchup
- Weather conditions and home team identification
- Current season standings (updated after Tuesday reveals)
- Personal pick history (all previously selected teams this season)
- Jailed team identification with inline explanation
- Anti-jailed bonus opportunity with point value clarification

Users should never need to open external tabs for betting odds sites, weather services, league standings, or personal pick tracking. Complete information consolidation eliminates the fragmented 6-tab workflow that defined the old system.

**Pick Modification: Unlimited, Anxiety-Free Changes**

Users must be able to modify their pick unlimited times before the weekly deadline without friction, confusion, or anxiety. Changing one's mind should feel completely natural—select different team, confirm update, see new pick status, done.

No multi-step confirmation flows, no warnings about "overwriting previous pick," no artificial friction discouraging strategic reconsideration. The interface should encourage rather than penalize thoughtful pick refinement over time.

**Authentication: Invisible for Active Users**

For participants engaging week-over-week, authentication should feel invisible through rolling session persistence and email deep links. Tuesday reminder email → click link → authenticated app → pick interface. No login screen, no password recall, no interruption to workflow.

Only inactive participants (30+ days no activity) or explicit logout actions trigger authentication requirements. For the core engaged user base, login becomes a "once at season start" experience rather than weekly friction.

### Critical Success Moments

**For Participants: First Pick Submission Success**

The moment a new participant completes their first successful pick submission establishes system trust and future engagement likelihood. This critical first experience encompasses:

1. Receiving email invitation from admin
2. Account creation (streamlined, minimal friction)
3. First exposure to pick submission interface
4. Immediate comprehension of what to do (no tutorial required)
5. Pick selection with validation feedback
6. Submission and unmistakable confirmation

Success at this first interaction predicts season-long engagement. Failure—confusion, uncertainty, validation errors—creates lasting friction and potential dropout.

**For Participants: "Everything in One Place" Realization**

The aha moment when participants realize that matchups, odds, weather, standings, and pick history exist unified in one interface rather than scattered across multiple tabs. This realization typically occurs during first or second week when users recognize they no longer need to open betting sites or check email screenshots for standings.

This moment transforms perception from "new system I need to learn" to "obviously better way to do this." The emotional shift from obligation to relief drives subsequent engagement and enthusiasm.

**For Admin: First Automated Tuesday Email**

Mike's critical success moment occurs the first Tuesday evening when the automated reminder email delivers successfully to all participants without any manual intervention. Seeing the system work as promised—jailed team calculated correctly, standings updated, personalized emails sent—validates the entire automation promise.

This moment marks the psychological transition from "doing the work" to "monitoring the system." The liberation from 2-3 hours of Tuesday evening spreadsheet management becomes tangible reality rather than theoretical promise.

**For Admin: First Complete Week Success**

The first complete weekly cycle—Tuesday email sent automatically, participants submit picks throughout the week, deadline enforced correctly, games resolve over weekend, scoring processes automatically, Monday Night Football completion triggers Tuesday standings update—establishes system reliability trust.

After this first complete cycle executes flawlessly, Mike gains confidence to "let go" and trust automation for the remaining 17 weeks. Any failure during this critical first week undermines seasonal trust and creates ongoing anxiety about system reliability.

**For League: Season Kickoff Week 1**

The collective success moment for the entire league occurs when Week 1 completes successfully with high participation rates, clear standings, and zero confusion or technical issues. This establishes league-wide social proof that the new system works and is better than the old way.

Early adopters become system advocates, inconsistent participants gain confidence to continue, and skeptics convert to supporters. Week 1 success creates momentum; Week 1 failure creates drag that persists throughout the season.

**Critical Failure Scenarios (Must Prevent):**

- **Pick submission unclear or failed:** User submits pick but receives no confirmation or ambiguous status
- **Validation failure:** System allows duplicate team pick or jailed team violation
- **Deadline enforcement failure:** Late pick accepted or early pick rejected inappropriately  
- **Tuesday email failure:** Automated email doesn't send or sends incorrectly
- **Incorrect jailed team:** System identifies wrong team as jailed, breaking trust in automation
- **Admin override confusion:** Mike uncertain whether override action succeeded or affected correct participant
- **League creation failure:** Setup process confusing or incomplete, preventing season start

### Experience Principles

**1. Pick Submission is Primary for Everyone**

The weekly pick submission workflow is the core action for all users, including the admin. Everything else—monitoring, standings, history—supports this primary interaction. Design must optimize for 60-90 second completion while accommodating multi-day strategic analysis through the same interface.

**2. Validation Prevents Mistakes Before They Happen**

Users should never be able to make an invalid pick. Real-time validation against duplicate teams, jailed team restrictions, and deadline enforcement must be immediate, clear, and unmistakable. Mistakes prevented are infinitely better than mistakes caught.

**3. Status Clarity Eliminates Anxiety**

Users should never wonder "Did I submit? What did I pick? When's the deadline?" Persistent visual indicators (green banners, countdowns, pick status) provide constant reassurance. Clarity over cleverness—state should be obvious at a glance.

**4. Unified Information Architecture Eliminates Friction**

All decision-making information co-located in single interface: matchups, odds, weather, home team identification, jailed team, standings, pick history, remaining options. No external tabs, no fragmented workflow, no context switching.

**5. Full Device Parity, No Compromises**

Identical functionality and information density on mobile and desktop. Touch and mouse/keyboard interactions both first-class. "Check desktop for full experience" is failure—every feature accessible everywhere.

**6. Rolling Activity-Based Sessions**

Active participants stay authenticated indefinitely through rolling 30-day timeout that resets with each interaction. Only inactive users (30 days no activity) require re-authentication. Convenience for engaged users, security for abandoned sessions.

**7. Email as Critical Communication Channel**

Tuesday automated emails are the primary engagement driver. Admin must have configuration control over content week-over-week before sending. Reminder emails (mid-week, deadline) keep inconsistent participants engaged. Email failure is catastrophic—requires monitoring and retry logic.

**8. Admin Automation with Visible Confidence**

Mike needs to "know it worked" without "doing the work." Monitoring dashboards, verification interfaces, and audit trails provide confidence that automation executed correctly. Invisible to participants, visible to admin.

**9. League Creation is the Foundation**

Without a league, nothing else matters. League creation and pre-season setup is the make-or-break foundational flow that must be bulletproof. Admin must feel confident and successful completing setup before Week 1.

**10. First-Time Success Builds Trust**

The first complete week—league created, emails sent, picks submitted, standings updated—establishes system trust. First-time participant success (invitation → signup → pick → confirmation) and first-time admin success (setup → automated Tuesday email → monitoring) are critical validation moments.

## Desired Emotional Response

### Primary Emotional Goals

**For League Administrator (Mike):**

1. **Liberation** - Freedom from the weekly grind of manual spreadsheet management, email composition, and odds research. Mike should feel his Tuesday evenings returned to him, experiencing genuine time liberation rather than just reduced workload. The transition from "doing work" to "monitoring systems" should feel emotionally significant—like a burden lifted rather than simply workflow optimization.

2. **Pride** - Satisfaction in delivering a modern, sophisticated experience to league participants. Mike should feel pride in solving a real problem and elevating the league's operations from "manual spreadsheet chaos" to "automated professional platform." This pride drives advocacy and seasonal renewal commitment.

3. **Confidence & Trust** - Deep trust that automation executes correctly without manual verification or intervention. Mike needs confidence that Tuesday emails send, jailed teams calculate accurately, deadlines enforce precisely, and scoring processes correctly—all without his active involvement. This confidence builds over the first few weeks and sustains throughout the season.

**For League Participants (All Segments):**

1. **Ease & Effortlessness** - The dominant feeling during pick submission should be "That was so simple, why wasn't it always like this?" Participants should experience flow state during the core 60-90 second workflow—information appears exactly when needed, validation prevents mistakes before they happen, confirmation eliminates doubt. Ease transforms obligation into ritual.

2. **Confidence & Peace of Mind** - Absolute certainty about pick status, deadline timing, and validation correctness. Participants should never wonder "Did I submit? What did I pick? When's the deadline? Did I accidentally pick the same team twice?" State clarity eliminates anxiety and builds trust in the system. Peace of mind comes from knowing mistakes are prevented, not just caught.

3. **Excitement** - Genuine enthusiasm for using the new system and participating in the weekly ritual. Excitement manifests at multiple levels: initial excitement discovering the unified interface (everything in one place!), weekly excitement returning for new matchups and standings updates, sustained excitement from competitive engagement and leaderboard positioning. The emotional shift from "chore" to "enjoyable tradition" defines success.

4. **Satisfaction & Accomplishment** - Fulfillment from completing the weekly pick efficiently and correctly. Participants should feel accomplished after submission—not just "task completed" but "I made an informed decision and executed it flawlessly." Time earned back creates satisfaction; knowing the pick is validated and counted correctly creates accomplishment.

### Emotional Journey Mapping

**Discovery Phase (First Exposure):**

**Participants:**
- **Curiosity & Intrigue** - "What's this new system? How does it work?"
- **Relief** - "Finally, a better way to do this than email and spreadsheet juggling"
- **Excitement** - "This looks so much better than the old way"
- **Cautious Optimism** - "Let's see if it actually works as promised"

**Admin:**
- **Hope** - "This might actually solve my burnout problem"
- **Cautious Optimism** - "Can it really automate everything I do manually?"
- **Excitement** - "If this works, I get my Tuesday nights back"

**Core Action Phase (During Pick Submission):**

**All Users:**
- **Flow State** - Effortless completion without friction or conscious thought
- **Confidence** - "I know exactly what to do and I'm doing it right"
- **Satisfaction** - "This is so much better than the fragmented old workflow"
- **Discovery Delight** - Noticing helpful features (weather data, validation, anti-jailed bonus visualization)

**Admin During Monitoring:**
- **Calm Assurance** - "Everything's running smoothly without my intervention"
- **Control** - "I can see what's happening without needing to do anything"
- **Relief** - "It's actually working as promised"

**Completion Phase (After Task Completion):**

**Participants After Pick Submission:**
- **Accomplished** - "Done for the week, and it was painless"
- **Confident** - "I know my pick is in, no lingering doubt or anxiety"
- **Free** - Time saved, can move on with day without mental burden
- **Relief** - No anxiety about whether submission worked or validation passed

**Admin After Tuesday Email Sends:**
- **Liberated** - "I didn't have to do anything and it worked perfectly"
- **Proud** - "I'm delivering a great experience to my league"
- **Excited** - "I got my Tuesday night back for the first time in years"
- **Relieved** - "The automation actually works"

**Error State (When Something Goes Wrong):**

**All Users:**
- **Informed, Not Confused** - Clear error messages explaining what happened and why
- **Supported, Not Abandoned** - Visible path to resolution (admin override for participants, fallback options for admin)
- **Trusting, Not Panicked** - Confidence that system has safeguards, audit trails, and recovery mechanisms
- **Confident Resolution Will Be Found** - Admin safety net provides reassurance that edge cases can be handled

**Admin During Errors:**
- **Empowered to Fix** - Override capabilities and audit trails enable issue resolution
- **Confident, Not Helpless** - Tools available to handle edge cases without reverting to manual processes

**Return Visit Phase (Week-Over-Week):**

**All Users:**
- **Familiarity** - "I know exactly what to do, this feels comfortable"
- **Anticipation** - Looking forward to the weekly ritual rather than dreading it
- **Ease** - "This never feels like a burden"
- **Excitement** - "What's new this week? Updated standings, new matchups, competitive positioning"

The emotional transformation from "weekly chore obligation" to "enjoyable weekly tradition" marks ultimate success.

### Micro-Emotions

**Confidence vs. Confusion (Critical Priority)**

Users must feel confident at every interaction point—pick selection, validation feedback, submission confirmation, deadline awareness, standings interpretation. Confusion at any stage undermines trust and creates friction. Design must eliminate ambiguity through clarity: obvious visual states, unmistakable feedback, persistent status indicators, intuitive information hierarchy.

**Trust vs. Skepticism (Critical for Admin)**

Mike's trust in automation reliability determines product success. First few weeks represent critical trust-building period—one major failure (missed email, incorrect jailed team, scoring error) creates lasting skepticism that undermines the entire automation value proposition. Trust builds through verified correctness, transparent calculations, visible audit trails, and successful weekly cycles.

**Excitement vs. Anxiety (Rebalancing Required)**

Current emotional state for participants includes anxiety about fragmented workflow, unclear submission status, and potential mistakes. Pick Six must eliminate anxiety (through validation and state clarity) while introducing excitement (through unified experience, competitive engagement, and weekly ritual enjoyment). The rebalancing from anxiety-dominant to excitement-dominant defines the emotional transformation.

**Accomplishment vs. Frustration (Every Interaction)**

Every pick submission should feel like an accomplishment—informed decision made, validated pick submitted, clear confirmation received—rather than frustration from friction, confusion, or uncertainty. Flow state during 60-90 second workflow creates accomplishment; obstacles or ambiguity create frustration. Design must optimize for effortless completion and unmistakable success feedback.

**Delight vs. Satisfaction (Layered Goals)**

Satisfaction from effortless completion represents baseline success. Delight from discovering helpful features (weather data integration, anti-jailed bonus visualization, contextual intelligence, competitive positioning insights) represents aspirational success. Both valuable—satisfaction ensures retention, delight drives advocacy.

**Belonging vs. Isolation (Community Connection)**

Tuesday standings reveal creates belonging through transparent competition—participants see everyone's picks, understand competitive positioning, feel connected to league community. Leaderboard visibility, historical performance tracking, and pick transparency build social connection. Design should emphasize community engagement without creating exclusion anxiety for lower-ranked participants.

**Peace of Mind vs. Doubt (State Clarity)**

Persistent doubt about submission status ("Did I actually submit? What if it didn't work?") undermines experience and creates mental burden. Peace of mind comes from unmistakable state clarity—green confirmation banner showing "Your pick is submitted: Buffalo Bills" remains visible throughout application, eliminating need to remember or verify. Design must make current state obvious at a glance.

### Design Implications

**Liberation (Admin) → Automation Visibility Without Action Requirement**

Mike needs monitoring dashboards showing "what happened automatically" without requiring action or manual verification. Design approach: timestamped activity logs showing automated emails sent, jailed team calculations completed, scoring updates processed. Passive visibility pattern: "Last action: Tuesday email sent to 14 participants at 6:00 PM" creates confidence without imposing obligation. Admin can verify if desired but shouldn't feel compelled to verify routinely.

**Confidence (All Users) → Persistent State Indicators**

Eliminate anxiety through constant state visibility. Design approach: green banner showing "Your pick is submitted: Buffalo Bills" (avoiding point reference until outcome determined) remains visible throughout app. Deadline countdown always visible with progressive prominence as Thursday approaches. Real-time validation preventing mistakes before submission (grayed-out previously picked teams, blocked jailed team selection). Every page load should immediately answer: "What's my current pick status?"

**Excitement (First Use) → Immediate Value Demonstration**

First login must demonstrate unified information architecture advantage instantly. Design approach: matchups, odds, weather, standings, pick history, jailed team identification all visible in single cohesive interface. Visual contrast to old fragmented workflow (multiple tabs, external betting sites, email screenshots) should be immediately obvious. "Wow, everything I need is here" moment drives initial excitement and sets expectation for continued ease.

**Peace of Mind → Unmistakable Feedback**

Users should never question whether an action succeeded. Design approach: pick submission triggers large, clear confirmation banner with team name and status. Critical actions generate email confirmations (pick submitted, deadline reminder sent). No ambiguous states—every action produces definitive success or failure feedback with clear next steps. Prefer obvious over subtle, clarity over sophistication.

**Trust (Admin) → Verification Interfaces + Override Capabilities**

Mike needs ability to verify automated calculations while trusting they're correct by default. Design approach: admin can view jailed team calculation logic (odds data, tie-breaker cascade), scoring breakdown details, email delivery confirmations. Override capabilities prove system has safeguards when edge cases arise—Mike can submit picks on behalf of participants, modify picks post-deadline, configure email content. Audit trails showing complete action history build trust through transparency and accountability.

**Ease/Effortlessness → Information Hierarchy + Progressive Disclosure**

Enable 60-90 second workflow without forcing simplification for engaged users. Design approach: critical information (current pick status, deadline countdown, jailed team) always visible above fold. Matchups with odds, weather, home team identification immediately scannable. Secondary information (detailed pick history, rules reference, admin audit trails) available via clear navigation but not cluttering primary view. Fast path for Tom, rich exploration for Sarah, same interface.

**Relief (Error States) → Clear Guidance + Admin Safety Net**

When errors occur, users need path to resolution without panic. Design approach: error messages explain what happened and specific next steps ("Your pick wasn't submitted because the deadline passed. Contact admin for assistance"). Participants know admin can override/fix issues through visible support mechanism. Admin has CSV export as ultimate failsafe if catastrophic system failure requires manual league management continuation.

**Accomplishment → Visual Celebration of Success**

Pick submission success should feel rewarding. Design approach: green confirmation banner with checkmark icon and positive language ("Pick submitted successfully!"). Tuesday standings update highlights point gains, leaderboard movement, weekly winners. Weekly completion feels celebratory rather than merely transactional. Positive reinforcement encourages continued engagement.

**Excitement (Weekly Return) → Contextual Freshness**

Tuesday reveals should feel like "new episode drops" rather than "same interface again." Design approach: updated standings with highlighted changes, new week's matchups, fresh weather data, competitive positioning insights. Interface adapts to day of week—Tuesday emphasizes standings reveal, Thursday emphasizes deadline urgency. Dynamic content maintains novelty and excitement across 18-week season.

### Emotional Design Principles

**1. Clarity Creates Confidence**

Ambiguity breeds anxiety. Every design decision should prioritize clarity over cleverness—obvious states, unmistakable feedback, persistent indicators, intuitive hierarchy. Users should never wonder about status, deadline, validation, or outcome. Clear communication builds confidence; confusion undermines trust.

**2. Validation Prevents, Not Corrects**

Catching mistakes after submission creates frustration and doubt. Preventing mistakes before submission creates confidence and flow. Real-time validation, grayed-out unavailable options, blocked invalid selections—design should make mistakes impossible rather than detectable.

**3. Time Earned is Value Delivered**

Respect for user time differentiates Pick Six from competitors and the old manual workflow. 60-90 second completion target isn't just efficiency—it's emotional communication that "we value your time and won't waste it." Every second saved compounds across 14 participants over 18 weeks into meaningful life minutes returned.

**4. Automation Should Feel Invisible (Except to Admin)**

Participants shouldn't think about automation—it should just work transparently. Admin needs visibility into automation (monitoring dashboards, verification interfaces) but shouldn't require manual intervention. The best automation is the automation users forget exists because it never fails.

**5. Celebration Over Transaction**

Pick submission, standings updates, point gains, leaderboard movement—these should feel celebratory rather than merely informational. Positive reinforcement, visual highlights, accomplishment language transform data updates into emotional moments that sustain engagement.

**6. Community Through Transparency**

Tuesday standings reveal creates community connection by showing everyone's picks, outcomes, and competitive positioning. Transparency builds belonging—participants feel part of shared experience rather than isolated actors. Design should emphasize community while avoiding exclusion anxiety for lower-ranked participants.

**7. First Impressions Build Lasting Trust**

First successful pick submission for participants and first automated Tuesday email for admin establish trust that sustains throughout season. Design must ensure these critical first experiences succeed flawlessly—confusion or failure at first exposure creates lasting skepticism. Get Week 1 right, earn trust for Weeks 2-18.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Sleeper (Fantasy Football Platform)**

Sleeper represents best-in-class fantasy football UX through visual appeal combined with minimal-click navigation. Users describe it as "visually pleasing" with "simple UX" that makes returning to the app enjoyable rather than merely functional. The application excels at immediate context preservation—jumping users directly to their last-used league rather than forcing navigation from a generic homepage every session.

**Core UX Strengths:**
- **Tab-Based Navigation:** All main functionality organized into bottom tabs (mobile) or top tabs (desktop), keeping core features always within reach without menu drilling
- **Minimal Clicks Philosophy:** Everything accessible within 2-3 taps maximum, reducing friction in weekly workflows
- **Gesture Support:** Swipe-based navigation between screens and dismissal of overlays feels natural and fast on mobile
- **Full-Screen Detail Views:** Player information accessible via full-screen overlays with easy exit, balancing information depth with navigation simplicity
- **Visual Design Quality:** Clean, modern interface makes weekly engagement feel enjoyable rather than obligatory

**What Creates Stickiness:**
Visual pleasure combined with predictable structure means users know exactly where things are and enjoy returning. Speed through minimal navigation depth reduces weekly friction, transforming routine tasks into satisfying rituals.

**Bet365 (Sports Betting Platform)**

Bet365 exemplifies functional excellence through organizational clarity. Users note it's "not visually popping" but "easy to find everything" and "well organized"—functional design creating trust and return usage through speed and predictability. The application succeeds by prioritizing information findability over aesthetic sophistication.

**Core UX Strengths:**
- **Clear Information Hierarchy:** Hierarchical organization from broad (sport/league) to specific (bet types, individual lines) enables quick drilling to desired information
- **Tab-Based Bet Organization:** Bet types organized into tabs with "main lines always shown first" smart prioritization
- **Predictable Structure:** Consistency across all sports/leagues means users develop muscle memory for finding specific odds quickly
- **Functional Over Decorative:** Minimal unnecessary motion or visual flourishes that would slow page loads or distract from information consumption
- **Speed Through Familiarity:** Users return "because I know where to find the odds I need quickly"—predictability trumps novelty

**What Creates Stickiness:**
Trust built through functional excellence rather than visual delight. Users develop confidence that information will be exactly where expected, making Bet365 the go-to despite lack of visual sophistication. Proves that "easy to navigate even if not pretty" creates strong retention.

### Transferable UX Patterns

**Navigation Patterns for Pick Six:**

**Tab-Based Core Navigation (Sleeper Pattern)**

Organize Pick Six's participant interface using persistent tabs accessible from any view:
- **Current Week:** Default tab showing matchups, odds, weather, pick submission
- **Standings:** Current leaderboard, updated after Tuesday reveals
- **History:** Personal pick history, season performance tracking
- **Rules/Help:** League rules reference, jailed team explanation, FAQ

Admin users see additional **Admin** tab when logged in with league administrator privileges, enabling seamless role-switching without separate admin portal navigation.

**Benefits:** Keeps all core functions within one tap/click (minimal navigation depth), works identically on mobile (bottom tab bar) and desktop (top tabs), reduces cognitive load through constant visibility of available functions.

**Context Preservation (Sleeper Pattern)**

Return users directly to most relevant view based on context:
- **During active week (Tuesday-Thursday):** Land on Current Week tab showing pick submission interface
- **After Tuesday reveal:** Land on Standings tab showing updated leaderboard
- **Email deep links:** Route directly to relevant interface (pick submission, standings view) without forcing navigation from homepage

**Benefits:** Eliminates navigation friction from every session, respects user time by showing most relevant content immediately, email reminders land users exactly where they need to take action.

**Progressive Information Hierarchy (Bet365 Pattern Adapted)**

Primary information always visible above fold, secondary information accessible via clear navigation:
- **Primary (always visible):** Current pick status, deadline countdown, jailed team identification, this week's matchups with odds
- **Secondary (one tap away):** Detailed matchup analysis (weather, home team, spread), historical pick performance, admin monitoring tools
- **Tertiary (two taps away):** Complete pick history archives, rule reference documentation, admin audit trails

**Benefits:** Enables 60-90 second pick workflow for casual users (Tom) while supporting multi-day strategic analysis for engaged users (Sarah) through same interface—progressive disclosure rather than feature removal.

**Interaction Patterns for Pick Six:**

**Minimal Clicks to Core Action (Both Apps)**

Optimize primary user flow for absolute minimal tap/click count:
- **Email reminder → Authenticated app → Matchups visible → Team selection → Submit confirmation:** 3-4 taps maximum on mobile
- **Critical path must never require menu navigation, multiple screen loads, or hidden controls**

Sleeper achieves "everything within reach" through tab navigation; Bet365 achieves "main lines always first" through smart prioritization. Pick Six combines both: tab navigation keeps functions reachable, smart prioritization ensures pick submission path is shortest.

**Full-Screen Detail Overlays (Sleeper Pattern)**

When deeper information needed (matchup analysis, weather conditions, historical picks), show full-screen detail view with clear exit mechanism:
- **Tap matchup card** → Full-screen overlay showing comprehensive game context (weather, home team, recent performance, spread, over/under)
- **Swipe down or tap back** → Dismiss overlay, return to matchup list
- **Keyboard ESC** → Desktop equivalent for overlay dismissal

**Benefits:** Provides information depth for engaged users without cluttering primary interface for casual users. Gesture-based dismissal feels fast and natural on mobile.

**Gestural Navigation Enhancement (Sleeper Pattern Adapted)**

Support natural gesture-based navigation on touch devices while maintaining mouse/keyboard alternatives:
- **Swipe left/right between tabs** (Current Week ↔ Standings ↔ History)
- **Swipe down to dismiss detail overlays** (matchup details, pick history)
- **Pull-to-refresh for standings updates** (standard mobile pattern)

All gestures must have visible button/navigation alternatives for desktop users and accessibility compliance.

**Visual Design Patterns for Pick Six:**

**Visual Appeal Creates Enjoyment (Sleeper Principle)**

Users describe Sleeper as "visually pleasing" with "simple UX"—visual quality makes returning enjoyable rather than merely functional. Pick Six must prioritize visual design quality to transform weekly obligation into enjoyable ritual.

**Design Implications:**
- Clean typography with intentional hierarchy (headings, body, captions clearly distinct)
- Purposeful color use (green for success/confirmation, yellow/orange for deadline urgency, subtle gray for unavailable teams)
- Smooth micro-animations for state transitions (pick submission, tab switching, overlay appearance)
- Generous whitespace preventing visual clutter despite information density

**Functional Clarity Over Pure Aesthetics (Bet365 Principle)**

Bet365 succeeds despite being "not visually popping" because functional organization trumps decorative sophistication. When trade-offs arise between visual sophistication and functional clarity, choose clarity.

**Design Implications:**
- Clear information hierarchy over visual experimentation
- Obvious interactive elements (buttons look like buttons, tabs clearly indicate selection state)
- Minimal decorative elements that don't support understanding or interaction
- "Easy to use" takes precedence over "beautiful but confusing"

**Smart Information Prioritization (Bet365 "Main Lines First" Pattern)**

Bet365 organizes thousands of betting options by always showing "main lines first"—most commonly needed information gets primary visibility. Pick Six applies this through:
- **Current pick status always visible** (persistent banner at top)
- **Deadline countdown prominent** (increases visibility as Thursday approaches)
- **Jailed team identification above fold** (critical validation information)
- **Matchups sorted by game time** (earliest games first for deadline awareness)

### Anti-Patterns to Avoid

**Hidden Navigation for Core Functions**

Fantasy platforms that hide primary functions behind hamburger menus create unnecessary friction. Sleeper succeeds specifically because "everything within reach" through persistent tab bar—no menu drilling required for core workflows.

**Application to Pick Six:** Never hide Current Week, Standings, History, or Admin functions behind hamburger menu. Tab-based navigation keeps all core functions constantly accessible. Hamburger menus acceptable only for truly secondary functions (account settings, logout).

**Multi-Step Confirmation Flows**

Apps that require "Are you sure?" prompts for non-destructive actions create confirmation fatigue and friction. Sleeper enables quick roster moves without excessive confirmation; Bet365 allows bet slip modifications freely.

**Application to Pick Six:** Changing picks before deadline requires no confirmation prompt—just update and show new pick status. Only destructive or post-deadline actions (admin overrides, final submission after modification) warrant confirmation. Unlimited pick modification goal conflicts with confirmation friction.

**Auto-Playing Media or Excessive Animation**

Both Sleeper and Bet365 avoid unnecessary motion that slows page loads or distracts from information consumption. Animation supports interaction (transitions, feedback) rather than decorating.

**Application to Pick Six:** No auto-playing content, no decorative animations delaying time-to-interactive. Micro-animations for state changes (pick submission success, tab transitions) acceptable if they enhance perceived responsiveness. Must not conflict with 60-90 second completion target.

**Requiring Account Creation Before Showing Value**

Some fantasy platforms hide league information until full signup completion, preventing evaluation of value proposition before commitment.

**Application to Pick Six:** Participants invited via admin email should see clear league context (league name, current standings snapshot, rules summary) during signup flow. Show what they're joining before forcing account creation. Reduce perceived risk of commitment.

**Desktop-Only Features or Compromised Mobile Experiences**

Both Sleeper and Bet365 provide full functionality on mobile without "view on desktop for full experience" compromises.

**Application to Pick Six:** Directly conflicts with full device parity requirement documented in core experience principles. Every feature—admin monitoring, pick submission, standings analysis, history review—must work identically on mobile and desktop. No exceptions.

**Unclear Information Hierarchy**

Betting sites that bury main lines under multiple clicks fail at Bet365's core strength: predictable information location enabling speed.

**Application to Pick Six:** Critical information (jailed team, deadline, current pick status, this week's matchups) must be immediately visible without drilling. Secondary information (detailed history, rules reference, admin audit trails) can require navigation but primary path must be obvious.

### Design Inspiration Strategy

**Adopt Directly:**

1. **Tab-Based Navigation (Sleeper)** - Implement persistent tab bar (mobile bottom, desktop top) organizing core functions: Current Week | Standings | History | Rules/Help | Admin (when applicable). Keeps all primary functions accessible without menu drilling, works identically across devices.

2. **Context Preservation (Sleeper)** - Return users to most relevant view based on context (active week = pick submission, post-Tuesday = standings). Email deep links route directly to action interfaces, not generic homepage.

3. **Visual Design Priority (Sleeper)** - Invest in visual appeal quality (typography, color, spacing, micro-animations) to transform weekly obligation into enjoyable ritual. Visual pleasure creates engagement beyond functional necessity.

4. **Information Hierarchy Clarity (Bet365)** - Ensure critical information (jailed team, deadline, pick status) visible above fold without scrolling. Users should find essential context instantly.

5. **"Main Lines First" Prioritization (Bet365)** - Show most commonly needed information with primary prominence: current pick status banner persistent, deadline countdown always visible, matchups sorted by game time for deadline awareness.

**Adapt with Modifications:**

1. **Gesture-Based Navigation (Sleeper)** - Support swipe between tabs and swipe-to-dismiss overlays on mobile, but ensure visible button alternatives exist for desktop users and accessibility compliance. Gestures enhance mobile experience but can't be exclusive interaction method.

2. **Hierarchical Information Drilling (Bet365)** - Simplify hierarchy for Pick Six's narrower scope. Bet365 needs deep hierarchy (sport → league → bet type → game) for thousands of options. Pick Six needs shallow hierarchy (current week → matchup detail) with most information visible at top level.

3. **Full-Screen Detail Views (Sleeper)** - Implement for matchup analysis (weather, spread, context) but ensure overlays are optional enhancements rather than required navigation. Casual users should complete picks without ever opening detail overlays.

**Avoid Explicitly:**

1. **Hamburger Menus for Core Navigation** - Conflicts with "everything within reach" and minimal-clicks goals
2. **Multi-Step Confirmation Prompts** - Conflicts with unlimited pick modification goal and effortless completion target
3. **Desktop-Only Features** - Conflicts with full device parity requirement
4. **Unclear Visual Hierarchy** - Both inspiring apps succeed through organization clarity
5. **Excessive Animation or Auto-Play Content** - Conflicts with 60-90 second completion target

**Keep Unique to Pick Six:**

1. **Persistent Pick Status Banner** - Neither Sleeper nor Bet365 require prominent "submission confirmation" visibility. Pick Six's anxiety-reduction goal demands persistent "Your pick is submitted: Buffalo Bills" banner visible throughout app.

2. **Admin Dual-Role Interface** - Neither app handles admin-as-participant role. Pick Six needs seamless role switching via Admin tab that appears only for league administrators, enabling Mike to participate as full league member while maintaining oversight capabilities.

3. **Jailed Team Visual Prominence** - Unique mechanic requiring unique visual treatment. Neither Sleeper nor Bet365 have analogous "blocked selection with bonus alternative" concept. Pick Six must create clear visual language (color, iconography, inline explanation) for jailed team identification and anti-jailed bonus opportunity.

## Design System Foundation

### Design System Choice

**Material-UI (MUI)** serves as the design system foundation for Pick Six, providing a comprehensive React component library with robust theming capabilities and Next.js integration. MUI balances rapid development velocity through proven components with visual customization flexibility through its sophisticated theming system.

The selection prioritizes speed-to-MVP (May 2026 target) while maintaining design quality aspirations inspired by Sleeper's visually pleasing interface. MUI's mature ecosystem, accessibility defaults, and responsive design utilities align with Pick Six's technical requirements: solo development context, Next.js framework, full mobile-desktop parity, and WCAG Level A compliance baseline.

### Rationale for Selection

**Development Velocity for Solo Developer Context**

Solo development with simultaneous Next.js learning requires maximizing productivity through proven components rather than building UI primitives from scratch. MUI provides comprehensive component coverage (navigation tabs, forms, modals, cards, buttons, alerts) enabling focus on unique pick'em business logic rather than reinventing common UI patterns. The mature documentation and large community support reduce friction during learning curve, critical for hitting May 2026 MVP deadline.

**Theming Control for Visual Identity**

MUI's theming system provides complete control over visual identity without sacrificing development speed. Theme customization encompasses color palette definition (primary, secondary, success, warning, error), typography system (font families, sizes, weights, line heights), spacing scale, border radius, shadows, and breakpoints. Component-level style overrides enable unique visual treatments for Pick Six-specific elements (jailed team indicators, pick status banners, anti-jailed bonus visualization) while maintaining MUI's accessibility and responsive behavior foundations.

This theming flexibility enables Sleeper-inspired visual appeal—clean, modern interface with intentional color use and generous whitespace—without requiring custom component development for standard UI patterns.

**Responsive Design Foundation Supporting Device Parity**

MUI's built-in responsive utilities and breakpoint system directly support Pick Six's "full device parity, no compromises" requirement. Grid layouts, responsive spacing, device-specific component variants, and mobile-optimized navigation patterns (bottom tabs for mobile, top tabs for desktop) handle complex responsive scenarios common in sports/fantasy applications where information density varies dramatically between devices.

The component library includes mobile-first patterns (swipeable drawers, bottom navigation, responsive dialogs) that align with Sleeper and Bet365 inspiration patterns while maintaining desktop-class functionality on larger screens.

**Next.js Ecosystem Integration**

MUI provides official Next.js integration documentation, example projects, and SSR support patterns. The integration handles critical Next.js considerations: CSS injection order, theme persistence across client/server rendering, hydration mismatch prevention, and tree-shaking for production bundle optimization. This documented integration path reduces implementation risk for developer learning Next.js simultaneously with production application development.

**Accessibility Defaults Meeting Compliance Baseline**

MUI components ship with WCAG-compliant accessibility implementations: keyboard navigation, ARIA labels, focus management, color contrast, screen reader support. These defaults align with Pick Six's WCAG Level A compliance target for the private league context (technically comfortable users, not requiring advanced assistive technology support). Starting from accessible foundation reduces compliance implementation burden compared to custom component development.

**Component Library Coverage for Standard Patterns**

MUI's comprehensive component library covers all standard UI patterns identified in Pick Six requirements:
- **Navigation:** Tabs (Sleeper pattern), bottom navigation (mobile), app bar (desktop)
- **Layout:** Grid, Stack, Container (responsive patterns)
- **Forms:** TextField, Select, Checkbox, Radio (pick submission, admin config)
- **Feedback:** Alert, Snackbar, Dialog (confirmations, errors, status)
- **Data Display:** Card, Table, List (matchups, standings, history)
- **Indicators:** Badge, Chip, Progress (deadline countdown, pick status)

This coverage means custom component development focuses exclusively on unique pick'em mechanics (jailed team visualization, pick submission workflow, admin monitoring dashboard) rather than rebuilding common UI patterns.

### Implementation Approach

**Phase 1: Theme Configuration and Design Tokens**

Initialize MUI theme with Pick Six visual identity:

**Color Palette Definition:**
- **Primary:** Brand color for buttons, links, tab selection, active states
- **Secondary:** Accent color for anti-jailed bonus opportunities, special callouts
- **Success/Green:** Pick submission confirmations, point gains, correct predictions
- **Warning/Orange-Yellow:** Deadline urgency, important notices, jailed team indicators
- **Error/Red:** Validation failures, incorrect predictions, critical alerts
- **Neutral Grays:** Background layers, disabled states, borders, unavailable teams

**Typography System:**
- **Font Families:** Primary font for headings, secondary for body text, monospace for numbers/stats
- **Type Scale:** Hierarchical sizing (h1-h6 for structure, body1-body2 for content, caption for metadata)
- **Font Weights:** Regular, medium, bold for emphasis hierarchy
- **Line Heights:** Optimized for readability across mobile and desktop contexts

**Spacing Scale:**
- Consistent spacing units (4px base grid) for vertical rhythm, component padding, margins
- Responsive spacing adjustments for mobile density optimization

**Breakpoints:**
- Mobile: 320px-767px (optimize for touch, single column)
- Tablet: 768px-1023px (transitional layouts)
- Desktop: 1024px+ (multi-column, hover states, expanded information)

**Phase 2: Component Usage Strategy**

**Adopt MUI Components Directly:**
- **Tabs:** Participant interface navigation (Current Week | Standings | History | Rules/Help | Admin)
- **BottomNavigation:** Mobile tab bar implementation
- **Card:** Matchup display containers, standing entries, history cards
- **TextField/Select:** Pick selection, admin email configuration
- **Button:** Primary actions (submit pick, change selection), secondary actions (view details)
- **Dialog/Modal:** Full-screen overlays for matchup details, confirmation prompts
- **Alert:** Pick status banner, error messages, validation feedback
- **Chip/Badge:** Jailed team indicators, point values, notification counts
- **Grid/Stack:** Responsive layouts for matchup lists, standings tables
- **AppBar:** Desktop top navigation, admin header

**Build Custom Components Using MUI Primitives:**
- **Jailed Team Indicator:** Custom styled component using MUI Box/Paper with theme colors, incorporating inline explanation tooltip
- **Pick Status Banner:** Persistent banner using MUI Alert base with custom styling for prominence
- **Matchup Card:** Custom layout combining MUI Card with Grid for odds, weather, team names, responsive to device width
- **Admin Dashboard:** Custom monitoring interface using MUI Table/Grid with role-specific visibility
- **Deadline Countdown:** Custom component using MUI Typography with dynamic color/size based on urgency
- **Weather Display:** Custom icon + text component integrated into matchup cards
- **Anti-Jailed Bonus Option:** Custom selection component highlighting 2-point opportunity with distinct visual treatment

**Phase 3: Responsive Pattern Implementation**

**Mobile Optimization (320px-767px):**
- Bottom navigation for core tabs (persistent, thumb-reachable)
- Single-column matchup cards with stacked information
- Full-screen dialogs for detail overlays (swipe-to-dismiss)
- Touch-optimized tap targets (44px minimum)
- Collapsed admin functions into accessible drawer

**Desktop Enhancement (1024px+):**
- Top tab navigation with hover states
- Multi-column layouts for standings and history
- Inline overlays for matchup details (modal dialogs rather than full-screen)
- Mouse-optimized interactions (hover states, tooltips)
- Side-by-side admin monitoring dashboard

**Device Parity Enforcement:**
- All functionality available on both mobile and desktop
- Information density adjusted but feature completeness maintained
- Responsive utilities handle layout without removing capabilities

### Customization Strategy

**Heavy Customization Areas:**

**Visual Identity (Theme Layer)**
- Custom color palette diverging from Material Design defaults (no default blue/pink)
- Brand-specific typography choices for personality and hierarchy
- Spacing adjustments for information density balance (sports apps typically denser than Material defaults)
- Border radius, shadows, elevation scale customized for visual style

**Component Variants for Unique States**
- **Jailed Team State:** Custom card variant with warning colors, blocked interaction state, inline explanation
- **Anti-Jailed Bonus Option:** Distinct visual treatment highlighting 2-point opportunity (color, outline, iconography)
- **Submitted Pick State:** Green confirmation styling with persistent visibility treatment
- **Deadline Urgency States:** Progressive visual prominence as Thursday deadline approaches (color, size, animation)
- **Admin Role Indicator:** Visual cue showing when administrator is in admin view vs. participant view

**Pick'em-Specific Custom Components**
- **Pick Submission Flow:** Multi-step component managing team selection, validation feedback, confirmation
- **Jailed Team Explanation Tooltip:** Context-sensitive education for new participants
- **Admin Override Interface:** Custom form handling pick submission on behalf of participants
- **Email Configuration Editor:** Rich text or structured editor for Tuesday reminder customization
- **Monitoring Dashboard:** Admin-only view showing submission status, pick distribution, override audit trail

**Moderate Customization (MUI Base + Style Overrides):**

**Navigation Patterns**
- Tab component styling to match Sleeper-inspired visual appeal (custom active states, transitions)
- Bottom navigation customization for mobile thumb zones
- Responsive breakpoints for navigation pattern switching (bottom → top)

**Matchup Display Cards**
- Card component layout customization for odds, weather, team identification
- Responsive card sizing and information hierarchy adjustments
- Interactive states (tap for detail, selection feedback)

**Form Components**
- Input field styling for pick selection interface
- Validation feedback styling (real-time duplicate team prevention, jailed team blocking)
- Error states and success confirmations customized to Pick Six visual language

**Minimal Customization (Use MUI Defaults):**

**Standard Interactive Elements**
- Buttons (primary, secondary, text variants) with theme colors
- Form inputs for admin configuration
- Modals/dialogs for confirmations and detail overlays
- Alerts for system messages and notifications
- Progress indicators and loading states

**Layout Primitives**
- Grid system for responsive layouts
- Stack components for vertical/horizontal arrangements
- Container for max-width content areas
- Box for generic layout containers

**Data Display Components**
- Tables for standings and history (with theme styling)
- Lists for notifications or activity feeds
- Typography components for text hierarchy

**Integration with Inspiration Patterns:**

**Sleeper Patterns via MUI:**
- Tab navigation: MUI Tabs component with custom theme styling
- Visual appeal: Theme customization for clean, modern aesthetic
- Gesture support: MUI SwipeableDrawer for mobile navigation
- Full-screen details: MUI Dialog with fullScreen prop for mobile

**Bet365 Patterns via MUI:**
- Information hierarchy: MUI Grid/Stack for "main lines first" prioritization
- Organized drilling: MUI Accordion or nested Cards for secondary information
- Functional clarity: MUI Typography system for clear content hierarchy
- Predictable structure: Consistent MUI component usage patterns

**Pick Six Unique Requirements:**
- Persistent pick status: Custom Alert-based banner with theme integration
- Admin dual-role: Custom tab system with MUI Tabs + conditional rendering
- Jailed team prominence: Custom component using MUI Box/Paper with theme colors and tooltips
- Deadline countdown: Custom Typography-based component with dynamic theming

## Visual Design Foundation

### Color System

**Design Philosophy: Premium Dark Mode Sports Experience**

Pick Six uses a permanent dark mode interface with emerald green primary actions and gold/amber accent for special opportunities. This palette creates a premium, modern sports app feel inspired by Sleeper's dark interface while establishing Pick Six's unique visual identity. The dark foundation reduces eye strain during evening usage (Tuesday email engagement, Thursday deadline submissions) and provides strong contrast for critical information elements.

**Background Palette (Dark Mode - Permanent):**

| Token | Hex | Usage |
|-------|-----|-------|
| `background.default` | `#121212` | Primary app background, page canvas |
| `background.paper` | `#1E1E1E` | Card surfaces, matchup cards, elevated containers |
| `background.elevated` | `#2A2A2A` | Hover states, selected cards, modal backgrounds |
| `background.overlay` | `#333333` | Tooltips, dropdown menus, popover surfaces |

**Primary Action Color (Emerald Green):**

| Token | Hex | Usage |
|-------|-----|-------|
| `primary.main` | `#2ECC71` | Primary buttons, active tab indicators, links |
| `primary.light` | `#58D68D` | Hover states, light emphasis |
| `primary.dark` | `#27AE60` | Pressed states, dark emphasis |
| `primary.contrast` | `#FFFFFF` | Text on primary buttons |

The emerald green serves as the primary action color across the entire application: submit buttons, active navigation states, links, toggle indicators, and positive interactive elements. Its vibrancy against the charcoal background creates clear visual hierarchy for actionable elements.

**Semantic Colors:**

| Token | Hex | Usage |
|-------|-----|-------|
| `success.main` | `#2ECC71` | Pick confirmation banner, correct predictions, point gains |
| `success.light` | `#58D68D` | Success banner backgrounds (with opacity) |
| `warning.main` | `#F5A623` | Deadline urgency, jailed team indicators, caution states |
| `warning.light` | `#F7C258` | Warning banner backgrounds |
| `error.main` | `#EF5350` | Validation errors, incorrect predictions, critical alerts |
| `error.light` | `#EF9A9A` | Error banner backgrounds |
| `info.main` | `#42A5F5` | Informational tooltips, help text, neutral notifications |

**Accent Color (Gold/Amber - Anti-Jailed Bonus):**

| Token | Hex | Usage |
|-------|-----|-------|
| `accent.gold` | `#FFD700` | Anti-jailed "2 POINTS" badge, bonus opportunity highlights |
| `accent.goldLight` | `#FFE44D` | Gold hover states, bonus emphasis |
| `accent.goldDark` | `#E5C100` | Gold pressed states |

The gold/amber accent color is reserved exclusively for the anti-jailed bonus opportunity, creating a distinct "special" visual treatment that differentiates the 2-point opportunity from standard 1-point picks. Gold communicates premium value and reward, making the bonus feel like a strategic opportunity worth attention.

**Text Colors (On Dark Backgrounds):**

| Token | Hex/Opacity | Usage |
|-------|-------------|-------|
| `text.primary` | `#FFFFFF` at 87% (`rgba(255,255,255,0.87)`) | Primary content, headings, team names |
| `text.secondary` | `#FFFFFF` at 60% (`rgba(255,255,255,0.60)`) | Secondary content, labels, metadata |
| `text.disabled` | `#FFFFFF` at 38% (`rgba(255,255,255,0.38)`) | Disabled states, unavailable teams, muted info |
| `text.hint` | `#FFFFFF` at 30% (`rgba(255,255,255,0.30)`) | Placeholder text, subtle hints |

**Jailed Team Visual Treatment:**

| Element | Color | Treatment |
|---------|-------|-----------|
| Jailed team card border | `warning.main` (`#F5A623`) | 2px solid border in warning amber |
| "JAILED" tag | `warning.main` on `background.paper` | Bold tag overlay on team logo |
| Jailed team logo | 50% desaturation | Grayed but recognizable |
| Jailed team text | `text.disabled` | Dimmed team name |

**Already-Picked Team Visual Treatment:**

| Element | Color | Treatment |
|---------|-------|-----------|
| Picked team card | `background.paper` (no border highlight) | Subtle, receded visual state |
| Picked team logo | 70% desaturation | Clearly unavailable |
| "PICKED WK X" tag | `text.disabled` | Small overlay on team logo |
| Picked team text | `text.disabled` | Dimmed team name |

**Landing Page Visual Treatment:**

The landing page uses the primary charcoal background (`#121212`) with a live-action football stock photo as a foreground element. The photo uses a gradient overlay fading from transparent at center to charcoal at edges, maintaining the dark background while showcasing dynamic football imagery. The emerald green CTA button ("Join Your League" / "Make Your Pick") provides strong contrast against both the dark background and photo elements.

**Photo Integration Strategy:**
- High-quality action football photography (players in motion, game atmosphere)
- Dark gradient overlay: `linear-gradient(to bottom, rgba(18,18,18,0.3), rgba(18,18,18,0.95))` preserving dark aesthetic
- Photo positioned as hero section background or foreground element
- App content and CTA buttons positioned clearly above photo layer
- Maintains consistent dark mode feel while adding visual energy and sports context

### Typography System

**Primary Typeface: Inter**

Inter serves as the sole typeface for Pick Six, handling all text roles from headings through body content to numerical data. Inter was selected for its geometric precision, excellent readability on screens at all sizes, strong number design with tabular number support, and widespread availability as a free Google Font with no licensing constraints.

**Why Inter for Pick Six:**

- **Geometric Sans-Serif:** Clean, modern aesthetic matching Sleeper-inspired visual direction
- **Superior Number Design:** Clear, well-proportioned numerals critical for odds display, standings tables, countdown timers, and scoring
- **Tabular Numbers:** `font-variant-numeric: tabular-nums` ensures fixed-width numbers for perfect column alignment in standings tables and odds displays
- **Excellent Screen Readability:** Designed specifically for computer screens, optimized for small sizes on mobile and large sizes on desktop
- **Weight Range:** Available in weights from Thin (100) to Black (900), providing full hierarchy without requiring second typeface
- **Dark Mode Optimized:** Good x-height and open letterforms maintain readability on dark backgrounds where thin fonts can disappear

**Type Scale (MUI Theme Configuration):**

| Level | Size (Mobile) | Size (Desktop) | Weight | Line Height | Usage |
|-------|---------------|-----------------|--------|-------------|-------|
| `h1` | 28px | 36px | 700 (Bold) | 1.2 | Page titles ("Week 5 Matchups") |
| `h2` | 24px | 30px | 700 (Bold) | 1.25 | Section headings ("Current Standings") |
| `h3` | 20px | 24px | 600 (Semi-Bold) | 1.3 | Card headings, matchup titles |
| `h4` | 18px | 20px | 600 (Semi-Bold) | 1.35 | Sub-section headings |
| `h5` | 16px | 18px | 600 (Semi-Bold) | 1.4 | Minor headings |
| `h6` | 14px | 16px | 600 (Semi-Bold) | 1.4 | Label headings |
| `body1` | 16px | 16px | 400 (Regular) | 1.5 | Primary body text, descriptions |
| `body2` | 14px | 14px | 400 (Regular) | 1.5 | Secondary body text, metadata |
| `subtitle1` | 16px | 16px | 500 (Medium) | 1.4 | Team names in matchup cards |
| `subtitle2` | 14px | 14px | 500 (Medium) | 1.4 | Secondary labels, categories |
| `caption` | 12px | 12px | 400 (Regular) | 1.4 | Timestamps, footnotes, helper text |
| `overline` | 11px | 12px | 600 (Semi-Bold) | 1.5 | Tags ("JAILED", "PICKED WK 3"), status labels |
| `button` | 14px | 14px | 600 (Semi-Bold) | 1.4 | Button text, action labels |

**Number Display Strategy:**

Numbers are prominent throughout Pick Six (moneyline odds, point spreads, standings points, countdown timers, week numbers) and require special typographic attention:

- **Tabular Numbers Globally:** Apply `font-variant-numeric: tabular-nums` to all numerical displays ensuring alignment in tables and lists
- **Odds Display:** `body1` weight 500 (Medium) for prominence within matchup cards
- **Standings Points:** `h3` weight 700 (Bold) for leaderboard emphasis
- **Countdown Timer:** `h2` weight 700 (Bold) with progressive size increase as deadline approaches
- **Week Numbers:** `overline` weight 600 (Semi-Bold) for consistent labeling

**Font Weight Usage by Context:**

| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text, descriptions, secondary information |
| Medium | 500 | Team names, odds values, interactive labels |
| Semi-Bold | 600 | Buttons, tags, status labels, sub-headings |
| Bold | 700 | Page headings, standings points, countdown timer, emphasis |

### Spacing & Layout Foundation

**Design Philosophy: Airy and Spacious with Balanced Card Density**

Pick Six's layout prioritizes generous whitespace and breathing room between elements, creating a premium feel that aligns with the Sleeper-inspired visual direction. Cards receive balanced density—enough information visible per card to be useful without cramming, with comfortable spacing between cards for visual rest and easy touch targeting.

The airy approach supports multiple UX goals simultaneously: reducing cognitive load during pick analysis, creating comfortable touch targets for mobile interaction, emphasizing visual hierarchy through whitespace, and transforming the weekly pick from "dense data consumption" to "enjoyable browsing experience."

**Spacing Scale (4px Base Grid):**

| Token | Value | Usage |
|-------|-------|-------|
| `spacing(0.5)` | 2px | Hairline separators, icon padding |
| `spacing(1)` | 4px | Tight internal padding, icon margins |
| `spacing(1.5)` | 6px | Chip/badge internal padding |
| `spacing(2)` | 8px | Standard internal padding, inline spacing |
| `spacing(3)` | 12px | Card internal padding (mobile), form field gaps |
| `spacing(4)` | 16px | Card internal padding (desktop), section gaps |
| `spacing(5)` | 20px | Component gaps, card margins on mobile |
| `spacing(6)` | 24px | Section spacing, card margins on desktop |
| `spacing(8)` | 32px | Major section breaks, page section padding |
| `spacing(10)` | 40px | Page-level vertical rhythm |
| `spacing(12)` | 48px | Hero section padding, major layout breaks |
| `spacing(16)` | 64px | Maximum spacing, landing page sections |

**Border Radius Scale (Rounded UI Language):**

| Token | Value | Usage |
|-------|-------|-------|
| `shape.borderRadius.sm` | 8px | Chips, badges, tags, tooltips |
| `shape.borderRadius.md` | 12px | Status banner, smaller containers |
| `shape.borderRadius.lg` | 16px | Cards, buttons, input fields, modals, primary interactive elements |
| `shape.borderRadius.xl` | 24px | Reserved for future use (full pill shapes if needed) |

The 16px radius serves as the dominant border radius for all primary interactive elements (cards, buttons, inputs, modals), establishing a consistent "rounded language" throughout the interface. Users interact with visually cohesive elements that feel like they belong to the same design system. The unified radius creates a softer, more modern aesthetic that complements the premium dark mode foundation.

**Layout Grid System:**

**Mobile (320px-767px):**
- Single column layout
- Content width: 100% with 16px horizontal padding
- Matchup cards: Full-width, stacked vertically
- Card gap: 12px between matchup cards (balanced density)
- Bottom navigation: Fixed, 56px height, thumb-zone optimized
- Pick status banner: Full-width, fixed at top below app bar

**Tablet (768px-1023px):**
- Single column layout (wider content area)
- Content width: max 720px, centered
- Matchup cards: Full-width within content area
- Card gap: 16px between matchup cards
- Navigation: Top tabs (transitioning from bottom mobile nav)

**Desktop (1024px+):**
- Content width: max 960px, centered (comfortable reading width)
- Matchup cards: Full-width within content area or 2-column grid for wider screens
- Card gap: 20px between matchup cards
- Side padding: Generous margins creating focused content area
- Navigation: Top tab bar within app bar

**Card Design Principles:**

**Matchup Cards:**
- Background: `background.paper` (`#1E1E1E`)
- Border radius: 16px (`shape.borderRadius.lg`)
- Internal padding: 16px (mobile), 20px (desktop)
- Elevation: Subtle shadow or 1px border (`#2A2A2A`) for depth on dark backgrounds
- Hover state (desktop): Background shifts to `background.elevated` (`#2A2A2A`)
- Active/Selected state: Emerald green border (`primary.main`)

**Buttons:**
- Border radius: 16px (`shape.borderRadius.lg`)
- Height: 48px (comfortable touch target)
- Padding: 16px horizontal minimum
- Primary variant: `primary.main` background, white text
- Full-width on mobile, auto-width on desktop (200px minimum)

**Input Fields:**
- Border radius: 16px (`shape.borderRadius.lg`) matching buttons for visual consistency
- Height: 48px (matching button height)
- Border: 1px `background.overlay` (`#333333`), focus border `primary.main`
- Background: `background.paper` (`#1E1E1E`)

**Modals/Dialogs:**
- Border radius: 16px (`shape.borderRadius.lg`) matching cards
- Background: `background.elevated` (`#2A2A2A`)
- Overlay: `#000000` at 50% opacity

**Status Banner:**
- Background: `success.main` at 15% opacity with `success.main` left border (4px)
- Border radius: 12px (`shape.borderRadius.md`)
- Full-width, fixed position below app bar
- Internal padding: 12px vertical, 16px horizontal
- Team logo: 32px height within banner

**Jailed Team Card:**
- Background: `background.paper` with `warning.main` border (2px)
- Border radius: 16px (`shape.borderRadius.lg`) matching standard cards
- "JAILED" tag: `overline` typography, `warning.main` color

**Component Spacing Relationships:**

**Within Matchup Cards:**
- Team logo to team name: 12px horizontal gap
- Team section to odds: 8px gap
- Odds to weather info: 8px gap
- Game time caption: 4px below main content

**Between Interface Sections:**
- Pick status banner to jailed team callout: 16px
- Jailed team callout to matchup list: 16px
- Matchup list to next section: 24px
- Tab content padding: 16px (mobile), 24px (desktop)

**Touch Target Sizing:**
- Minimum touch target: 44px x 44px (WCAG recommendation)
- Matchup card: Full-width, minimum 72px height (comfortable tap target)
- Submit button: Full-width (mobile), 200px minimum (desktop), 48px height
- Tab bar items: Equal width distribution, 48px minimum height
- Team selection area within card: Entire card is tappable

**Whitespace Strategy:**

**Generous Whitespace Principles:**
- Sections separated by clear visual gaps (24-32px) preventing information blur
- Cards float with comfortable margins creating visual hierarchy through space
- No edge-to-edge information density—content breathes within containers
- Screen bottom padding ensures last card doesn't touch navigation bar

**Information Density Balance:**
- Matchup cards show essential information (logos, names, odds, weather, game time) without scrolling within card
- Detail overlays provide additional context on demand (not crammed into primary card)
- Standings table uses comfortable row heights (48px minimum) with clear separators
- Mobile maintains information completeness while adjusting layout (stacking rather than removing)

### Accessibility Considerations

**Color Contrast Compliance (WCAG Level A):**

All text and interactive elements maintain minimum 4.5:1 contrast ratio against dark backgrounds:

| Combination | Foreground | Background | Ratio | Status |
|-------------|-----------|------------|-------|--------|
| Primary text on default bg | `rgba(255,255,255,0.87)` | `#121212` | ~15:1 | Exceeds |
| Secondary text on default bg | `rgba(255,255,255,0.60)` | `#121212` | ~9:1 | Exceeds |
| Emerald green on default bg | `#2ECC71` | `#121212` | ~8:1 | Exceeds |
| Gold accent on default bg | `#FFD700` | `#121212` | ~12:1 | Exceeds |
| Warning amber on default bg | `#F5A623` | `#121212` | ~9:1 | Exceeds |
| Error red on default bg | `#EF5350` | `#121212` | ~5:1 | Meets |
| Primary text on paper bg | `rgba(255,255,255,0.87)` | `#1E1E1E` | ~13:1 | Exceeds |
| Disabled text on default bg | `rgba(255,255,255,0.38)` | `#121212` | ~4.8:1 | Meets |

**Color-Independent Communication:**

Visual states never rely solely on color to communicate meaning:
- **Jailed team:** Color (amber border) + text ("JAILED" tag) + interaction (click triggers error popup)
- **Already picked team:** Color (grayed logo) + text ("PICKED WK 3" tag) + interaction (tooltip on hover/tap)
- **Submission success:** Color (green banner) + icon (checkmark) + text ("Your pick is submitted: Buffalo Bills")
- **Errors:** Color (red) + icon (warning/error icon) + text (descriptive error message)
- **Anti-jailed bonus:** Color (gold badge) + text ("2 POINTS") + interaction (explanation on selection)

**Dark Mode Accessibility:**

- Pure black (`#000000`) avoided as primary background to reduce eye strain and halation effect
- Charcoal (`#121212`) provides comfortable dark foundation
- Text uses opacity-based white rather than solid white to reduce harshness
- Sufficient contrast between surface layers (`#121212` → `#1E1E1E` → `#2A2A2A`) prevents interface elements from blending together
- Interactive element borders and elevation provide depth cues beyond color alone

**Focus Indicators:**

- All interactive elements display visible focus ring (2px emerald green outline with 2px offset)
- Focus ring color (`primary.main`) provides strong contrast against dark backgrounds
- Tab navigation follows logical reading order through pick submission workflow
- Focus trapped within modals and dialogs when open

## Component Strategy

### Design System Components (MUI Coverage)

MUI provides comprehensive coverage for standard UI patterns, themed with Pick Six's visual foundation (dark mode, emerald green primary, Inter font, 16px border radius):

**Navigation Components:**
- `Tabs` / `BottomNavigation` -- Core tab-based navigation pattern (mobile bottom, desktop top)
- `AppBar` -- Desktop top bar housing logo, tabs, and user avatar
- `Drawer` -- Swipeable mobile navigation fallback for secondary functions (settings, logout)

**Layout Primitives:**
- `Grid` / `Stack` / `Container` / `Box` -- Responsive layout at all breakpoints
- `Paper` -- Elevated surface containers with theme-aware background colors

**Form Components:**
- `Button` -- Primary (emerald), secondary (outlined), disabled states with 16px radius
- `TextField` -- Input fields with 16px radius, dark background, emerald focus border
- `Select` / `Checkbox` / `Radio` -- Admin configuration forms

**Feedback Components:**
- `Alert` -- Base for pick status banners and system messages
- `Snackbar` -- Transient notifications (pick updated, error dismissed)
- `Dialog` -- Full-screen mobile overlays, modal desktop overlays, confirmation prompts
- `Tooltip` -- Contextual help for jailed team explanation, anti-jailed bonus details

**Data Display Components:**
- `Table` -- Standings table foundation with theme-aware row styling
- `Card` -- Base for matchup cards, admin cards, sidebar cards
- `Chip` / `Badge` -- "JAILED", "WK 2", "2 PTS", "SUBMITTED", "PENDING" tags
- `Typography` -- Full type scale from h1 through caption/overline

**Utility Components:**
- `CircularProgress` / `LinearProgress` -- Loading states
- `Skeleton` -- Content placeholder during data fetch
- `Divider` -- Section separators within views

### Custom Components

#### MatchupCard

**Purpose:** Primary interactive element for weekly pick selection. Displays two teams in a matchup with odds, weather, game time, and home/away designation. Users tap/click the card to select their pick for the week.

**Anatomy:**
- Header row: game time (left), weather badge (right)
- Teams row: away team (logo + name + odds) | "@" or "vs" divider | home team (logo + name + odds)
- Anti-jailed bonus badge (when applicable): gold "2 PTS" chip on eligible team side

**States:**

| State | Visual Treatment | Interaction |
|-------|-----------------|-------------|
| Default | `background.paper`, transparent border | Clickable, hover elevates to `background.elevated` |
| Selected | `background.elevated`, 2px `primary.main` border | Clickable (allows deselection or reselection) |
| Jailed Opponent | Gold `warning.main` border at 30% opacity, jailed team side dimmed with "JAILED" tag | Opponent team clickable for anti-jailed bonus; jailed team click triggers error popup |
| Already-Picked Team | Specific team side: logo grayscale 70%, name `text.disabled`, "WK X" tag on logo | Picked team unclickable; opponent remains selectable |
| Post-Deadline | All cards non-interactive, submitted pick shows selected state | No interaction; informational only |

**Responsive Behavior:**
- Mobile: full-width single column, stacked vertically with 12px gap
- Desktop: 2-column grid with 16px gap
- Touch target: entire card surface (minimum 72px height)

**Accessibility:**
- `role="radio"` within `role="radiogroup"` for matchup list
- `aria-checked` reflects selection state
- `aria-disabled` on jailed team and already-picked team elements
- Keyboard: arrow keys navigate between cards, Enter/Space selects

#### PickStatusBanner

**Purpose:** Persistent visual confirmation of current pick status, eliminating "did I submit?" anxiety. Remains visible throughout the application below the app bar.

**Anatomy:**
- Team logo circle (32px)
- Status text with team name highlighted in state color
- Lock icon (post-deadline locked state only)

**States:**

| State | Background | Border | Text | Icon |
|-------|-----------|--------|------|------|
| Submitted | `success.main` at 15% | 4px left `success.main` | "Your pick is submitted: **{Team}**" | None |
| Locked (post-deadline) | `info.main` at 15% | 4px left `info.main` | "Your pick is locked in: **{Team}**" | Lock icon |
| No Pick | Not rendered | -- | -- | -- |

**Responsive Behavior:**
- Mobile: full-width below app bar
- Desktop: inline within header row, max-width 400px, right-aligned next to page title

#### DeadlineCountdown

**Purpose:** Always-visible countdown to weekly pick deadline, with progressive visual urgency as Thursday approaches.

**Anatomy:**
- Clock icon
- Countdown text (Xd Xh Xm format)

**Urgency States:**

| Timeframe | Text Color | Font Size | Weight | Additional |
|-----------|-----------|-----------|--------|------------|
| > 48 hours | `text.secondary` | 14px | 500 | Calm, standard |
| 24-48 hours | `warning.main` | 16px | 600 | Elevated visibility |
| < 24 hours | `warning.main` | 16px | 600 | -- |
| < 4 hours | `error.main` | 18px | 700 | Pulsing animation optional |
| Passed | `text.disabled` | 14px | 500 | "Deadline passed" static text |

**Responsive Behavior:**
- Mobile: full-width row below pick status banner
- Desktop: inline within info bar alongside jailed team callout

#### JailedTeamCallout

**Purpose:** Prominent notification identifying this week's jailed team (biggest favorite), their odds, and a brief explanation for users unfamiliar with the mechanic.

**Anatomy:**
- Lock icon in `warning.main`
- Bold team name + odds
- Explanation subtext ("Biggest favorite this week. Cannot be selected directly.")

**Visual Treatment:**
- Background: `warning.main` at 10% opacity
- Border: 1px solid `warning.main` at 30% opacity
- Border radius: 16px

**States:** Single state (informational only, not interactive). Content changes weekly based on odds calculation.

**Responsive Behavior:**
- Mobile: full-width below deadline countdown
- Desktop: shares horizontal row with deadline countdown (each flex: 1)

#### TeamLogo

**Purpose:** Reusable team identifier displaying team abbreviation within a colored circle. Used across matchup cards, pick status banner, standings sidebar, and admin cards.

**Sizes:**

| Variant | Diameter | Font Size | Context |
|---------|----------|-----------|---------|
| `sm` | 24px | 9px | Standings sidebar pick history |
| `md` | 32px | 11px | Pick status banner, landing preview cards |
| `lg` | 40px | 14px | Matchup cards (primary size) |

**States:**
- Default: team brand color background, white bold text
- Disabled: 70% grayscale filter, 50% opacity (already-picked teams)
- Jailed: 50% desaturation (jailed team within matchup card)

**Roadmap (implementation):** Replace abbreviation text with **actual team logo images** (static licensed assets, provider-supplied URLs, or approved API) per **`_bmad-output/planning-artifacts/epics.md`** — Story 3.8. Preserve **sm/md/lg** sizes, **disabled/jailed** visual states, and **abbreviation + circle fallback** on load failure. Respect NFL mark licensing in asset choice.

#### AdminSubmissionCard

**Purpose:** Per-participant card in admin dashboard showing pick submission status for the current week.

**Anatomy:**
- Participant name (left)
- Status chip (right): "SUBMITTED" (green) or "PENDING" (amber)
- Detail line: "Picked: {Team} - Submitted {timestamp}" or "No pick submitted yet"

**Visual Treatment:**
- Background: `background.paper`
- Border radius: 16px
- Internal padding: 16px

**States:**

| State | Status Chip | Detail Text |
|-------|------------|-------------|
| Submitted | Green chip (`success.main` at 15%, green text) | Team name + submission timestamp |
| Pending | Amber chip (`warning.main` at 15%, amber text) | "No pick submitted yet" |

**Responsive Behavior:**
- Mobile: full-width stacked list
- Desktop: left column in 2-column admin layout

#### AdminEmailComposer

**Purpose:** Interface for admin to configure and preview the weekly Tuesday reminder email content before automated sending.

**Anatomy:**
- Subject line text field
- Message body textarea (resizable)
- Action buttons: "Preview Email" (info blue) and "Send Now" (emerald green)

**Visual Treatment:**
- Contained within a sidebar card (`background.paper`, 16px radius, 16px padding)
- Text fields use standard themed inputs (16px radius, dark background)
- Textarea minimum height: 100px

**Responsive Behavior:**
- Mobile: full-width below submission status cards
- Desktop: right column in 2-column admin layout

#### WeatherBadge

**Purpose:** Compact weather information display within matchup card headers, providing strategic context for outdoor games.

**Anatomy:**
- Weather emoji/icon
- Temperature + condition text

**Variants:**

| Variant | Display | Example |
|---------|---------|---------|
| Outdoor | Icon + temp + condition | "42°F Partly Cloudy" |
| Indoor | Icon + "Indoor" | "Indoor" |
| Dome | Icon + "Retractable Roof" | "Retractable Roof (Open)" |

**Visual Treatment:**
- Font: 11px, `text.disabled` color
- Flex-shrink: 0 to prevent truncation
- Right-aligned within matchup header

#### StandingsTable

**Purpose:** League leaderboard displaying current season standings with rank, participant name, record, and points.

**Anatomy:**
- Header row: #, Participant, Record, Pts
- Data rows with per-participant stats
- Current user row highlighted

**Visual Treatment:**
- Collapsed border spacing with 4px row gap
- Row background: `background.paper`
- First/last cell border radius: 16px (rounded row ends)
- Highlight row: `primary.main` at 8% opacity background
- Points column: `primary.main` color, bold weight
- Tabular numbers throughout for column alignment

**Responsive Behavior:**
- Mobile: full-width, horizontal scroll if needed (unlikely with 4 columns)
- Desktop: full-width within main content area (left column in standings layout)

#### DesktopAppBar

**Purpose:** Top navigation bar for tablet and desktop breakpoints, replacing mobile bottom tab bar.

**Anatomy:**
- Left: app logo ("PICK SIX" in `primary.main`, bold)
- Center: tab navigation (This Week | Standings | History | Rules | Admin)
- Right: user name + avatar circle

**Visual Treatment:**
- Background: `background.paper`
- Bottom border: 1px `background.overlay`
- Height: 56px
- Active tab: `primary.main` text + 2px bottom border
- Inactive tab: `text.disabled`, hover shifts to `text.secondary`

**Breakpoint Behavior:**
- < 768px: hidden (mobile bottom tab bar shown instead)
- >= 768px: visible, bottom tab bar hidden

### Component Implementation Strategy

**Build Approach:** All custom components built as React components using MUI's `Box`, `Paper`, `Typography`, and `styled()` API, consuming theme tokens for colors, spacing, typography, and border radius. No hardcoded values -- all visual properties reference the MUI theme object.

**Shared Patterns:**
- All cards use `background.paper` surface with 16px radius
- All interactive elements use 48px minimum height for touch targets
- All text follows the Inter type scale defined in the theme
- All colors reference semantic tokens (`primary.main`, `warning.main`, etc.)
- State transitions use 200ms ease for hover/focus, 150ms for active

**Component Composition:**
- `MatchupCard` composes `TeamLogo` and `WeatherBadge`
- `PickStatusBanner` composes `TeamLogo`
- Admin dashboard composes `AdminSubmissionCard` list + `AdminEmailComposer`
- Desktop layout composes `DesktopAppBar` with page-level content
- `StandingsTable` composes `TeamLogo` (sm variant) in expanded row views

### Implementation Roadmap

**Phase 1 -- Core Pick Flow (MVP Critical):**
1. `MatchupCard` -- without this, no pick submission possible
2. `PickStatusBanner` -- core anxiety-reduction element
3. `DeadlineCountdown` -- time awareness for all users
4. `JailedTeamCallout` -- jailed team visibility
5. `TeamLogo` -- dependency for MatchupCard and PickStatusBanner
6. `WeatherBadge` -- dependency for MatchupCard

**Phase 2 -- Standings & Navigation:**
7. `StandingsTable` -- competitive engagement view
8. `DesktopAppBar` -- desktop navigation experience

**Phase 3 -- Admin Dashboard:**
9. `AdminSubmissionCard` -- admin monitoring
10. `AdminEmailComposer` -- email configuration

## UX Consistency Patterns

### Button Hierarchy

| Variant | Visual Treatment | Usage |
|---------|-----------------|-------|
| Primary | Emerald fill, white text, 16px radius | One per view maximum. Submit pick, send email, join league -- the single most important action on screen |
| Secondary | `background.paper` fill, 1px `background.overlay` border, `text.primary` | Supporting actions alongside a primary. Preview email, view details, cancel |
| Text | No background, `primary.main` text | Inline actions, links, low-emphasis options. "Already have an account? Log in" |
| Destructive | `error.main` fill, white text | Admin-only actions with consequences. Override pick, remove participant |
| Disabled | `background.overlay` fill, `text.disabled` | Blocked actions. Post-deadline submit, incomplete form |

**Rules:**
- Never stack two primary buttons in the same view
- Full-width on mobile, auto-width (200px min) on desktop
- All buttons 48px height for touch target compliance
- Disabled buttons stay visible with tooltip explaining why (never hidden)

### Feedback Patterns

**Success Feedback:**
- Pick submission: PickStatusBanner appears/updates (persistent, not transient)
- Pick modification: Banner updates immediately, no Snackbar confirmation needed
- Admin actions: Snackbar toast (4 seconds, auto-dismiss) confirming action

**Error Feedback:**
- Jailed team click: Error popup overlay (2 seconds, auto-dismiss) -- "Jailed team cannot be chosen"
- Validation errors: Inline below the relevant field, `error.main` text with error icon
- Network/system errors: Full-width Alert at top of content area with retry action
- Post-deadline submission attempt: Disabled button + "Deadline passed" countdown state

**Warning Feedback:**
- Deadline approaching: DeadlineCountdown urgency escalation (color/size progression)
- Missing pick reminder: Contextual prompt within pick interface (not modal)

**Loading States:**
- Initial page load: Skeleton placeholders matching card/table shapes
- Data refresh (odds update, standings): Subtle inline loading indicator, existing content remains visible
- Pick submission in-flight: Button shows spinner, disabled until response

### Form Patterns

**Validation Approach:** Validate on blur for text fields, validate immediately for selection-based inputs (pick selection, team choice).

**Pick Selection (Primary Form):**
- No traditional form -- card tap is the input
- Validation is visual and preventive (grayed teams, jailed blocking)
- Submit button text reflects current selection: "Submit Pick: {Team Name}"
- Submit button disabled when no team selected

**Admin Forms (Email Composer, Settings):**
- Labels above fields (never placeholder-only)
- Error messages appear below field on blur
- Save/submit button disabled until form is valid
- Textarea auto-grows with content (min 100px)

**Input Field States:**

| State | Border | Background | Label |
|-------|--------|-----------|-------|
| Default | 1px `background.overlay` | `background.paper` | `text.secondary` |
| Focused | 1px `primary.main` | `background.paper` | `primary.main` |
| Error | 1px `error.main` | `background.paper` | `error.main` |
| Disabled | 1px `background.overlay` | `background.default` | `text.disabled` |

### Navigation Patterns

**Tab Switching:**
- Instant content swap (no page reload, no transition animation)
- Active tab state persists across sessions (context preservation)
- URL updates to reflect active tab for deep linking and back button support

**Mobile Bottom Tab Bar:**
- Fixed position, always visible (56px height + safe area inset)
- 4 tabs for participants: This Week | Standings | History | Rules
- 5 tabs for admin: This Week | Standings | History | Rules | Admin
- Active tab: `primary.main` icon + label; inactive: `text.disabled`

**Desktop Top Tab Bar:**
- Within AppBar, text-only tabs (no icons)
- Active tab: `primary.main` text + 2px bottom border
- User avatar + name right-aligned

**Breakpoint Switch:** Bottom tabs below 768px, top tabs at 768px+. Never both visible simultaneously.

### Empty States

| Context | Message | Action |
|---------|---------|--------|
| No pick submitted (current week) | "Make your pick for Week {X}" | Matchup list visible below |
| No standings yet (pre-season) | "Standings will appear after Week 1 results" | None |
| No pick history (new participant) | "Your pick history will appear here after your first submission" | None |
| Admin: all picks submitted | "All participants have submitted picks this week" | None (celebration state) |
| Network error | "Unable to load data. Check your connection." | "Retry" button |

### Modal & Overlay Patterns

**Mobile:** Full-screen dialog (slide up from bottom, swipe down to dismiss)
**Desktop:** Centered modal with backdrop overlay (`#000000` at 50%)

**When to use modals:**
- Matchup detail view (weather, spread, context) -- optional enhancement
- Admin override confirmation (destructive action)
- League creation setup steps

**When NOT to use modals:**
- Pick submission confirmation (use PickStatusBanner instead)
- Error messages (use inline Alert or Snackbar)
- Navigation (use tabs)

## Responsive Design & Accessibility

### Responsive Strategy

**Approach: Mobile-First with Desktop Enhancement**

Design and develop for mobile constraints first, then enhance layouts for wider screens. Mobile is not a simplified version of desktop -- it's the foundation that desktop builds upon with layout changes only.

**What Changes Across Breakpoints:**

| Element | Mobile (< 768px) | Desktop (>= 768px) |
|---------|-------------------|---------------------|
| Navigation | Bottom tab bar | Top AppBar with tabs |
| Matchup cards | Single column, full-width | 2-column grid |
| Standings page | Table only | Table + sidebar (pick history, stats) |
| Admin dashboard | Stacked single column | 2-column (submissions + email composer) |
| Pick status banner | Full-width below nav | Inline with page title |
| Deadline + jailed callout | Stacked vertically | Side-by-side horizontal row |
| Submit button | Full-width | Right-aligned, 280px max-width |
| Landing page | Centered, stacked | Side-by-side hero (text left, preview right) |

**What Does NOT Change:**
- Feature availability (full parity)
- Information completeness (no content hidden on mobile)
- Interaction model (tap = click, all actions available)
- Visual identity (colors, typography, radius, spacing tokens)

### Breakpoint Definitions

| Breakpoint | Range | MUI Key | Primary Target |
|-----------|-------|---------|----------------|
| Mobile | 0 - 767px | `xs`, `sm` | Phones in portrait and landscape |
| Desktop | 768px+ | `md`, `lg`, `xl` | Tablets, laptops, monitors |

Two functional breakpoints keep responsive logic simple for solo development. The 768px threshold aligns with iPad portrait width, a natural transition point from single-column to multi-column layouts.

### Accessibility Strategy

**Target: WCAG 2.1 Level A**

Level A compliance is appropriate for Pick Six's private league context (known user base, technically comfortable, no public-facing regulatory requirement). This covers essential accessibility without the implementation burden of Level AA/AAA for a solo developer on MVP timeline.

**Keyboard Navigation:**

| Context | Keys | Behavior |
|---------|------|----------|
| Tab bar | Tab / Shift+Tab | Move between tabs |
| Tab bar | Enter / Space | Activate focused tab |
| Matchup list | Arrow Up/Down | Move between matchup cards |
| Matchup card | Enter / Space | Select team / submit pick |
| Modals | Escape | Close modal, return focus to trigger |
| Modals | Tab | Cycle through focusable elements within modal (focus trap) |

**Screen Reader Support:**
- Semantic HTML: `nav`, `main`, `section`, `table`, `button` over generic `div`
- ARIA labels on icon-only elements (lock icon, weather icons, team logos)
- Live regions (`aria-live="polite"`) for pick status banner updates and deadline countdown changes
- Matchup list as `radiogroup` with individual matchup cards as `radio` options

**Testing Approach:**
- Automated: axe-core or similar during development for contrast, ARIA, and structure violations
- Manual: keyboard-only navigation through complete pick submission flow
- Manual: VoiceOver (macOS/iOS Safari) walkthrough of primary flows
- Color: verify all states communicate meaning through text/icon in addition to color
