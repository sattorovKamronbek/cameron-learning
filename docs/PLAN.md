# Cameron — Platform Master Plan
## Part 1: Product Strategy, Research & UX Foundation

> **Status:** Production-ready blueprint
> **Audience:** Product, engineering, design, and leadership teams
> **Date:** August 2026
> **Document owner:** Product Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Mission](#2-product-vision--mission)
3. [Target Audience](#3-target-audience)
4. [User Personas](#4-user-personas)
5. [Business Goals & KPIs](#5-business-goals--kpis)
6. [Competitive Analysis](#6-competitive-analysis)
7. [Unique Selling Points](#7-unique-selling-points)
8. [Monetization Strategy](#8-monetization-strategy)
9. [Branding Direction](#9-branding-direction)
10. [Information Architecture](#10-information-architecture)
11. [Complete Sitemap](#11-complete-sitemap)
12. [Navigation System](#12-navigation-system)
13. [User Roles & Permissions](#13-user-roles--permissions)
14. [User Journeys](#14-user-journeys)
15. [Onboarding Flows](#15-onboarding-flows)
16. [Feature Prioritization](#16-feature-prioritization)
17. [MVP Scope](#17-mvp-scope)
18. [Long-Term Roadmap](#18-long-term-roadmap)
19. [Functional Requirements](#19-functional-requirements)

---

## 1. Executive Summary

Cameron is a comprehensive online learning platform that teaches programming as its
primary discipline while supporting a broad range of academic and professional
subjects — mathematics, physics, languages, business, design, and more.

The platform is built around a single core conviction: **learning is not content
consumption — it is deliberate practice with feedback.** Every design decision
flows from that conviction. We do not optimize for hours watched; we optimize
for skills acquired and demonstrated.

The market is saturated with platforms that excel at one dimension. Udemy has
breadth but no practice environment. LeetCode has practice but no curriculum.
Coursera has academic credibility but poor engagement. freeCodeCamp has
curriculum and practice but a dated experience and limited subject range.
**No platform combines world-class curriculum, an in-browser coding
environment, intelligent feedback, gamified progression, and a vibrant
community into a single, beautifully designed product.**

Cameron closes that gap.

### What makes Cameron different

| Dimension | Typical platform | Cameron |
|---|---|---|
| Learning model | Watch → quiz → certificate | Learn → practice → get feedback → demonstrate mastery |
| Practice | External or none | In-browser code editor + auto-evaluation for every programming lesson |
| Feedback | Manual or none | Instant test-case feedback + AI explanations on failure |
| Progression | Course completion | XP, levels, streaks, skill trees, verified skill assessments |
| Community | Comment threads | Threaded forums, study groups, peer code review, mentorship |
| Design | Functional, template-driven | Original design system built for long study sessions |
| Subjects | Programming-only or academic-only | Programming-first, multi-subject from day one |

### Three-phase delivery

1. **MVP (Phase 1):** Public discovery, auth, course consumption, in-browser
   code practice, basic gamification, community forums, subscription billing.
2. **Beta (Phase 2):** Instructor portal, assignments, certificates, advanced
   gamification, notifications, messaging, admin tools, analytics.
3. **Production (Phase 3):** AI tutor, peer review, mentorship, mobile app,
   multi-language UI, enterprise tier, API platform.

---

## 2. Product Vision & Mission

### Vision statement

> To be the platform where curious minds become capable practitioners — where
> learning to code and mastering academic subjects feel like one continuous,
> rewarding journey rather than a series of disconnected courses.

### Mission statement

> We provide structured, practice-driven learning with immediate feedback,
> intelligent guidance, and a supportive community — accessible to anyone
> with a browser and the desire to learn.

### Core principles

Every feature, page, and interaction must satisfy at least one of these
principles. If it does not, it does not ship.

1. **Practice over passivity.** Every programming lesson includes a hands-on
   exercise. Every concept includes a check-for-understanding. We never let a
   learner go three minutes without doing something.

2. **Feedback is the product.** Content is commodity; feedback is the
   differentiator. Instant test-case results, AI-powered error explanations,
   and peer review are not add-ons — they are the core loop.

3. **Progress should feel real.** XP, levels, streaks, and skill trees are not
   gamification gimmicks; they are a visual language for real learning
   progress. They must map to genuine skill acquisition, not vanity metrics.

4. **Respect the learner's time and attention.** No dark patterns, no
   manipulative notifications, no content gated behind artificial waits. The
   platform earns engagement by being genuinely useful, not by exploiting
   psychology.

5. **Cognitive load is a design constraint.** The interface must be calm,
   focused, and legible during multi-hour study sessions. Visual noise is a
   bug. Every pixel must earn its place.

6. **Accessibility is not optional.** The platform meets WCAG 2.1 AA from the
   first release. If a feature cannot be made accessible, it is redesigned,
   not shipped broken.

7. **Community amplifies learning.** Learning alone is hard. Learning with
   peers, mentors, and instructors is faster, more durable, and more
   enjoyable. Community features are first-class, not bolted on.

### Long-term aspiration (5-year horizon)

Cameron becomes the default place where:

- A high school student writes their first Python program.
- A career changer transitions into web development in six months.
- A university student supplements their physics degree with interactive
  problem sets.
- A senior engineer mentors the next generation and earns revenue doing it.
- An enterprise upskills its engineering team with tracked, measurable
  outcomes.

The platform evolves from a course marketplace into a **learning operating
system** — a place where skill acquisition, demonstration, and community are
unified.

---

## 3. Target Audience

### Primary segments

#### S1: Aspiring programmers (beginners)
- **Age:** 16–30
- **Profile:** Students, career changers, self-taught learners with no
  formal CS background.
- **Goal:** Learn to code from scratch and become job-ready.
- **Pain point:** Overwhelmed by fragmented free resources; tutorial hell;
  no feedback on whether they are doing it right.
- **What they need:** A clear path, hands-on practice, and confirmation they
  are progressing.

#### S2: Practicing developers (intermediate/advanced)
- **Age:** 22–40
- **Profile:** Working developers wanting to level up, learn a new stack, or
  prepare for interviews.
- **Goal:** Deepen specific skills (algorithms, system design, a new
  framework).
- **Pain point:** Existing platforms are either too basic or too shallow;
  they want challenge and depth.
- **What they need:** Advanced content, real coding challenges, performance
  benchmarks.

#### S3: Academic learners
- **Age:** 16–25
- **Profile:** High school and university students supplementing their
  coursework.
- **Goal:** Understand math, physics, chemistry, economics, and other
  subjects more deeply than their lectures allow.
- **Pain point:** Textbooks are static; lectures are passive; they want
  interactive explanations and practice problems.
- **What they need:** Visual, interactive explanations; problem sets with
  worked solutions.

#### S4: Instructors & content creators
- **Age:** 25–55
- **Profile:** Experienced developers, academics, and educators who want to
  share knowledge and earn revenue.
- **Goal:** Build and sell courses, build a following, generate income.
- **Pain point:** Existing platforms take high revenue cuts, offer poor
  tooling, and provide no practice infrastructure.
- **What they need:** A professional course builder, fair revenue share, and
  built-in practice and assessment tooling.

#### S5: Enterprises & teams
- **Age:** N/A (organizational)
- **Profile:** Engineering managers and L&D teams at companies with 50+
  developers.
- **Goal:** Upskill teams in specific technologies with measurable outcomes.
- **Pain point:** Generic platforms lack team analytics, custom paths, and
  SSO.
- **What they need:** Team dashboards, custom learning paths, SSO, skill
  gap analysis, and compliance reporting.

### Secondary segments (future phases)

| Segment | Description | Phase |
|---|---|---|
| S6: Parents | Monitor and guide K-12 learners | Phase 3 |
| S7: Bootcamps | Use Cameron as a curriculum delivery tool | Phase 3 |
| S8: Schools | Institutional licenses for classrooms | Future |

### Geographic focus

- **MVP:** English-speaking markets (US, UK, Canada, Australia, India).
- **Beta:** Expand to EU and Latin America with localized pricing.
- **Production:** Multi-language UI, localized content where viable.

---

## 4. User Personas

### Persona 1: Maya — The Career Changer

```
Name:       Maya Chen
Age:        27
Location:   Austin, TX
Occupation: Marketing coordinator, transitioning into web development
Income:     $52k/year
Tech level: Beginner — completed a few YouTube tutorials, no real project
Motivation: Career growth, higher salary, creative satisfaction
Frustration: "I've watched 40 hours of JavaScript tutorials but I can't
             build anything from scratch."
Devices:    MacBook Air (personal), iPhone 14 (mobile browsing)
Quote:      "I don't need another video. I need to know if what I wrote
             actually works."
```

**Maya's journey on Cameron:**
1. Lands on the homepage via a Google search for "learn JavaScript from scratch."
2. Takes a 3-question skill assessment that places her at "Absolute beginner."
3. Enrolls in the "Web Developer" roadmap — a structured 24-week path.
4. Completes the first lesson: watches a 6-minute video, then immediately
   writes and runs code in the in-browser editor. The test cases pass. She
   earns 50 XP and a "First Lines" badge.
5. Returns the next day. Her streak is at 2. She sees a leaderboard of
   learners in her cohort. She feels accountable.
6. After 8 weeks, she has a 34-day streak, 4,200 XP, and has built three
   small projects. She upgrades to Pro for downloadable resources and
   certificates.
7. After 24 weeks, she completes the roadmap, earns a verified certificate,
   and publishes her capstone project to the community for peer review.

**Design implications:**
- The in-browser editor must work on her MacBook without installation.
- Roadmaps must feel like a clear, achievable path — not an overwhelming list.
- Streaks and XP must be visible but not anxiety-inducing.
- The upgrade to Pro must feel like a natural step, not a paywall.

---

### Persona 2: Daniel — The Interview Prepper

```
Name:       Daniel Okoro
Age:        24
Location:   Lagos, Nigeria
Occupation: CS graduate, junior developer at a startup
Income:     $18k/year (local context)
Tech level: Intermediate — comfortable with Python, learning DSA
Motivation: Land a senior role at an international company
Frustration: "I know the theory, but I freeze on timed coding challenges.
             I need structured practice, not more theory."
Devices:    Windows desktop (home), Android phone (commute)
Quote:      "Give me a problem, a timer, and honest feedback. That's all
             I need."
```

**Daniel's journey on Cameron:**
1. Arrives via a recommendation from a senior engineer on Twitter.
2. Browses the coding challenges section — filtered by "arrays" and
   "medium difficulty."
3. Opens a challenge. The editor loads instantly. He writes a solution,
   runs it against 12 test cases. 10 pass, 2 fail on edge cases.
4. The AI explanation tells him exactly which edge case he missed and why.
5. He retries, passes all tests, earns 120 XP and climbs 3 spots on the
   weekly leaderboard.
6. He subscribes to Pro for the premium challenge set and performance
   analytics ("You are in the 78th percentile for array problems").

**Design implications:**
- The code editor must be fast, familiar (VS Code-style keybindings), and
  support multiple languages.
- Challenge results must be instant and unambiguous.
- Leaderboards must be granular (weekly, by topic, by difficulty).
- Pricing must be accessible in emerging markets (regional pricing).

---

### Persona 3: Dr. Amara — The Instructor

```
Name:       Dr. Amara Okafor
Age:        38
Location:   London, UK
Occupation: Data scientist, PhD in statistics, part-time university lecturer
Income:     £85k/year
Tech level: Advanced — Python, R, SQL, statistics
Motivation: Share knowledge, build a reputation, earn supplementary income
Frustration: "I've published on Udemy, but the tools are terrible. I can't
             embed exercises. Students don't practice. I get 4.2 stars
             because the platform sets wrong expectations."
Devices:    MacBook Pro (work), iPad (content review)
Quote:      "I want a platform where my students actually learn, not just
             watch."
```

**Dr. Amara's journey on Cameron:**
1. Discovers Cameron through a colleague who mentions the instructor portal.
2. Applies to become an instructor — submits credentials and a sample lesson.
3. After approval, she accesses the course builder: a structured workflow
   for creating modules, lessons, exercises, and assessments.
4. She creates a "Statistics for Data Science" course. For each lesson, she
   uploads a video, writes a summary, and attaches a Python exercise with
   custom test cases.
5. She publishes the course. Within a week, 1,200 learners enroll. She
   sees real-time analytics: completion rate, drop-off points, exercise
   pass rates.
6. She earns 70% revenue share — higher than Udemy's 37% — and receives
   weekly payouts.
7. She iterates on her course based on analytics: the lesson on Bayes'
   theorem has a 60% exercise pass rate, so she adds a supplementary
   explanation video.

**Design implications:**
- The instructor portal must be a professional tool, not a stripped-down form.
- Analytics must be actionable — not vanity dashboards.
- Revenue share and payouts must be transparent and competitive.
- Exercise creation must be as easy as writing a Markdown document.

---

### Persona 4: Sarah — The High School Student

```
Name:       Sarah Mitchell
Age:        17
Location:   Manchester, UK
Occupation: Sixth-form student preparing for A-level exams
Income:     N/A (parents pay)
Tech level: Comfortable with computers, beginner in programming
Motivation: Get into a top computer science program at university
Frustration: "My physics teacher goes too fast. I need to pause, rewind,
             and actually try problems, not just copy notes."
Devices:    Family laptop, iPhone
Quote:      "I learn by doing, not by copying from a board."
```

**Sarah's journey on Cameron:**
1. Her parent creates a family account and adds Sarah as a dependent learner.
2. Sarah explores the "Academic Subjects" section and finds A-level physics
   and math courses.
3. She takes a diagnostic quiz that identifies her weak areas: "Mechanics:
   conservation of momentum" and "Calculus: chain rule."
4. The platform generates a personalized study plan focused on those areas.
5. She works through interactive problem sets. Each problem has a worked
   solution and a "try a similar problem" button.
6. She tracks her progress on her dashboard. Her parent receives a weekly
   summary email.
7. After six weeks, her mock exam score improves from a C to a B.

**Design implications:**
- The platform must support dependent accounts with parental oversight.
- Diagnostic quizzes must produce actionable study plans.
- "Try a similar problem" requires a large problem bank with parameterized
  variations.
- Weekly summary emails must be informative without being intrusive.

---

### Persona 5: Marcus — The Engineering Manager

```
Name:       Marcus Lindqvist
Age:        41
Location:   Stockholm, Sweden
Occupation: VP of Engineering at a 200-person fintech
Income:     N/A (enterprise buyer)
Tech level: Senior — former developer, now manages 40 engineers
Motivation: Upskill his team in Rust and distributed systems
Frustration: "We tried Udemy for Business. Completion rates were 12%.
             Nobody practiced. I can't show my board measurable outcomes."
Devices:    MacBook Pro, multiple monitors
Quote:      "I don't need courses. I need proof my team learned something."
```

**Marcus's journey on Cameron:**
1. Discovers Cameron through an enterprise sales outreach.
2. Schedules a demo. He sees the team dashboard: he can assign learning
   paths, set deadlines, and track completion and skill-assessment scores.
3. He purchases 40 Pro seats with SSO integration.
4. He creates a custom "Rust for Our Team" learning path combining
   existing Cameron courses with internal documentation links.
5. After three months, he pulls a compliance report: 34 of 40 engineers
   completed the path, average skill-assessment score 82%, time spent
   18 hours per engineer.
6. He renews and adds 20 more seats for the new hire cohort.

**Design implications:**
- The enterprise dashboard must be data-rich and exportable.
- SSO (SAML, OIDC) is a hard requirement for enterprise.
- Custom learning paths must allow mixing Cameron content with external links.
- Compliance reporting must be audit-ready.

---

## 5. Business Goals & KPIs

### North star metric

**Weekly Active Practitioners (WAP):** The number of unique users who
complete at least one practice exercise or coding challenge per week.

> **Why this metric?** It measures real engagement — not video views, not
> logins, but actual skill practice. It correlates directly with learning
> outcomes and, therefore, with retention and revenue.

### Primary KPIs

| KPI | Target (Year 1) | Target (Year 3) | Why it matters |
|---|---|---|---|
| Weekly Active Practitioners | 50,000 | 500,000 | North star — real engagement |
| Course completion rate | 35% | 45% | Content quality and learner success |
| Free-to-paid conversion | 4% | 7% | Monetization efficiency |
| Monthly churn (paid) | 8% | 5% | Product stickiness |
| Net Revenue Retention | 100% | 115% | Expansion (seats, upgrades) |
| Instructor retention | 80% | 90% | Supply-side health |
| NPS | 45 | 60 | Customer satisfaction |
| Time-to-first-code-run | < 10s | < 5s | Core experience quality |

### Secondary KPIs

- Day-1, Day-7, Day-30 retention rates
- Average sessions per week per active user
- Average XP earned per week per active user
- Streak survival rate (what % of 7-day streaks reach 14 days)
- Forum question response time (median)
- Certificate issuance rate
- Coding challenge attempt-to-pass ratio
- Instructor course publish lead time
- Enterprise seat utilization rate

### Anti-metrics (things we actively monitor to avoid)

- **Average session duration > 90 min without a practice action:** Indicates
  passive video bingeing, not learning.
- **Notification dismissal rate > 60%:** Indicates notifications are noise,
  not signal.
- **Streak anxiety events:** A spike in users signing out and not returning
  after losing a streak indicates the streak system is punishing, not
  motivating.

---

## 6. Competitive Analysis

### Competitive landscape

The online learning market is not a single market. It is a collection of
sub-markets, each served by platforms that excel in one dimension and fail in
others. Cameron's opportunity is the **intersection** no one occupies.

```
                        Practice-heavy
                             │
                    LeetCode │ Codecademy
                             │  DataCamp
            freeCodeCamp ────┼──── Cameron (target)
                             │
            Coursera         │
                    Udemy ───┼──── Khan Academy
                             │
                       ──────┼─────
                 Passive     │     Active
                 content     │     practice
```

### Platform-by-platform analysis

#### Udemy

| Dimension | Assessment |
|---|---|
| **Strengths** | Massive catalog (200k+ courses), low price, frequent sales, lifetime access, broad subject range |
| **Weaknesses** | No quality control — anyone can publish; no practice environment; no curriculum structure — learners must self-assemble; video-first with no exercises; completion rates estimated at < 5%; revenue share heavily favors the platform (37% organic, 3% marketplace) |
| **What Cameron learns** | Catalog breadth without quality is chaos. We enforce instructor vetting and require exercises in every programming course. Revenue share must be more favorable to attract quality instructors. |
| **What Cameron avoids** | The marketplace-first, quality-second model. Random pricing with fake discounts. |

#### Coursera

| Dimension | Assessment |
|---|---|
| **Strengths** | University partnerships, academic credibility, structured courses, certificates and degrees, financial aid |
| **Weaknesses** | Expensive ($39–79/month subscription or per-course); video-heavy with limited practice; peer-reviewed assignments are slow and low quality; forums are ghost towns; UI feels institutional and cold; courses are often outdated |
| **What Cameron learns** | Structure and credibility matter. We adopt structured learning paths and verified certificates. But we make the experience warm, interactive, and modern. |
| **What Cameron avoids** | The "digital university" aesthetic that feels like homework, not learning. The subscription-trap model where you pay while watching videos. |

#### Codecademy

| Dimension | Assessment |
|---|---|
| **Strengths** | In-browser code editor, interactive lessons, career paths, immediate feedback, clean UI |
| **Weaknesses** | Programming-only; limited to beginner/intermediate; no community depth; no instructor marketplace; content is proprietary (no external instructors); Pro tier is expensive ($24.99/month); no academic subjects |
| **What Cameron learns** | The in-browser editor with instant feedback is the gold standard for programming education. We adopt and extend it. Career paths are a proven model. |
| **What Cameron avoids** | The closed-content model. We allow external instructors to publish, creating a marketplace with quality control. We also expand beyond programming. |

#### freeCodeCamp

| Dimension | Assessment |
|---|---|
| **Strengths** | Completely free, comprehensive curriculum, project-based learning, real certifications, strong community, nonprofit mission |
| **Weaknesses** | Dated UI/UX; no video content; text-only lessons feel like reading documentation; no instructor marketplace; limited to programming; no advanced content; no enterprise tier |
| **What Cameron learns** | Free + structured curriculum + projects + certifications is a proven model. Community is essential. The nonprofit ethos builds trust. |
| **What Cameron avoids** | Text-only lessons and a dated interface. We combine video, text, and interactive practice. We also build a sustainable business model (freemium, not donation-dependent). |

#### LeetCode

| Dimension | Assessment |
|---|---|
| **Strengths** | Excellent coding challenge environment, instant test-case evaluation, leaderboards, company-specific question sets, discussion solutions, performance analytics |
| **Weaknesses** | No curriculum — it assumes you already know the concepts; interview-prep only, not learning; no video lessons; no community beyond solutions; no multi-subject; expensive premium ($35/month) |
| **What Cameron learns** | The challenge environment is best-in-class. We replicate it and integrate it into a curriculum so learners do not have to self-assemble. Leaderboards and performance analytics drive engagement. |
| **What Cameron avoids** | The curriculum-free, assume-you-already-know model. The interview-only focus. |

#### DataCamp

| Dimension | Assessment |
|---|---|
| **Strengths** | Interactive data science lessons, in-browser R/Python environments, career tracks, skill assessments, clean UI |
| **Weaknesses** | Data-only; expensive ($12.50–$25/month); no community features; no instructor marketplace; no video content; limited advanced content |
| **For our coding environment:** Cameron extends this model to all programming languages, adds video lessons, and adds community. |
| **What Cameron avoids** | The single-domain focus. The high price floor. |

#### Khan Academy

| Dimension | Assessment |
|---|---|
| **Strengths** | Free, excellent K-12 math/science content, interactive exercises, mastery-based progression, strong brand trust |
| **We respect Khan Academy's position in K-12 and do not compete directly in that segment during MVP or Beta.** Our academic content targets university-level and adult learners. |

### The gap Cameron fills

No single platform offers:

1. **Programming-first, multi-subject** — Codecademy/LeetCode are programming-
   only. Coursera/Khan are academic-first. Cameron is programming-first with
   academic depth.

2. **Curriculum + practice + community in one product** — Udemy has content
   but no practice. LeetCode has practice but no curriculum. Cameron has all
   three.

3. **Instructor marketplace with practice infrastructure** — Codecademy and
   DataCamp are closed-content. Udemy is open but has no practice tools.
   Cameron gives instructors a platform where their students actually practice.

4. **World-class design** — Most platforms have functional but uninspired
   design. Cameron's design is a competitive advantage — calm, focused, and
   built for long sessions.

5. **Fair revenue share** — Udemy takes 63% on organic sales (instructor
   gets 37%). Cameron offers 70% to instructors, creating a magnet for
   quality content creators.

---

## 7. Unique Selling Points

### USP 1: Practice-First Learning Loop

Every programming lesson follows the **Learn → Practice → Feedback** loop:
1. A concise video or text explanation (3–8 minutes).
2. An immediate hands-on exercise in the in-browser editor.
3. Instant test-case evaluation with AI-powered error explanations on failure.

> **Why this matters:** The spacing effect and retrieval practice are the two
> most evidence-backed learning techniques. By interleaving practice with
> content, we dramatically improve retention compared to video-only platforms.

### USP 2: Integrated Coding Environment

A full-featured, in-browser code editor (Monaco-based) with:
- Multi-language support (JavaScript, TypeScript, Python, Java, C++, Go, Rust,
  SQL, HTML/CSS).
- Syntax highlighting, autocomplete, and VS Code-style keybindings.
- Instant execution against test cases with stdout/stderr capture.
- AI-powered error explanations when code fails.

> **Why this matters:** The friction between "watch a video" and "try the
> code" is the #1 drop-off point in programming education. By eliminating
> that gap, we keep learners in flow.

### USP 3: Skill Trees, Not Just Courses

Instead of a flat catalog, Cameron organizes content into **skill trees** —
visual maps of skills and their dependencies. A learner sees "I need to
understand recursion before I can learn tree traversal" and the platform
recommends the exact path to get there.

> **Why this matters:** Adult learners need to see the map, not just the next
> step. Skill trees provide metacognitive awareness of their own learning
> progress.

### USP 4: Fair Instructor Economics

- **70% revenue share** (vs. Udemy's 37% on organic, 3% on marketplace).
- **Weekly payouts** (vs. monthly).
- **Transparent analytics** — instructors see exactly where learners drop off
  and which exercises are too hard.
- **Built-in practice tools** — instructors create exercises with test cases,
  not just videos.

> **Why this matter:** Quality instructors are the supply side. Better
> economics attract better instructors, which attracts more learners, creating
> a flywheel.

### USP 5: Learning Analytics for Learners

Learners get their own analytics dashboard: time invested, skills acquired,
strengths/weaknesses heatmap, predicted completion dates, and comparison with
peer cohorts.

> **Why this matters:** Metacognition — awareness of one's own learning
> process — is a strong predictor of learning success. We build it into the
> product.

### USP 6: Calm, Focused Design

The interface is designed for multi-hour study sessions:
- Muted color palette with a single accent color for actions.
- High-contrast text on warm-neutral backgrounds (not pure white, which causes
  fatigue).
- Generous whitespace, clear hierarchy, no visual clutter.
- "Focus mode" that hides all non-essential UI during lessons.
- Optional dark mode and "eye comfort" mode (reduced blue light).

> **Why this matters:** Learning platforms are used for hours at a time.
> Visual fatigue is a real problem that no competitor addresses deliberately.
> Design for long sessions is a silent competitive advantage.

---

## 8. Monetization Strategy

### Revenue streams

#### 8.1 Freemium subscription (primary)

| Plan | Price | Target | Key features |
|---|---|---|---|
| **Free** | $0 forever | Acquisition, top-of-funnel | All courses (preview lessons), free coding challenges, community forums, basic progress tracking |
| **Pro** | $20/month or $180/year (25% saving) | Individual serious learners | Unlimited full course access, certificates, downloadable resources, advanced analytics, ad-free, premium challenges, project reviews |
| **Max** | $70/month or $600/year (29% saving) | Power users, professionals | Everything in Pro + 1-on-1 mentorship credits (2/month), personalized AI learning paths, early access to new courses, priority support, career guidance, lifetime access to completed courses |

> **Pricing rationale:** The free tier is generous enough to be genuinely
> useful and to drive word-of-mouth. Pro at $20/month is competitive with
> Codecademy Pro ($25) and cheaper than DataCamp ($25) and Coursera ($39+).
> Max at $70/month is premium but justified by mentorship and personalization.

#### 8.2 Instructor revenue share

- Instructors receive **70% of revenue** from their courses.
- Cameron retains **30%** to cover platform costs, payment processing, and
  margin.
- For subscription revenue, Cameron allocates revenue to instructors
  proportionally based on learner engagement with their content (minutes
  practiced, exercises completed).

> **Why 70/30?** It is significantly better than Udemy (37/63 on organic)
> and competitive with Apple's App Store standard. It signals that Cameron
> values instructors and is not trying to extract maximum margin from
> content creators.

#### 8.3 Enterprise / Teams

| Tier | Price | Minimum | Key features |
|---|---|---|---|
| **Teams** | $15/seat/month | 5 seats | Team dashboard, learning paths, progress tracking, basic analytics |
| **Business** | $25/seat/month | 25 seats | SSO, advanced analytics, compliance reporting, custom paths, dedicated success manager |
| **Enterprise** | Custom | 100 seats | On-prem option, custom integrations, SLA, white-label, audit logs |

#### 8.4 Future revenue streams (Phase 3+)

| Stream | Description | Phase |
|---|---|---|
| Certificate verification | $20–50 per verified certificate (for non-subscribers) | Phase 2 |
| Marketplace transaction fee | 5% on third-party tools/resources sold through Cameron | Future |
| API platform | Developer access to Cameron's coding environment and content API | Future |
| Job board | Employers pay to post roles to Cameron's verified talent pool | Future |
| Sponsored content | Companies sponsor courses (e.g., "Rust course sponsored by AWS") | Future |

### Pricing philosophy

1. **Free forever, not free trial.** The free tier is a genuine product, not a
   time-limited demo. Learners can learn indefinitely without paying.
2. **Value-based, not cost-based.** Pro is priced based on the value of
   career advancement, not the cost of content delivery.
3. **Regional pricing.** Purchasing power parity pricing in emerging markets
   (e.g., Pro in India: $8/month, not $20).
4. **No dark patterns.** No fake discounts, no "only 2 left" pressure, no
   hiding the free tier. Cancellation is one click.
5. **Annual plans save money.** 25% on Pro, 29% on Max. This improves
   retention and reduces churn.

### Unit economics targets

| Metric | Target |
|---|---|
| Gross margin | 75%+ (digital delivery, low marginal cost) |
| CAC (consumer) | $12 (organic + content marketing) |
| CAC (enterprise) | $800 (outbound + sales) |
| LTV (Pro subscriber) | $180 (9-month average lifetime) |
| LTV:CAC (consumer) | 15:1 |
| Payback period | 2 months |

---

## 9. Branding Direction

### Brand name

**Cameron** — a clear, memorable name for a modern learning platform. Its
letterform logo pairs a learning mark with a play symbol, reinforcing progress
through guided, engaging education.

### Brand personality

| Trait | Expression |
|---|---|
| **Clear** | We explain hard things in plain language. Our UI is uncluttered. Our pricing is transparent. |
| **Encouraging** | We celebrate progress, not just completion. We nudge, we never shame. |
| **Substantial** | We are not flashy or hype-driven. We are the platform that respects your intelligence. |
| **Warm** | We are not a cold, institutional platform. We feel human and approachable. |
| **Curious** | We are learners ourselves. The platform evolves because we are always experimenting. |

### Visual identity direction

| Element | Direction |
|---|---|
| **Primary color** | Emerald green (#089a68) — growth, clarity, calm. Not the typical edtech blue. |
| **Secondary accent** | Deep blue (#1c66f1) — trust, focus, depth. |
| **Neutrals** | Warm ink palette (not pure black/white) — #1f2430 (ink-900) on #f6f7f9 (ink-50) for surfaces. Warm tones reduce fatigue vs. pure white. |
| **Typography** | Plus Jakarta Sans (headings — geometric, modern, friendly) + Inter (body — optimized for screen legibility) + JetBrains Mono (code). |
| **Iconography** | Lucide icon set — consistent stroke weight, clean, modern. |
| **Imagery** | Authentic photography of real learners and environments. No stock-photo clichés. Illustrations are geometric and purposeful, not decorative. |
| **Motion** | Subtle, purposeful animations (fade-up, float, hover lifts). No bouncing, no spinning loaders beyond 1s. Motion communicates state change, not decoration. |
| **Corner radius** | 12px (cards), 16px (containers), 24px (hero sections). Consistent, not random. |
| **Shadow system** | Soft, layered shadows (not harsh). `soft`, `card`, `lift`, `glow` — each with a purpose. |
| **Logo** | Code brackets `< >` with an internal slash, forming an abstract "L" — represents programming and learning. Emerald on white, white on emerald. |

### Tone of voice

| Context | Tone |
|---|---|
| **Marketing copy** | Confident but not arrogant. "Learn programming the clear way." |
| **Lesson content** | Conversational and precise. "Let's break this down" not "In this module, we will..." |
| **Error messages** | Helpful, not blaming. "That solution doesn't pass all tests yet. Here's what went wrong..." |
| **Notifications** | Informative, not demanding. "You're on a 7-day streak. Keep it going?" not "STREAK IN DANGER! ACT NOW!" |
| **Empty states** | Encouraging, not empty. "No courses here yet. Let's find your first one." |

### Brand anti-patterns (what we never do)

- No purple/indigo gradients (overused, generic AI aesthetic).
- No stock photos of people pointing at laptops.
- No fake countdown timers or urgency banners.
- No "AI-powered" as a buzzword without substance.
- No jargon-filled marketing copy.
- No condescending or infantile language.

---

## 10. Information Architecture

### IA principles

1. **Three-click rule (relaxed):** A user should reach any primary destination
   in ≤ 3 clicks from the homepage. Secondary destinations in ≤ 4.
2. **Role-based entry points:** The navigation adapts to the user's role
   (student, instructor, admin) so they never see irrelevant options.
3. **Progressive disclosure:** Complex features (analytics, instructor portal,
   admin tools) are hidden behind role-based entry points, not crammed into
   the main nav.
4. **Search is a first-class citizen:** The search bar is always accessible
   and supports fuzzy matching, filters, and natural-language queries.
5. **URL as UI:** Every page has a clean, bookmarkable URL. `/courses/react`,
   not `/course?id=123`. This supports SEO and shareability.

### Top-level IA structure

```
Cameron
├── Discover (public, no auth)
│   ├── Homepage
│   ├── Courses (catalog)
│   ├── Subjects (browse by subject)
│   ├── Roadmaps (learning paths)
│   ├── Challenges (coding challenges)
│   ├── Resources (articles & guides)
│   ├── Pricing
│   └── About
│
├── Learn (authenticated, student)
│   ├── Dashboard
│   ├── My Courses (enrolled)
│   ├── My Path (active roadmap)
│   ├── Skill Tree
│   ├── Practice (challenges & exercises)
│   ├── Certificates
│   ├── Bookmarks / Saved
│   └── Analytics
│
├── Community
│   ├── Forums
│   ├── Study Groups
│   ├── Leaderboard
│   └── Members directory
│
├── Instructor (role: instructor)
│   ├── Instructor Dashboard
│   ├── Course Builder
│   ├── Student Analytics
│   ├── Revenue & Payouts
│   └── Instructor Profile
│
├── Admin (role: admin)
│   ├── Admin Dashboard
│   ├── User Management
│   ├── Content Moderation
│   ├── Platform Analytics
│   ├── Financial Reports
│   └── Settings
│
├── Account
│   ├── Profile
│   ├── Settings
│   ├── Billing
│   ├── Notifications
│   └── Security
│
└── Auth
    ├── Sign In
    ├── Sign Up
    ├── Forgot Password
    └── Reset Password
```

### IA decision rationale

**Why separate "Discover" from "Learn"?**
Public discovery pages serve acquisition and SEO. Authenticated learning
pages serve retention and progress. Mixing them creates cognitive overhead
for new visitors (who do not need dashboard links) and friction for returning
learners (who do not need marketing copy). The split is clean and
role-appropriate.

**Why "Community" as a top-level section?**
Community is not a sub-page of a course. It is a platform-wide asset. Forums,
study groups, and leaderboards span all courses and subjects. Elevating it
to top-level signals its importance and makes it discoverable.

**Why not "Dashboard" as the homepage for authenticated users?**
Returning learners should see their dashboard, but the homepage should
remain a discoverable catalog for new and returning visitors. We use
**adaptive homepage behavior**: if a logged-in user with an active streak
visits `/`, they see a personalized greeting and quick links to continue
learning, but the catalog is still below. The homepage is never fully
replaced.

---

## 11. Complete Sitemap

### Public pages (no authentication)

| URL | Page | Purpose |
|---|---|---|
| `/` | Homepage | Platform value proposition, featured content, social proof, CTAs |
| `/courses` | Course catalog | Browse, search, filter all courses |
| `/courses/[slug]` | Course detail | Course overview, curriculum, instructor, reviews, enrollment |
| `/courses/[slug]/lesson/[lessonSlug]` | Lesson player | Video player + code editor + lesson content (auth required for full access) |
| `/subjects` | Subjects overview | Browse all subjects, grouped by category |
| `/subjects/[slug]` | Subject detail | Subject description, all courses in subject, related roadmaps |
| `/roadmaps` | Roadmaps overview | Browse all learning paths |
| `/roadmaps/[slug]` | Roadmap detail | Step-by-step path with progress tracking |
| `/challenges` | Coding challenges | Browse and filter coding challenges by topic, difficulty |
| `/challenges/[slug]` | Challenge player | Code editor + test cases + submit (auth for submission) |
| `/resources` | Articles & guides | Browse all articles |
| `/resources/[slug]` | Article detail | Full article content |
| `/instructors` | Instructor directory | Browse all instructors |
| `/instructors/[username]` | Instructor profile | Instructor bio, courses, ratings |
| `/pricing` | Pricing | Three plans, FAQ, comparison |
| `/about` | About | Mission, team, values, contact |
| `/terms` | Terms of service | Legal |
| `/privacy` | Privacy policy | Legal |
| `/login` | Sign in | Email/password authentication |
| `/signup` | Sign up | Account creation |
| `/forgot-password` | Forgot password | Password reset request |
| `/reset-password` | Reset password | Password reset form (token-based) |

### Authenticated student pages

| URL | Page | Purpose |
|---|---|---|
| `/dashboard` | Student dashboard | Continue learning, stats, recommendations, streak |
| `/my-courses` | Enrolled courses | All courses the user is enrolled in, with progress |
| `/my-courses/[slug]` | Course progress view | Per-course progress, next lesson, exercises |
| `/skill-tree` | Skill tree | Visual map of skills acquired and locked |
| `/practice` | Practice hub | All challenges and exercises, filtered by skill |
| `/practice/[slug]` | Practice detail | Individual challenge or exercise |
| `/certificates` | Certificates | All earned certificates, download/share |
| `/certificates/[id]` | Certificate view | Individual certificate, verification |
| `/bookmarks` | Bookmarks | Saved courses, lessons, articles |
| `/analytics` | Learning analytics | Time, skills, heatmap, predictions |
| `/profile/[username]` | Public profile | User's public learning profile |
| `/profile` | Private profile/settings | Edit name, bio, avatar, plan |
| `/settings` | Account settings | Email, password, notifications, privacy |
| `/settings/billing` | Billing | Plan, invoices, payment methods |
| `/settings/notifications` | Notification settings | Email/push/in-app notification preferences |
| `/settings/security` | Security | Password, 2FA, active sessions |
| `/settings/connected-accounts` | Connected accounts | GitHub, LinkedIn integration |
| `/messages` | Messages | DM list |
| `/messages/[conversationId]` | Conversation | Individual conversation |
| `/notifications` | Notifications | All notifications, mark read |

### Community pages

| URL | Page | Purpose |
|---|---|---|---|
| `/community` | Community hub | Forum categories, study groups, leaderboard preview |
| `/community/forums` | Forum index | All forum categories and recent threads |
| `/community/forums/[category]` | Forum category | Threads in a category |
| `/community/forums/[category]/[threadId]` | Forum thread | Threaded discussion, replies, code blocks |
| `/community/study-groups` | Study groups | Browse and join study groups |
| `/community/study-groups/[id]` | Study group | Group page, members, shared resources |
| `/community/leaderboard` | Leaderboard | Global, weekly, subject-specific rankings |
| `/community/members` | Member directory | Browse members, filter by skill/subject |

### Instructor pages

| URL | Page | Purpose |
|---|---|---|
| `/instructor` | Instructor dashboard | Course list, revenue summary, student metrics |
| `/instructor/courses` | My courses (instructor) | All courses created by this instructor |
| `/instructor/courses/new` | New course | Course creation wizard step 1 |
| `/instructor/courses/[id]/edit` | Course builder | Full course editing — modules, lessons, exercises, assessments |
| `/instructor/courses/[id]/analytics` | Course analytics | Enrollment, completion, drop-off, exercise pass rates |
| `/instructor/courses/[id]/students` | Student roster | All enrolled students, progress, engagement |
| `/instructor/revenue` | Revenue & payouts | Earnings, payout history, payout settings |
| `/instructor/profile` | Instructor profile edit | Bio, credentials, social links, payout settings |

### Admin pages

| URL | Page | Purpose |
|---|---|---|
| `/admin` | Admin dashboard | Platform metrics, flagged content, recent activity |
| `/admin/users` | User management | All users, search, filter, suspend, role changes |
| `/admin/users/[id]` | User detail | User profile, activity, roles, billing, moderation actions |
| `/admin/courses` | Course management | All courses, approve/reject, feature, unpublish |
| `/admin/courses/[id]` | Course detail (admin) | Full course view with moderation controls |
| `/admin/moderation` | Moderation queue | Flagged posts, reviews, courses, reported users |
| `/admin/moderation/[id]` | Moderation item | Detail view with action options |
| `/admin/analytics` | Platform analytics | Revenue, engagement, retention, funnels |
| `/admin/finance` | Financial reports | Revenue, instructor payouts, refunds, tax |
| `/admin/settings` | Platform settings | Feature flags, categories, pricing, email templates |

### Enterprise pages (Phase 3)

| URL | Page | Purpose |
|---|---|---|
| `/team` | Team dashboard | Team members, assigned paths, progress |
| `/team/members` | Member management | Add/remove, assign paths, view progress |
| `/team/paths` | Custom learning paths | Create and assign team-specific paths |
| `/team/analytics` | Team analytics | Completion rates, skill gaps, compliance reports |
| `/team/billing` | Team billing | Seats, invoices, payment methods |

### Error and system pages

| URL | Page | Purpose |
|---|---|---|
| `/404` | Not found | Friendly error, search, and navigation links |
| `/500` | Server error | Apologetic error, retry, and support link |
| `/403` | Forbidden | Permission denied, explanation |
| `/maintenance` | Maintenance mode | Scheduled downtime notice |

### Total page count

| Category | Count |
|---|---|---|
| Public | 21 |
| Authenticated student | 20 |
| Community | 8 |
| Instructor | 8 |
| Admin | 10 |
| Enterprise | 5 |
| Error/system | 4 |
| **Total** | **76** |

---

## 12. Navigation System

### Navigation principles

1. **Context-aware:** The navbar adapts to the user's role and current context.
   A student sees "Learn" options. An instructor sees "Teach" options. An
   admin sees "Manage" options.
2. **Always available:** The navbar is fixed to the top and accessible from
   every page except the lesson player (which has a minimal bar).
3. **Search-first:** A prominent search bar is always accessible, supporting
   fuzzy search across courses, subjects, challenges, articles, and community.
4. **Mobile-first:** On mobile, the navbar collapses to a hamburger menu
   with a bottom tab bar for key destinations (Home, Learn, Practice,
   Community, Profile).
5. **Breadcrumbs:** Every secondary page has breadcrumbs showing the user's
   location in the IA hierarchy.

### Desktop navigation (authenticated student)

```
┌─────────────────────────────────────────────────────────────────┐
│  Cameron.  Courses  Subjects  Roadmaps  Practice  Community   [🔍]  [🔔] [👤▾] │
└─────────────────────────────────────────────────────────────────┘
```

| Element | Behavior |
|---|---|
| Logo | Links to `/` |
| Courses | Dropdown: All Courses, by Category, Trending, New, Free |
| Subjects | Links to `/subjects` |
| Roadmaps | Links to `/roadmaps` |
| Practice | Links to `/challenges` |
| Community | Dropdown: Forums, Study Groups, Leaderboard |
| Search (🔍) | Opens command palette (Cmd/Ctrl+K) with fuzzy search |
| Notifications (🔔) | Opens notification dropdown with unread count badge |
| User menu (👤▾) | Avatar + plan badge → dropdown: Dashboard, Profile, Settings, Billing, Sign out |

### Desktop navigation (public / logged out)

```
┌─────────────────────────────────────────────────────────────────┐
│  Cameron.  Courses  Subjects  Roadmaps  Pricing  About    [🔍]  Sign in  [Get started] │
└─────────────────────────────────────────────────────────────────┘
```

### Mobile navigation

**Top bar (all pages):**
```
┌───────────────────────────────┐
│  Cameron.            [🔍]  [☰]   │
└───────────────────────────────┘
```

**Bottom tab bar (authenticated users, key pages):**
```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│   Home   │  Learn   │ Practice │Community │  Profile │
│   🏠     │   📚     │   ⚡     │   👥     │   👤     │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Hamburger menu (full nav):**
- Slides in from the right (80% width, max 320px).
- Contains all nav links organized by section.
- Auth state at bottom: Sign in/Sign up or avatar menu.
- Closes on link click or outside tap.

### Lesson player navigation (minimal)

During a lesson, the navbar is replaced by a minimal bar:
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to course    Lesson 3 of 12    [Focus mode]  [≡ Outline] │
└─────────────────────────────────────────────────────────────────┘
```

### Command palette (Cmd/Ctrl+K)

A keyboard-first search interface accessible from any page:
- Search courses, subjects, roadmaps, challenges, articles, community threads.
- Quick actions: "Continue last lesson," "Start a challenge," "View leaderboard."
- Navigation: jump to any page by typing its name.
- Recently visited pages.

### Breadcrumb pattern

Every non-top-level page includes breadcrumbs:
```
Home › Courses › React From Scratch › Lesson 3: useState
```
- Each segment is a link to its parent.
- On mobile, breadcrumbs collapse to just the parent link.

### Footer navigation

The footer contains:
- **Brand block:** Logo, tagline, social links.
- **Explore:** Courses, Subjects, Roadmaps, Practice, Resources.
- **Subjects:** Top 5 subjects + "View all."
- **Company:** About, Pricing, Careers, Blog, Contact.
- **Legal:** Terms, Privacy, Cookies.
- **CTA banner:** "Start learning today — for free."
- **Newsletter signup** (non-intrusive, single email field).

---

## 13. User Roles & Permissions

### Role definitions

| Role | Description | How acquired |
|---|---|---|---|
| **Guest** | Unauthenticated visitor | Default |
| **Student** | Authenticated learner | Signs up |
| **Instructor** | Content creator who publishes courses | Applies and is approved by admin |
| **Teaching Assistant (TA)** | Helps an instructor manage a course | Invited by an instructor |
| **Moderator** | Community moderation (forums, reviews) | Assigned by admin |
| **Admin** | Full platform management | Assigned by super admin |
| **Enterprise Admin** | Manages a team/organization | Purchases enterprise tier |
| **Enterprise Member** | Member of an enterprise team | Invited by enterprise admin |
| **Parent** (future) | Oversees a dependent learner's account | Creates a family account |

### Permission matrix

| Capability | Guest | Student | Instructor | TA | Moderator | Admin |
|---|---|---|---|---|---|---|
| Browse public content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enroll in courses | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Complete exercises & challenges | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Earn XP, badges, certificates | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Post in forums | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Message other users | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create courses | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Edit own courses | ❌ | ❌ | ✅ | ✅ (assigned) | ❌ | ✅ |
| View course analytics | ❌ | ❌ | ✅ | ✅ (assigned) | ❌ | ✅ |
| Grade assignments | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Publish courses | ❌ | ❌ | ✅ (with approval) | ❌ | ❌ | ✅ |
| Delete forum posts | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Ban users | ❌ | ❌ | ❌ | ❌ | ✅ (temp) | ✅ |
| Manage users | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage platform settings | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View financial reports | ❌ | ❌ | ✅ (own) | ❌ | ❌ | ✅ |
| Access admin panel | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Role assignment model

- A user can hold multiple roles simultaneously (e.g., Student + Instructor).
- Roles are stored in the `user_roles` table (see database architecture).
- The frontend checks roles via the auth context and renders/permits
  accordingly.
- The backend enforces all permissions via RLS policies and edge function
  guards — **never trust the frontend alone**.

### Role-based access control (RBAC) implementation

**Frontend:**
- The auth context exposes `user.roles: string[]`.
- Route guards check if the user has the required role.
- Navigation renders only links the user's roles permit.
- UI elements (buttons, tabs) are conditionally rendered based on permissions.

**Backend (Supabase RLS):**
- Tables have policies scoped to `auth.uid()` for ownership checks.
- Instructor-only tables (e.g., `course_drafts`) check `EXISTS (SELECT 1
  FROM user_roles WHERE user_id = auth.uid() AND role = 'instructor')`.
- Admin-only tables use SECURITY DEFINER functions callable only by users
  with the admin role.
- Edge functions validate the JWT and check roles before performing actions.

---

## 14. User Journeys

### Journey 1: New learner — first session (Maya)

```
Google search "learn JavaScript"
    │
    ▼
Landing on homepage
    │  → Sees hero: "Learn programming the clear way"
    │  → Sees featured courses, testimonials, stats
    │  → Clicks "Explore courses"
    ▼
Course catalog
    │  → Filters: Programming → JavaScript → Beginner
    │  → Sees "JavaScript Essentials" course
    │  → Clicks course card
    ▼
Course detail page
    │  → Reads description, curriculum, reviews
    │  → Sees "Start learning free" CTA
    │  → Clicks CTA
    ▼
Sign-up modal/page
    │  → Enters email, password, name
    │  → Account created, profile auto-created
    ▼
Onboarding flow (3 steps)
    │  → Step 1: "What do you want to learn?" → selects "Web Development"
    │  → Step 2: "What's your experience?" → selects "Complete beginner"
    │  → Step 3: "How much time per week?" → selects "5–10 hours"
    ▼
First lesson
    │  → Watches 6-min intro video
    │  → Code editor appears with a starter exercise
    │  → Writes first line of code, clicks "Run"
    │  → Test cases pass → confetti animation + 50 XP + "First Lines" badge
    ▼
Lesson complete
    │  → Sees progress bar: 1/62 lessons
    │  → "Next lesson" CTA
    │  → Sidebar shows curriculum outline
    ▼
Dashboard (next visit)
    │  → "Continue where you left off" card
    │  → Streak: 1 day
    │  → XP: 50
    │  → Recommended next: Lesson 2
```

**Key metrics for this journey:**
- Time from landing to first code run: < 5 minutes.
- Sign-up completion rate: > 60%.
- Day-1 retention: > 50%.

---

### Journey 2: Returning learner — daily practice (Daniel)

```
Push notification: "Your streak is at 12 days. Keep it going!"
    │
    ▼
Opens app → Dashboard
    │  → Sees "12-day streak" with flame icon
    │  → "Continue learning" card: next DSA lesson
    │  → Daily challenge suggestion: "Reverse a linked list"
    │  → Clicks daily challenge
    ▼
Challenge player
    │  → Code editor loads with problem description
    │  → Writes solution in Python
    │  → Runs tests: 10/12 pass, 2 edge cases fail
    │  → AI explanation: "Your loop doesn't handle empty input..."
    │  → Fixes code, reruns: 12/12 pass
    │  → Earns 120 XP, climbs 3 leaderboard spots
    ▼
Returns to dashboard
    │  → Streak: 13 days
    │  → XP today: 120
    │  → "Challenge of the day complete" checkmark
    │  → Suggested: Continue DSA course, Lesson 8
    ▼
Lesson player
    │  → Video: Trees and BSTs (8 min)
    │  → Exercise: Implement tree traversal
    │  → Completes exercise, earns 80 XP
    ▼
Session summary (on exit or after 30 min)
    │  → "Great session! 200 XP earned, 2 exercises completed."
    │  → "Come back tomorrow to keep your streak."
```

**Key metrics:**
- Streak survival rate (7d → 14d): > 40%.
- Daily challenge completion: > 30% of DAU.
- Average session: 20–40 min.

---

### Journey 3: Instructor — course creation (Dr. Amara)

```
Hears about Cameron from a colleague
    │
    ▼
Visits /about/instructors or clicks "Teach on Cameron" (footer)
    │  → Reads instructor benefits: 70% revenue, practice tools, analytics
    │  → Clicks "Apply to teach"
    ▼
Instructor application
    │  → Submits: bio, credentials, portfolio link, sample lesson (video or text)
    │  → Application goes to admin review queue
    ▼
Admin approval (within 48h)
    │  → Admin reviews application, approves
    │  → User gains "instructor" role
    │  → Email: "Welcome to Cameron Instructors!"
    ▼
Instructor onboarding
    │  → Guided tour of the instructor portal
    │  → "Create your first course" CTA
    ▼
Course creation wizard
    │  → Step 1: Course basics (title, subject, level, description)
    │  → Step 2: Course structure (modules → lessons → exercises)
    │  → Step 3: Upload content (video, text, exercise files)
    │  → Step 4: Assessment design (quizzes, assignments, test cases)
    │  → Step 5: Pricing (free, paid, or part of subscription)
    │  → Step 6: Preview and submit for review
    ▼
Admin course review
    │  → Admin checks quality, accuracy, completeness
    │  → Approves or sends feedback for revision
    ▼
Course published
    │  → Appears in catalog
    │  → Instructor notified
    │  → Analytics begin tracking
    ▼
Ongoing iteration
    │  → Instructor views analytics: drop-off at Lesson 4
    │  → Adds a supplementary video and adjusts exercise difficulty
    │  → Completion rate improves from 22% to 35%
```

**Key metrics:**
- Instructor application approval rate: > 60%.
- Course publish lead time: < 7 days from approval.
- Instructor monthly active: > 60% of approved instructors.

---

### Journey 4: Enterprise admin — team setup (Marcus)

```
Reaches out via enterprise sales form
    │
    ▼
Demo with sales team
    │  → Sees team dashboard, custom paths, analytics
    │  → Agrees to pilot with 10 seats
    ▼
Enterprise onboarding
    │  → Admin creates organization account
    │  → Configures SSO (SAML or OIDC)
    │  → Invites 10 team members via email or SSO
    │  → Assigns "Rust for Our Team" learning path
    ▼
Team members join
    │  → Each member signs in via SSO
    │  → Sees assigned learning path on dashboard
    │  → Begins courses and challenges
    ▼
Admin monitors (ongoing)
    │  → Team dashboard: 8/10 active, 3 completed module 1
    │  → Skill gap analysis: 4 members weak on "ownership and borrowing"
    │  → Assigns supplementary challenge set
    ▼
Quarterly review
    │  → Exports compliance report: completion %, skill scores, time spent
    │  → Presents to leadership
    │  → Renews and expands to 40 seats
```

---

## 15. Onboarding Flows

### 15.1 Student onboarding

**Trigger:** Account creation (sign-up form)

**Flow:**

```
Step 0: Sign-up form
    Email, password, optional name
    │
    ▼
Step 1: Welcome screen
    "Welcome to Cameron! Let's personalize your experience."
    [Continue] [Skip — I'll explore on my own]
    │
    ▼
Step 2: Goal selection
    "What brings you here?"
    □ Learn to code from scratch
    □ Level up my career
    □ Prepare for interviews
    □ Supplement my studies
    □ Just exploring
    │
    ▼
Step 3: Interest selection
    "What subjects are you interested in?"
    Grid of subject cards with icons — select 1–5
    (Programming, Math, Physics, Data Science, etc.)
    │
    ▼
Step 4: Experience level
    "How would you rate your experience?"
    Per selected subject: Beginner / Some / Comfortable / Advanced
    │
    ▼
Step 5: Time commitment
    "How much time can you dedicate per week?"
    □ 1–2 hours  □ 3–5 hours  □ 5–10 hours  □ 10+ hours
    │
    ▼
Step 6: Learning style (optional)
    "How do you learn best?"
    □ Video + practice  □ Text + practice  □ Pure practice
    │
    ▼
Step 7: Recommended path
    "Based on your answers, here's your starting point:"
    → Recommended roadmap (e.g., "Become a Web Developer")
    → Recommended first course
    → Estimated timeline
    [Start learning now] [Save and explore]
```

**Skip behavior:** If the user clicks "Skip," they go directly to the
dashboard with generic recommendations. Onboarding data can be completed
later from settings.

**Onboarding data usage:**
- `goal` → personalizes dashboard recommendations and email content.
- `interests` → populates "Recommended for you" on dashboard.
- `experience_level` → sets initial difficulty filtering and placement.
- `time_commitment` → sets daily/weekly XP goals and streak targets.
- `learning_style` → defaults lesson view to video or text.

### 15.2 Instructor onboarding

**Trigger:** First login after instructor role is granted

**Flow:**

```
Step 1: Welcome
    "Welcome to Cameron Instructors! You're now a creator."
    [Take the tour]
    │
    ▼
Step 2: Instructor profile setup
    "Let's set up your instructor profile."
    Bio, profile photo, social links, credentials
    │
    ▼
Step 3: Portal tour
    Guided overlay tour of:
    → Dashboard (revenue, enrollment metrics)
    → Course Builder (create courses)
    → Analytics (student engagement)
    → Revenue (payouts, earnings)
    │
    ▼
Step 4: Create first course
    "Ready to create your first course?"
    [Start course wizard] [I'll do this later]
```

### 15.3 Enterprise onboarding

**Trigger:** Enterprise admin first login

**Flow:**

```
Step 1: Organization setup
    Org name, logo, primary contact
    │
    ▼
Step 2: SSO configuration
    Choose SAML or OIDC
    Configure identity provider details
    Test connection
    │
    ▼
Step 3: Invite team
    Bulk invite via CSV or individual emails
    Assign default learning path
    │
   4th
    ▼
Step 4: Dashboard orientation
    Tour of team dashboard, analytics, reporting
```

### Onboarding design principles

1. **Never blocking.** Every step has a "Skip" option. We never gate the
   product behind a 10-step wizard.
2. **Progressive.** We ask for the minimum first (email, password), then
   optional personalization. We do not ask for name, bio, and avatar at
   sign-up.
3. **Value-first.** The user reaches their first lesson (or first code run)
   within 2 minutes of creating an account.
4. **Recoverable.** Onboarding data can be changed at any time from settings.
5. **Respectful.** No forced tutorials. The instructor portal tour is opt-in.
   We use subtle "hints" (dismissible tooltips) rather than mandatory tours.

---

## 16. Feature Prioritization

### Prioritization framework

We use a modified **RICE framework** (Reach × Impact × Confidence / Effort)
combined with **strategic alignment**:

- **Reach:** How many users does this feature affect?
- **Impact:** How much does it improve the core learning loop or revenue?
- **Confidence:** How confident are we in the impact estimate?
- **Effort:** Engineering person-weeks to build.
- **Strategic alignment:** Does it support a core principle (practice-first,
  feedback, community, etc.)?

### Priority tiers

| Tier | Label | Description |
|---|---|---|
| **P0** | Must-have for MVP | The product is broken without this. Blocks launch. |
| **P1** | Should-have for MVP | Significantly improves MVP quality. Ship if time allows. |
| **P2** | Beta features | Ship in Phase 2 after MVP is validated. |
| **P3** | Production features | Ship in Phase 3 for scale and differentiation. |
| **P4** | Future | Post-launch, based on data and user feedback. |

### Feature priority matrix

| Feature | Priority | Rationale |
|---|---|---|
| **Auth (email/password)** | P0 | Required for any personalized experience |
| **Course catalog & detail pages** | P0 | Core discovery surface |
| **Lesson player (video + text)** | P0 | Core consumption surface |
| **In-browser code editor** | P0 | Core differentiator — practice-first |
| **Test-case evaluation** | P0 | Feedback loop — the product's core value |
| **Course progress tracking** | P0 | Learners must see progress |
| **XP & streaks** | P0 | Basic gamification for retention |
| **Community forums** | P0 | Community is a core principle |
| **Subscription billing (Free/Pro/Max)** | P0 | Revenue |
| **Search & filtering** | P0 | Findability in a multi-subject catalog |
| **Student dashboard** | P0 | Returning learner entry point |
| **Onboarding flow** | P1 | Improves activation and personalization |
| **Coding challenges (standalone)** | P1 | Extends practice beyond courses |
| **Quizzes & assessments** | P1 | Check-for-understanding within lessons |
| **Roadmaps (learning paths)** | P1 | Already built — enhances structure |
| **Notifications (in-app + email)** | P1 | Retention and engagement |
| **Leaderboards** | P1 | Gamification depth |
| **Badges & achievements** | P1 | Gamification depth |
| **Reviews & ratings** | P1 | Social proof and quality signal |
| **Bookmarks / saved items** | P1 | Convenience |
| **Profile (public + private)** | P1 | Identity and community |
| **Responsive design** | P0 | Mobile traffic is 40%+ of visits |
| **Accessibility (WCAG 2.1 AA)** | P0 | Non-negotiable |
| **SEO optimization** | P0 | Organic acquisition is primary channel |
| **Instructor course builder** | P2 | Supply-side — needed for marketplace |
| **Assignments** | P2 | Deeper assessment beyond quizzes |
| **Certificates** | P2 | Credential value for learners |
| **Instructor analytics** | P2 | Instructor retention and quality |
| **Admin dashboard** | P2 | Platform management at scale |
| **Content moderation tools** | U+P2 | Community safety at scale |
| **Messaging (DMs)** | P2 | Community depth |
| **AI error explanations** | P2 | Feedback quality |
| **AI tutor / assistant** | P3 | Differentiation and personalization |
| **Skill trees** | P2 | Visual progression |
| **Learning analytics dashboard** | P2 | Metacognition |
| **Study groups** | P3 | Community depth |
| **Peer code review** | P3 | Community + feedback |
| **Mentorship matching** | P3 | Max plan value |
| **Enterprise tier** | P3 | Revenue diversification |
| **Mobile app (native)** | P3 | Mobile experience depth |
| **Multi-language UI** | P3 | International expansion |
| **Parental accounts** | P4 | K-12 segment |
| **Job board** | P4 | Revenue + retention |
| **API platform** | P4 | Developer ecosystem |
| **AI code review** | P4 | Advanced feedback |
| **Live coding sessions** | P4 | Real-time instruction |
| **AR/VR learning** | P4 | Future technology |
| **Offline mode** | P4 | Emerging markets |

---

## 17. MVP Scope

### MVP definition

The MVP is the smallest product that delivers the **core value proposition**:
structured programming courses with in-browser practice and instant feedback,
plus basic gamification and community, at a price point that generates
revenue.

### MVP feature list

| # | Feature | Description |
|---|---|---|
| 1 | Auth (email/password) | Sign up, sign in, sign out, password reset |
| 2 | Student onboarding | 5-step personalization flow (skippable) |
| 3 | Course catalog | Browse, search, filter courses by subject/level/duration |
| 4 | Course detail page | Overview, curriculum, instructor, reviews, enroll CTA |
| 5 | Lesson player | Video player + text content + in-browser code editor + test evaluation |
| 6 | In-browser code editor | Monaco-based, multi-language, syntax highlighting, autocomplete |
| 7 | Test-case evaluation | Run code against predefined test cases, show pass/fail |
| 8 | Course progress tracking | Mark lessons complete, show progress bar and percentage |
| 9 | XP & streaks | Earn XP for actions, track daily streak, show on dashboard |
| 10 | Student dashboard | Continue learning, stats, recommendations, streak |
| 11 | Community forums | Threaded discussions, categories, code blocks, voting |
| 12 | Subscription billing | Free/Pro/Max plans via Stripe, plan switching |
| 13 | Search & filtering | Course catalog search, subject/level/category filters |
| 14 | Responsive design | All pages work on mobile, tablet, desktop |
| 15 | Accessibility | WCAG 2.1 AA compliance |
| 16 | SEO | Server-rendered public pages, meta tags, sitemap.xml |

### MVP success criteria

| Criterion | Target |
|---|---|
| Sign-up to first code run | < 5 minutes |
| Day-1 retention | > 50% |
| Day-7 retention | > 25% |
| Course completion rate | > 30% |
| Free-to-paid conversion | > 3% |
| Coding challenge pass rate | > 60% on first attempt |
| Forum response time (median) | < 4 hours |
| Lighthouse performance score | > 90 |
| WCAG 2.1 AA compliance | 100% of public pages |

### MVP out of scope (explicitly excluded)

- Instructor course builder (MVP uses Cameron-authored content only)
- Assignments and manual grading
- Certificates (deferred to Beta)
- Admin panel (managed via database tools initially)
- Messaging/DMs
- Enterprise tier
- Mobile app (responsive web only)
- AI features (beyond basic error messages)
- Study groups, mentorship, peer review
- Multi-language UI
- Parental accounts

> **Why these exclusions:** The MVP validates the core hypothesis: "Will
> learners engage with practice-first programming courses and pay for
> premium features?" Everything else is a distraction from answering that
> question. Instructor tools come in Beta because the MVP uses
> Cameron-authored content — we need to validate demand before building the
> supply side.

---

## 18. Long-Term Roadmap

### Phase 1: MVP (Months 1–3)

**Goal:** Validate the core practice-first learning loop with
Cameron-authored content.

| Workstream | Deliverables |
|---|---|---|
| Auth & user management | Email/password auth, onboarding, profile, settings |
| Course infrastructure | Catalog, detail pages, lesson player, progress tracking |
| Code environment | In-browser editor (Monaco), multi-language execution, test-case evaluation |
| Gamification | XP, streaks, basic badges, dashboard |
| Community | Forums with categories, threads, replies, voting |
| Billing | Stripe integration, Free/Pro/Max plans, plan switching |
| Public site | Homepage, subjects, roadmaps, pricing, about, SEO |
| Design system | Component library, design tokens, responsive grid |
| Infrastructure | Supabase schema, RLS policies, edge functions, file storage |

### Phase 2: Beta (Months 4–8)

**Goal:** Open the supply side (instructor marketplace) and deepen the
learning experience with assessments, certificates, and advanced
gamification.

| Workstream | Deliverables |
|---|---|---|
| Instructor portal | Course builder wizard, lesson/exercise creation, test-case authoring |
| Instructor analytics | Enrollment, completion, drop-off, exercise pass rates |
| Instructor economics | Revenue share calculation, payout system, earnings dashboard |
| Assessments | Quizzes (multiple choice, code output prediction), assignments, exams |
| Certificates | Certificate generation, verification, sharing, LinkedIn integration |
| Advanced gamification | Skill trees, levels, leaderboards (global/weekly/subject), badge system |
| Notifications | In-app, email, push (web push API), notification preferences |
| Messaging | DMs between users, conversation list, message states |
| Admin panel | User management, course approval, moderation queue, platform analytics |
| Content moderation | Flagging, review queue, automated spam detection |
| AI error explanations | AI-powered explanations when code fails test cases |
| Reviews & ratings | Star ratings + written reviews on courses, helpful votes |
| Learning analytics | Learner-facing analytics: time, skills, heatmap, predictions |

### Phase 3: Production (Months 9–18)

**Goal:** Scale the platform with AI, enterprise, and mobile.

| Workstream | Deliverables |
|---|---|---|
| AI tutor | Conversational AI assistant for debugging, explanations, hints |
| AI personalized paths | ML-driven learning path recommendations based on behavior |
| Enterprise tier | Team dashboard, SSO, custom paths, compliance reporting |
| Mobile app | React Native app with offline lesson caching |
| Multi-language UI | i18n with 5+ languages |
| Study groups | Cohort-based learning with shared progress, group chat |
| Peer code review | Structured review system for projects and challenges |
| Mentorship matching | Max plan feature — match learners with mentors |
| Career services | Resume review, interview prep, job board |
| API platform | Public API for coding environment and content |
| Performance optimization | CDN, edge caching, code splitting, image optimization |
| Accessibility audit | Third-party audit, screen reader testing, keyboard navigation |

### Phase 4: Future (Months 19+)

**Goal:** Expand the platform's reach and capabilities.

| Workstream | Deliverables |
|---|---|---|
| Enterprise advanced | White-label, on-prem, custom integrations, SLA |
| Parental accounts | Family accounts, dependent learners, parental oversight |
| Schools & institutions | Classroom management, gradebook integration, bulk licensing |
| Live coding sessions | Real-time collaborative coding, live office hours |
| AR/VR learning | Immersive content for specific subjects (anatomy, chemistry) |
| Marketplace for tools | Third-party tools and resources sold through Cameron |
| AI code review | Automated code quality feedback on projects |
| Adaptive learning | Difficulty adjustment based on real-time performance |
| Blockchain certificates | Verifiable, tamper-proof certificates on blockchain |
| Voice-based learning | Audio lessons, voice-controlled navigation |
| Emerging markets | Offline mode, low-bandwidth video, SMS-based notifications |

### Roadmap visualization

```
Phase 1 (M1–M3)          Phase 2 (M4–M8)            Phase 3 (M9–M18)           Phase 4 (M19+)
─── MVP ──────────────────── Beta ────────────────────── Production ─────────────── Future ────

Auth & Onboarding    Instructor Portal         AI Tutor                  Enterprise Advanced
Course Infrastructure  Assessments             Enterprise Tier           Parental Accounts
Code Environment     Certificates              Mobile App                Schools & Institutions
Gamification (basic) Advanced Gamification      Multi-language UI         Live Coding Sessions
Community Forums     Notifications              Study Groups              AR/VR Learning
Billing              Messaging                 Peer Code Review          Marketplace
Public Site          Admin Panel               Mentorship                AI Code Review
Design System        AI Error Explanations     Career Services           Adaptive Learning
Infrastructure       Reviews & Ratings         API Platform              Blockchain Certs
                     Learning Analytics        Performance Optimization  Voice Learning
                                               Accessibility Audit       Emerging Markets
```

---

## 19. Functional Requirements

### 19.1 Authentication & Account Management

| Req ID | Requirement | Priority |
|---|---|---|---|
| AUTH-001 | Users can sign up with email and password | P0 |
| AUTH-002 | Users can sign in with email and password | P0 |
| AUTH-003 | Users can sign out from any page | P0 |
| AUTH-004 | Users can request a password reset via email | P0 |
| AUTH-005 | Users can reset their password with a token | P0 |
| AUTH-006 | Sessions persist across browser restarts | P0 |
| AUTH-007 | The platform auto-creates a profile row on sign-up | P0 |
| AUTH-008 | Onboarding flow collects goal, interests, experience, time commitment | P1 |
| AUTH-009 | Users can update their name and avatar from settings | P1 |
| AUTH-010 | Users can change their password | P1 |
| AUTH-011 | Users can delete their account and all associated data | P1 |
| AUTH-012 | Users can connect GitHub and LinkedIn accounts | P2 |
| AUTH-013 | 2FA via authenticator app | P2 |
| AUTH-014 | SSO (SAML/OIDC) for enterprise | P3 |
| AUTH-015 | Social sign-in (Google, GitHub) | P2 |

### 19.2 Course Discovery & Consumption

| Req ID | Requirement | Priority |
|---|---|---|---|
| COURSE-001 | Course catalog with search and filtering | P0 |
| COURSE-002 | Course detail page with overview, curriculum, reviews | P0 |
| COURSE-003 | Users can enroll in a course (free or paid) | P0 |
| COURSE-004 | Lesson player with video, text, and code editor | P0 |
| COURSE-005 | Lessons can be marked complete | P0 |
| COURSE-006 | Course progress is tracked and shown as percentage | P0 |
| COURSE-007 | Users can resume from the last completed lesson | P0 |
| COURSE-088 | Curriculum shows free vs. locked lessons | P0 |
| COURSE-009 | Video player supports play/pause, speed, quality, captions | P0 |
| COURSE-010 | Users can bookmark lessons and courses | P1 |
| COURSE-011 | Course content is organized into modules and lessons | P0 |
| COURSE-012 | Lessons can include downloadable resources (PDF, code files) | P1 |
| COURSE-013 | Users can leave a star rating and written review after completing ≥ 30% | P1 |
| COURSE-014 | Course recommendations on dashboard based on history | P1 |
| COURSE-015 | Related courses shown on course detail page | P1 |

### 19.3 Code Editor & Practice

| Req ID | Requirement | Priority |
|---|---|---|---|
| CODE-001 | In-browser code editor (Monaco) with syntax highlighting | P0 |
| CODE-002 | Multi-language support: JavaScript, Python, Java, C++, SQL, HTML/CSS | P0 |
| CODE-003 | Code execution against test cases with stdout/stderr capture | P0 |
| CODE-004 | Test results show pass/fail per test case | P0 |
| Code-005 | Execution time and memory usage displayed | P1 |
| CODE-006 | AI-powered error explanation when code fails | P2 |
| CODE-007 | VS Code-style keybindings (default) | P0 |
| CODE-008 | Code formatting (Prettier) and linting | P1 |
| CODE-009 | Theme: light, dark, and high-contrast | P0 |
| CODE-010 | Resizable editor/output panels | P0 |
| CODE-011 | "Reset to starter code" button | P0 |
| CODE-012 | Code is auto-saved per user per exercise | P0 |
| CODE-013 | Standalone coding challenges (separate from courses) | P1 |
| CODE-014 | Challenge difficulty levels: easy, medium, hard, expert | P1 |
| CODE-015 | Challenge categories: arrays, strings, trees, DP, etc. | P1 |
| CODE-016 | Challenge submission history and retry | P1 |
| CODE-017 | Performance analytics: percentile rank, time-to-solve | P2 |
| CODE-018 | Multi-file project environment (for advanced courses) | P2 |
| CODE-019 | Live collaboration (pair programming) | P4 |
| CODE-020 | Custom test case input by the learner | P1 |

### 19.4 Gamification

| Req ID | Requirement | Priority |
|---|---|---|---|
| GAME-001 | XP awarded for lesson completion, exercise pass, challenge solve | P0 |
| LEVEL-001 | Levels derived from total XP with increasing thresholds | P0 |
| GAME-002 | Daily streak tracking with visual indicator | P0 |
| GAME-003 | Streak freeze (1 per month for free, 3 for Pro) | P1 |
| GAME-004 | Badges for milestones (first lesson, 7-day streak, 10 courses, etc.) | P1 |
| GAME-005 | Leaderboard (global, weekly, per subject) | P1 |
| GAME-006 | Skill tree visualization showing acquired and locked skills | P2 |
| GAME-007 | Daily challenge with bonus XP | P1 |
| GAME-008 | Level-up animation and notification | P1 |
| GAME-009 | XP history log | P2 |
| GAME-010 | Streak milestone celebrations (7, 30, 100 days) | P1 |

### 19.5 Community

| Req ID | Requirement | Priority |
|---|---|---|---|
| COMM-001 | Forum categories organized by subject and general topics | P0 |
| COMM-002 | Threaded discussions with rich text and code blocks | P0 |
| COMM-003 | Upvote/downvote on posts and replies | P0 |
| COMM-004 | Mark answer as solution (Q&A style) | P0 |
| COMM-005 | Search forum threads | P1 |
| COMM-006 | Report posts for moderation | P1 |
| COMM-007 | Pin threads (moderator/admin) | P1 |
| COMM-008 | Study groups with shared progress | P3 |
| COMM-009 | Member directory with skill/subject filters | P2 |
| COMM-010 | DM messaging between users | P2 |
| COMM-011 | Notification on reply, mention, or message | P1 |
| COMM-012 | Code syntax highlighting in forum posts | P0 |
| COMM-013 | Image upload in posts | P1 |

### 19.6 Billing & Subscriptions

| Req ID | Requirement | Priority |
|---|---|---|---|
| BILL-001 | Three plans: Free ($0), Pro ($20/mo), Max ($70/mo) | P0 |
| BILL-002 | Stripe Checkout for subscription payment | P0 |
|BILL-003 | Plan upgrade and downgrade from pricing page or settings | P0 |
| BILL-004 | Annual billing option (25% Pro, 29% Max) | P1 |
| BILL-005 | Invoice generation and download | P1 |
| BILL-006 | Payment method management | P1 |
| BILL-007 | Proration on plan changes | P1 |
| BILL-008 | Coupons and promotional codes | P2 |
| BILL-009 | Regional pricing (purchasing power parity) | P2 |
| BILL-010 | Instructor revenue share calculation and payout | P2 |
| BILL-011 | Enterprise billing (per-seat, annual contract) | P3 |
| BILL-012 | Refund processing | P2 |

### 19.7 Notifications

| Req ID | Requirement | Priority |
|---|005|---|---|
| NOTIF-001 | In-app notification bell with unread badge count | P1 |
| NOTIF-002 | Notification types: streak reminder, reply, mention, badge earned, course update | P1 |
| NOTIF-003 | Email notifications (digest and transactional) | P1 |
| NOTIF-004 | Web push notifications (opt-in) | P2 |
| NOTIF-005 | Notification preferences per type and channel | P1 |
| NOTIF-006 | Mark notifications as read individually or all | P1 |
| NOTIF-007 | Notification grouping (e.g., "3 new replies in your thread") | P2 |
| NOTIF-004a | Streak reminder sent at user's preferred time | P1 |
| NOTIF-008 | Weekly progress digest email | P2 |
| NOTIF-009 | Quiet hours setting | P2 |

### 19.8 Instructor Tools

| Req ID | Requirement | Priority |
|---|---|---|---|
| INST-001 | Instructor application and approval workflow | P2 |
| INST-002 | Course creation wizard (basics → structure → content → pricing → review) | P2 |
| INST-003 | Lesson creation: video upload, text content, exercise with test cases | P2 |
| INST-004 | Module and lesson reordering (drag-and-drop) | P2 |
| INST-005 | Course preview before publishing | P2 |
| INST-006 | Course submission for admin review | P2 |
| INST-006a | Admin approval or feedback for course review | P2 |
| INST-007 | Instructor dashboard: enrollment, revenue, ratings | P2 |
| INST-008 | Course analytics: completion rate, drop-off, exercise pass rates | P2 |
| INST-009 | Student roster with per-student progress | P2 |
| INST-010 | Revenue dashboard with payout configuration | P2 |
| INST-011 | Teaching assistant invitation and management | P3 |
| INST-012 | Assignment creation and manual grading | P3 |
| INST-013 | Coupon creation for own courses | P3 |

### 19.9 Admin Tools

| Req ID | Requirement | Priority |
|---|---|---|---|---|
| ADMIN-001 | Admin dashboard with platform-wide metrics | P2 |
| ADMIN-002 | User management: search, filter, suspend, ban, role assignment | P2 |
| ADMIN-003 | Course management: approve, reject, feature, unpublish | P2 |
| ADMIN-004 | Moderation queue: flagged posts, reviews, courses | P2 |
| ADMIN-005 | Platform analytics: revenue, engagement, retention, funnels | P2 |
| ADMIN-006 | Financial reports: revenue, payouts, refunds | P2 |
| ADMIN-007 | Feature flags and platform settings | P2 |
| ADMIN-008 | Email template management | P3 |
| ADMIN-009 | Category and tag management | P2 |
| ADMIN-010 | Instructor application review | P2 |

### 19.10 Accessibility

| Req ID | Requirement | Priority |
|---|---|---|---|
| A11Y-001 | All pages meet WCAG 2.1 AA | P0 |
| A11Y-002 | Keyboard navigation on all interactive elements | P0 |
| A11Y-003 | Screen reader support with proper ARIA labels | P0 |
| A11Y-004 | Color contrast ≥ 4.5:1 for text, ≥ 3:1 for large text | P0 |
| A11Y-005 | Focus indicators visible on all focusable elements | P0 |
| A11Y-006 | Skip-to-content link on every page | P0 |
| A501Y-007 | Form labels and error messages are screen-reader friendly | P0 |
| A11Y-008 | Video captions and transcripts | P1 |
| A11Y-009 | prefers-reduced-motion support | P0 |
| A11Y-010 | Dark mode and high-contrast theme | P1 |

### 19.11 SEO

| Req ID | Requirement | Priority |
|---|---|---|---|
| SEO-001 | Clean, semantic URLs | P0 |
| SEO-002 | Meta title and description per page | P0 |
| SEO-003 | Open Graph and Twitter Card tags | P0 |
| SEO-004 | Sitemap.xml generation | P0 |
| SEO-005 | robots.txt | P0 |
| SSR or SSG for public pages | SSR/SSG | P0 |
| SEO-006 | Structured data (JSON-LD) for courses | P1 |
| SEO-007 | Canonical URLs | P0 |
| SEO-008 | Breadcrumbs with structured data | P1 |
| SEO-009 | Fast LCP (< 2.5s) | P0 |
| SEO-010 | Image alt text | P0 |

### 19.12 Performance

| Req ID | Requirement | Priority |
|---|--- execution|---|---|
| PERF-001 | Lighthouse performance score > 90 | P0 |
| PERF-002 | LCP < 2.5s on all public pages | P0 |
| PERF-003 | FID < 100ms | P0 |
| PERF-004 | CLS < 0.1 | P0 |
| PERF-005 | Code splitting per route | P0 |
| PERF-006 | Image optimization (WebP, lazy loading) | P0 |
| PERF-007 | Bundle size < 300KB gzipped (initial) | P0 |
| Core Web Vitals (all green) | All green | P0 |
| PERF-008 | API response time < 200ms (p95) | P0 |
| PERF-009 | Code editor loads in < 2s | P0 |
| PERF-010 | Code execution response < 5s (p95) | P0 |

### 19.13 Security

| Req ID | Requirement | Priority |
|---|---|---|---|---|
| SEC-001 | RLS on all database tables | P0 |
| SEC-002 | Auth check on every API/edge function | P0 |
| SEC-003 | Input validation and sanitization on all user inputs | P0 |
| SEC-004 | XSS prevention (React's built-in escaping, no dangerouslySetInnerHTML) | P0 |
| SEC-00 SECURITY-005 | CSRF protection on state-changing operations | P0 |
| SEC-006 | Rate limiting on auth endpoints (5 attempts / 10 min) | P0 |
| SEC-007 | Rate limiting on code execution (20 / hour for free, 100/hour Pro) | P0 |
| SEC-008 | Secure storage of API keys and secrets (never in client code) | P0 |
| SEC-009 | Content Security Policy headers | P1 |
| SEC-010 | Audit logging for admin actions | P2 |
| SEC-011 | 2FA support | P2 |
| SEC-012 | Session timeout and refresh token rotation | P0 |

### 19.14 File Storage

| Req ID | Requirement | Phase |
|---|---|---|---|
| FILE-001 | Supabase Storage for video, images, documents | P0 |
| JWT-authenticated storage access | JWT auth | P0 |
| FILE-003 | Public bucket for course thumbnails and avatars | P0 |
| FILE-004 | Private bucket for premium content (video, downloads) | P1 |
| FILE-005 | File size limits and type validation | P0 |
| FILE-006 | Image optimization and resizing on upload | P1 |
| FILE-007 | CDN delivery for all public assets | P0 |
| FILE-008 | Resumable uploads for large video files | P2 |

### 19.15 Analytics & Reporting

| Req ID | Requirement | Phase |
|---|---|---|---|
| ANA-001 | Learner analytics: time spent, skills, XP history | P2 |
| ANA-002 | Skill heatmap (strengths/weaknesses by topic) | P2 |
| ANA-003 | Instructor analytics: enrollment, completion, drop-off | P2 |
| ANA-004 | Admin platform analytics: DAU, WAU, revenue, funnels | P2 |
| ANA-005 | Enterprise team analytics: completion, skill gaps | P3 |
| ANA-006 | Event tracking for product analytics (PostHog/similar) | P1 |
| ANA-007 | Cohort retention analysis | P2 |
| ANBA-008 | Export to CSV/Excel | P2 |

### 19.16 AI Features

| Req ID | Requirement | Phase |
|---|---|---|---|
| AI-001 | AI error explanation when code fails test cases | P2 |
| AI-002 | AI tutor: conversational debugging and concept explanation | P3 |
| AI-003 | AI personalized learning path recommendation | P3 |
| AI-004 | AI quiz generation from course content | P3 |
| AI-005 | AI content summarization for lessons | P4 |
| AI-006 | AI code review for projects | P4 |
| AI-007 | AI adaptive difficulty (adjust based on performance) | P4 |

---

## Document Control

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Production-ready |
| Next part | Part 2: Design System & Page-by-Page UI Specifications |
| Dependencies | Existing codebase (Cameron public site + auth + pricing + profile) |

---

> This document is the definitive product strategy foundation for the Cameron
> platform. It is structured so that a product, engineering, and design team
> can begin implementation immediately. Part 2 will cover the complete design
> system, component library, and page-by-page UI specifications with all
> states, edge cases, and responsive behavior.
