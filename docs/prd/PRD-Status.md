# Physical OS / SomaticBuilding — Current PRD Status

Last updated: 2026-05-05 (Asia/Shanghai)

Regression checklist:
- `docs/prd/E2E-REGRESSION-CHECKLIST.md` (created 2026-04-16)

## 0. 2026-05-09 Performance & Backend Engineering Update
- Completed core-chain gateway load test evidence for graduation-defense readiness.
- Added Redis hotspot cache for exercise list endpoint:
  - `backend/exercise-service/src/main/java/com/somaticbuilding/exercise/application/ExerciseListCacheService.java`
  - wired in `ExerciseController` list path.
- Added Micrometer + Prometheus observability in `exercise-service`:
  - `GET /actuator/prometheus`
  - cache counters and payload metrics (`hit/miss/write/payload-bytes`) verified.
- Gateway-path load tests completed with strict A/B (cache off vs cache on), 5m each at `20/50/100` VUs:
  - Before/After comparison report:
    - `docs/performance/reports/2026-05-09-gateway-cache-loadtest.md`
    - `docs/performance/reports/gateway_exercise_list_cache_comparison.csv`
    - `docs/performance/reports/gateway_exercise_list_cache_comparison.md`
- Core-chain previous optimization report (SQL index + N+1 elimination) remains available:
  - `docs/performance/reports/2026-05-09-exercise-core-chain-loadtest.md`
- Current conservative capacity statement (single-node local):
  - list endpoint gateway path sustained `100` VUs/5m, `p95=34.54ms`, `error=0%`, `~4094 req/s`.

## 0. 2026-05-05 Update
- Exercise library card covers now prefer static images only.
- Removed the front-end GIF-as-cover fallback; GIFs remain detail/demo playback only.
- Added `scripts/backfill-exercise-cover-images.mjs` and backfilled 281 placeholder covers from `wrkout/exercises.json`.
- Added `scripts/backfill-exercise-covers-from-video.mjs` and backfilled the remaining 95 placeholders by extracting static frames from existing exercise video sources.
- Added workout template short-link sharing (Base62):
  - backend APIs for `template -> shareCode` and `shareCode -> template detail`
  - module/course sharing entry in training pages
  - shared template landing route: `/share/template/:shareCode`
- TrainingHub continuity loop was completed for real daily usage:
  - writes pending completion marker when leaving workout player
  - auto-checks today as done on workout summary page when program/day assignment matches
  - evening unfinished-session reminder modal after 19:00 (with per-day acknowledgement)
  - high-risk alert acknowledgement keyed by local date
- Program day resolution now uses local time ticks for active-week selection to avoid cross-midnight drift while app stays open.
- Evening reminder subtitle was normalized to clean joined labels (`Module · Course · Focus`) with empty-state-safe rendering.
- Fixed malformed keyword string literals in `WorkoutSetupPage.tsx` (restored valid bilingual load keywords), removing build-breaking parse errors.
- Current cover counts after backfill:
  - total active cover rows: 1250
  - wrkout-backed covers: 281
  - local frame-extracted covers: 95
  - remaining placeholder covers: 0
- Frontend build verification passed in `D:\\somaticBuilding` (`corepack pnpm build`).

## 0. 2026-05-04 Update
- Exercise media was shifted toward safe online sources:
  - `wger` direct video URLs are still supported.
  - `ExerciseDB` GIFs are now indexed in bulk via `after` pagination and cached locally for reuse.
- `scripts/migrate-exercise-videos-to-remote.mjs` was refactored to avoid rate-limited per-item search calls.
- Migration has been executed in two safe passes:
  - pass 1: replaced 458 local auto-generated rows
  - pass 2: replaced 333 local auto-generated rows after stricter fallback matching
- Current media counts after migration:
  - total active video rows: 1250
  - remote video/GIF rows: 800
  - local auto-generated video rows remaining: 450
  - local auto-generated media footprint is reduced to about 5.08 MB
- Frontend detail playback already supports GIF rendering in the exercise modal.

## 0. 2026-04-21 Update
- Posture module (`/posture`) mobile usability improved:
  - Reworked root/map layout to avoid viewport clipping on small screens.
  - Added mobile-friendly dysfunction list + joint telemetry blocks so key data is visible without desktop sidebars.
  - Adjusted map/profile spacing, typography, and CTA placement for phone breakpoints.
- Joint scan media is now mapped **one-to-one per joint** instead of reusing a single ankle-like image crop.
  - Added local scan assets under `public/images/posture/ct/` for all core joints.
  - Updated `JOINT_SCAN_MEDIA` in `src/modules/posture/PostureSystemPage.tsx` to use joint-specific sources.
- AI training orchestration + RAG progress synced:
  - Floating assistant now supports explicit `Plan` / `Q&A` route switch.
  - `Plan` route returns structured payload (`plan-scope`, `plan-intake`, `plan-options`) and supports option refinements.
  - `Q&A` route uses local RAG knowledge retrieval with citation-style references (`[R#]`).
  - AI plan cards can be previewed, refined, then routed into `/workout-builder` or `/modules`.
- Frontend build verification passed in `D:\\somaticBuilding` (`corepack pnpm build`).

## 0. 2026-04-20 Update
- TrainingHub now has real **module/course CRUD** integration with backend workout APIs.
- `Quick Module` and `Training Course` are split by `templateKind` (`module` / `course`) in API flow.
- Added backend template update API (`PUT /api/v1/workout/template/{id}`) and list filter (`kind=module|course|all`).
- Added `Program` weekly planner route (`/programs`) with v1 local persistence and module/course linkage.
- Added backend-template apply bridge from course library to builder (`workoutApplyTemplateBackendId`).
- Frontend production build passes in `D:\\somaticBuilding`.
- Backend `workout-service` compile passes after dependency alignment.

## 1. Vision
Build a modular fitness training product that unifies:
- Exercise Library + Cart → custom session builder
- System-style onboarding → assessment → profile → summary
- Training execution experience (player + timing logic)
- Aesthetic: cinematic, minimal, high-contrast, athletic

## 2. Core User Flow (Target)
Splash / Welcome
→ Login / Register
→ Baseline Intake (3-step)
→ Goal Input (AI prompt + weights)
→ Assessment Intro
→ Assessment List
→ Active Assessment
→ Ability Profile (radar/node + red flags)
→ Summary & Recommendations
→ Home / Training Hub

Status: **Implemented in /system route group (UI complete, data mocked).**

## 3. Implemented Modules

### 3.1 Home
- **Somatic Architect landing** page implemented.
- Dark cinematic hero w/ background image and gold accent.
- CTA routes to `/training`.

Files:
- `src/modules/home/SomaticArchitectLandingPage.tsx`

Status: **Complete (UI).**

### 3.2 Training Hub
- Training hub entry page with Quick Workout / Custom Workout cards.
- “Train” tab routes to `/training`.

Files:
- `src/modules/training/WorkoutSetupPage.tsx`

Status: **Complete (UI).**

### 3.3 System Onboarding + Assessment Flow
Route group: `/system`

Pages:
- `/system` Splash / Welcome
- `/system/login` Login
- `/system/onboarding` Baseline Intake (3 steps)
- `/system/goals` Goal input w/ AI prompt and weight preview
- `/system/assessment` Intro (protocol explanation)
- `/system/assessment-list` Test list + progress card
- `/system/assessment-active` Active assessment UI
- `/system/profile` Ability profile (node/radar + red flags)
- `/system/summary` Summary + recommendations

Status: **UI implemented, state mocked.**

Files:
- `src/modules/system/SystemFlowPages.tsx`

### 3.4 Exercise Library + Cart
- Exercise library list UI with filters, search, and detail page.
- Cart + add-to-workout flow wired in UI.
- Navigation to builder via cart or template flows.

Files:
- `src/modules/library/Library.tsx`
- `src/modules/library/ExerciseDetail.tsx`
- `src/modules/library/SystemSelection.tsx`

Status: **UI complete, logic partial (mocked data).**

### 3.5 Workout Builder (Training Composer)
- Horizontal block-based session structure.
- Drag/drop from cart or template pool.
- Template save/apply UI and draft persistence.
- Blocks can collapse, clear, reorder; groups support set/reps/rest/time/rounds.
- Training style mapping and system-based blocks.

Files:
- `src/modules/training/WorkoutBuilderPage.tsx`
- `src/modules/training/TemplateLibraryPage.tsx`
- `src/modules/training/WorkoutStyleSelectionPage.tsx`

Status: **UI + local state complete, data persistence via localStorage.**

### 3.6 Workout Player
- Immersive single-task HUD style.
- Timer logic supports work/rest, manual rest, HIIT countdown.
- Control buttons and next exercise preview.

Files:
- `src/modules/training/WorkoutPlayerPage.tsx`

Status: **UI complete, timing logic WIP (needs final tuning).**

### 3.7 Workout Summary
- Cinematic summary view with background and CTAs.

Files:
- `src/modules/training/WorkoutSummaryPage.tsx`

Status: **UI complete.**

### 3.8 Athlete Profile
- Node-based ability system visualization.
- Performance trend + history cards.

Files:
- `src/modules/profile/AthleteProfilePage.tsx`

Status: **UI complete.**

### 3.9 Posture System (Joint Function Map)
- Cyber-medical posture subsystem integrated into main app shell.
- Joint map view with hotspots, dysfunction log, telemetry panels, and control HUD.
- 3D model canvas wired with left/right mirrored body to allow side-specific joint highlighting.
- Hover + selected joint highlight states + manual rotation.

Files:
- `src/modules/posture/PostureSystemPage.tsx`
- `src/modules/posture/types.ts`

Status: **UI integrated; mobile adaptation and joint-specific scan media mapping completed; 3D highlight behavior still being tuned.**

### 3.10 Global Shell
- Bottom nav (Home/Train/Build/Library/Profile).
- Floating Avatar Companion.

Files:
- `src/shared/components/AppShell.tsx`

Status: **Complete (with AI route switch + structured plan card rendering).**

### 3.11 AI Coach (Plan + RAG)
- Backend assistant session/message/chat/goal-synthesis APIs integrated.
- Assistant chat supports `mode=plan|qa|auto`.
- Plan mode:
  - Asks for scope first (Full Course / Quick Module).
  - Asks for missing intake fields before generating plans.
  - Returns 3 structured options with block/item prescriptions.
  - Supports conversational plan refinements before final confirm.
- Q&A mode:
  - Uses RAG retrieval from classpath KB + optional external `knowledge-base`.
  - Supports fallback answers when provider is unavailable.

Files:
- `backend/ai-assistant-service/src/main/java/com/somaticbuilding/aiassistant/interfaces/AiAssistantController.java`
- `backend/ai-assistant-service/src/main/java/com/somaticbuilding/aiassistant/application/AiAssistantService.java`
- `backend/ai-assistant-service/src/main/java/com/somaticbuilding/aiassistant/application/RagKnowledgeService.java`
- `src/shared/api/assistant.ts`
- `src/shared/components/AppShell.tsx`

Status: **Integrated (v1); further hardening and observability pending.**

## 4. State & Storage
- Hybrid storage currently in use:
  - Backend APIs are integrated for assistant/session chat flows, workout template CRUD, and assessment-related endpoints.
  - LocalStorage remains as draft/cache bridge in several frontend flows.
- LocalStorage currently used for:
  - Workout builder drafts by training style
  - Template pool and applied template
  - Cart/session arrangement
  - AI plan preview drafts (builder/module handoff)

## 5. Known Gaps / TODO
- Real backend / database for exercises, templates, sessions.
- Full data model for assessments & AI analysis.
- Workout player timing logic edge cases (HIIT transitions, pause/resume).
- Exercise library filters currently UI-only.
- Auth system not wired to data.
- System flow data should feed into profile/summary.
- Posture system: left/right highlight separation in 3D model still inconsistent; needs final fix.
- AI plan flow currently uses structured JSON payload markers; native provider tool-calling is not yet adopted.
- RAG currently uses local lexical retrieval; vector retrieval/rerank pipeline is pending.

## 6. Routing Overview
Main routes:
- `/` SomaticArchitectLandingPage
- `/training` Training Hub
- `/workout-style` Style selection
- `/workout-builder` Composer
- `/workout` Player
- `/workout-summary` Summary
- `/systems` System selection
- `/library` Exercise library
- `/athlete` Athlete profile

System flow:
- `/system/*` multi-step onboarding + assessment flow

## 7. Design Notes
- Dark mode only
- Gold accent for “system” flows
- Emerald/lime accent for training & builder
- Card-based layout, large typography, cinematic spacing

## 8. Page Index (Routes → Files)
- `/` → `src/modules/home/SomaticArchitectLandingPage.tsx`
- `/training` → `src/modules/training/WorkoutSetupPage.tsx`
- `/workout-style` → `src/modules/training/WorkoutStyleSelectionPage.tsx`
- `/workout-builder` → `src/modules/training/WorkoutBuilderPage.tsx`
- `/workout` → `src/modules/training/WorkoutPlayerPage.tsx`
- `/workout-summary` → `src/modules/training/WorkoutSummaryPage.tsx`
- `/systems` → `src/modules/library/SystemSelection.tsx`
- `/library` → `src/modules/library/Library.tsx`
- `/library/:systemId` → `src/modules/library/Library.tsx`
- `/exercise/:id` → `src/modules/library/ExerciseDetail.tsx`
- `/posture` → `src/modules/posture/PostureSystemPage.tsx`
- `/modules` → `src/modules/training/QuickModuleHubPage.tsx`
- `/module/:id` → `src/modules/training/ModuleDetailPage.tsx`
- `/templates` → `src/modules/training/TemplateLibraryPage.tsx`
- `/athlete` → `src/modules/profile/AthleteProfilePage.tsx`

System flow (onboarding + assessment):
- `/system` → `src/modules/system/SystemFlowPages.tsx` (SystemEntryPage)
- `/system/login` → `src/modules/system/SystemFlowPages.tsx` (SystemLoginPage)
- `/system/onboarding` → `src/modules/system/SystemFlowPages.tsx` (SystemOnboardingPage)
- `/system/goals` → `src/modules/system/SystemFlowPages.tsx` (SystemGoalEntryPage)
- `/system/assessment` → `src/modules/system/SystemFlowPages.tsx` (SystemAssessmentIntroPage)
- `/system/assessment-list` → `src/modules/system/SystemFlowPages.tsx` (SystemAssessmentListPage)
- `/system/assessment-active` → `src/modules/system/SystemFlowPages.tsx` (SystemActiveAssessmentPage)
- `/system/profile` → `src/modules/system/SystemFlowPages.tsx` (SystemAbilityProfilePage)
- `/system/summary` → `src/modules/system/SystemFlowPages.tsx` (SystemSummaryPage)

## 9. Screenshots
Not captured yet. If you want, I can generate a screenshot set for:
- Home
- Training Hub
- Workout Builder
- System Flow (all steps)

## 10. Change Log (2026-05-05)
- Added share feature for user-created `course` and `module` templates using Base62 short code.
- Added backend APIs:
  - `GET /api/v1/workout/template/{id}/share`
  - `GET /api/v1/workout/template/share/{shareCode}`
- Template list and detail payloads now include `shareCode` (and detail includes `sharePath`).
- Added frontend share actions:
  - Module hub can generate/copy share link.
  - Course template library can publish local arrangements to backend and share.
  - Shared template landing page supports open/apply/save flows.
- Added short route alias for shared links:
  - New short path: `/s/:shareCode`
  - Legacy path retained: `/share/template/:shareCode`
- AI training-plan UX adjusted to single-session semantics:
  - Plan option cards now display `Single session` duration instead of `sessions/week`.
  - Content-generated plan payload defaults to single-session metadata (`session_scope=single_session`).
  - Progression copy changed from week-based wording to next-session progression wording.
- Program Planner tightened to true weekly scheduling behavior:
  - Save is blocked when no day is assigned to module/course.
  - Description clarified as 7-day weekly program assignment.
- Program Planner upgraded with weekly load analytics:
  - Added per-day load level classification (`Rest/Low/Moderate/High`) from assigned module/course/focus.
  - Added weekly synthesis metrics: active days, rest days, high days, recovery days, max high-intensity streak.
  - Added risk warnings and auto suggestions (rest-day missing, excessive high streak, no recovery day, consecutive lower-body load).
  - Added balance score (`0-100`) and critical-risk save guard for unsafe weekly distributions.
- Training Hub now surfaces weekly plan reminders (without entering Program page):
  - Added top-level `Today Program Radar` panel on `/training` showing today assignment (module/course/focus), load level, and quick launch.
  - Added `Weekly Snapshot` panel with balance score + risk signals (active/rest/high/recovery days and max high-intensity streak).
  - Added fallback guidance when no active weekly program exists, so users running single sessions still see planning prompts.
- Training Hub reminder flow upgraded with behavior logic:
  - Added high-risk pre-training modal (`Training Risk Alert`) for risky daily/weekly load patterns, with per-day acknowledgement persistence.
  - Added today completion check-in (`Mark Done` / `Undo Done`) with local persistence by `program + week + day`.
  - Added today status badge (`Today: Scheduled` / `Today: Done`) to make plan adherence visible even outside Program page.
- Completion loop automation:
  - `Workout Player` now writes a pending auto-checkin marker on session finish before redirecting to summary.
  - `Workout Summary` consumes that marker and auto-updates today completion state when an active weekly plan has a matching day assignment.
  - Added evening incomplete reminder modal on Training Hub (after 19:00 local time, only when today is still scheduled and unfinished).
