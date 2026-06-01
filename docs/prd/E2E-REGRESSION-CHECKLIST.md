# SomaticBuilding E2E Regression Checklist

Last updated: 2026-04-16 (Asia/Shanghai)
Owner: Frontend + Backend integration
Execution mode: Manual walkthrough (page-by-page)

## 1. Regression Scope

Primary path (real user flow):
1. `/system` entry
2. `/system/login` login/register
3. `/system/onboarding` baseline intake
4. `/system/goals` goal input and AI analysis handoff
5. `/system/assessment` intro
6. `/system/assessment-list` test queue
7. `/system/assessment-active` active test loop
8. `/system/summary` summary output
9. `/system/profile` + `/athlete` profile sync and history
10. `/systems` -> `/library` -> `/exercise/:id` action library path
11. `/training` -> `/workout-style` -> `/workout-builder` -> `/workout` -> `/workout-summary`
12. Floating AI assistant (`AppShell`) and account panel

## 2. Environment & Pre-check

Before running checklist:
1. Start gateway/backend stack (API through `http://127.0.0.1:8080`).
2. Start frontend (`corepack pnpm dev`).
3. Use a clean browser profile or clear localStorage.
4. Prepare one test account:
- phone-like account (11 digits) for privacy mask verification
- password that satisfies current backend auth rules

Reset keys for a clean flow:
- `authToken`
- `authAccount`
- `systemOnboardingCompleted`
- `systemGoalInput`
- `systemGoalConfirmed`
- `assessmentActiveSessionId`
- `assessmentCompletedTestIds`

Baseline compile check (this round):
- 2026-04-16: `corepack pnpm build` PASS
- Known warnings remain:
  - `three-mesh-bvh` imports `BatchedMesh` warning
  - large chunk size warning (`> 500 kB`)

## 3. E2E Checklist

Legend:
- Result: `PASS` / `FAIL` / `BLOCKED` / `NOT RUN`
- Bug ID: link to section 5 entries

| ID | Page/Flow | Steps | Expected | API/State | Result | Bug ID |
|---|---|---|---|---|---|---|
| SYS-001 | Entry redirect | Open `/system`, click `Start Experience` | Goes to `/system/login` | Route only | NOT RUN | - |
| SYS-002 | Register success feedback | In `/system/login`, switch to register, submit valid account/password/phone | Show success notice ("registered, please login"), then stay/return to login mode | `POST /api/v1/auth/register` | NOT RUN | - |
| SYS-003 | Login success feedback + token | Submit valid login in `/system/login` | Show success notice, redirect to `/system/onboarding`; token saved | `POST /api/v1/auth/login`, localStorage `authToken` | NOT RUN | - |
| SYS-004 | Header auth state | After login, top-right account shows masked account (not plain 11 digits) | Account label masked as `first 3 + xxxx + last 4` | localStorage `authAccount` | NOT RUN | - |
| SYS-005 | Onboarding required fields gate | In `/system/onboarding`, attempt next without input | Block next step with clear validation message | local form state + `saveAssessmentStep` | NOT RUN | - |
| SYS-006 | Onboarding gender interaction | In onboarding basic info, select gender options | Options are selectable and value persists on next/prev | local state + profile payload | NOT RUN | - |
| SYS-007 | Onboarding persistence | Complete onboarding and refresh page | Existing input restored; completed flag retained | localStorage `systemOnboardingCompleted` + draft key | NOT RUN | - |
| SYS-008 | Goal page analyze gate | In `/system/goals`, input goal text and trigger analysis action | Should run AI analysis before allowing next stage | expected AI endpoint + UI loading state | FAIL (code audit) | BUG-SYS-001 |
| SYS-009 | Goal synthesis visualization | After goal analysis, right panel radar/targets should reflect current input | Chart + weights change with analyzed structure | AI output bound to UI state | FAIL (code audit) | BUG-SYS-002 |
| SYS-010 | Assessment intro start | In `/system/assessment`, click start | Creates/reuses assessment session and routes list page | `POST /api/v1/assessment/session` | NOT RUN | - |
| SYS-011 | Assessment list ordering | Verify list follows FMS order and shows status | Deep Squat -> ... -> Rotary Stability, progress coherent | `GET /api/v1/assessment/tests` + local completed IDs | NOT RUN | - |
| SYS-012 | Active assessment save gate | In `/system/assessment-active`, click save without score/stance | Save blocked with clear prompt | `saveAssessmentTestResult` should not fire | NOT RUN | - |
| SYS-013 | Active assessment loop | Save one test and continue | Next test loads; completed set updates | `POST /api/v1/assessment/test-result`, local completed IDs | NOT RUN | - |
| SYS-014 | Summary completion guard | Directly open `/system/summary` before finishing all tests | Redirect back to assessment list | checks test completion from API + local IDs | NOT RUN | - |
| SYS-015 | Summary->profile sync | Complete all tests then open summary | Summary loads and ability profile sync attempt occurs | `GET /summary` + `POST /api/v1/profile/ability` | NOT RUN | - |
| SYS-016 | System profile route | Open `/system/profile` after flow | Page loads personalized profile data | `GET /api/v1/profile/*` | NOT RUN | - |
| ATH-001 | Athlete profile privacy | Check headline summary text on `/athlete` | Should avoid exposing raw private intake text | profile render logic | FAIL (code audit) | BUG-ATH-001 |
| ATH-002 | Goal view in profile | Profile should contain both current state and goal projection visual | Goal visualization block present, not text-only | goal analysis data source | NOT RUN | - |
| ATH-003 | Nickname uniqueness | On `/athlete`, set nickname already used by another user | UI blocks save and shows duplicate nickname message | `GET /api/v1/user/profile/display-name/availability` + `PUT /api/v1/user/profile` | NOT RUN | - |
| LIB-001 | Library category entry | Open `/systems` and enter one style/system | Correctly routes to filtered library list | route params + `fetchExerciseList` | NOT RUN | - |
| LIB-002 | Library list real backend | Refresh library list page | Data comes from API, not stale static list | `GET /api/v1/exercise/list` | NOT RUN | - |
| LIB-003 | Exercise detail dynamic fields | Open two different exercises detail pages | ability profile / muscle target / caution differ per exercise | `GET /api/v1/exercise/{id}` | NOT RUN | - |
| LIB-004 | Exercise media behavior | In detail click play/demo | If no video, graceful fallback message; no broken player loop | detail media fields | NOT RUN | - |
| TRN-001 | Training setup entry | Open `/training`, start custom flow | Route to style or builder as designed | route + local draft | NOT RUN | - |
| TRN-002 | Builder receives selected actions | Select actions from library and open builder | Builder block data matches selected actions | local cache / API payload mapping | NOT RUN | - |
| TRN-003 | Run lifecycle | Start workout -> complete -> summary | Run status and set logs persisted | `training.ts` + `workout.ts` endpoints | NOT RUN | - |
| TRN-004 | Profile history reflection | After run completion, open `/athlete` | Recent training history list updates | `GET /api/v1/profile/training-history` | NOT RUN | - |
| AI-001 | Floating assistant open/close | Click floating OS button | Chat window opens/closes with history | assistant session/messages APIs | NOT RUN | - |
| AI-002 | Assistant continuity | Send message, refresh, reopen chat | Prior messages replay from session | `session` + `messages` + `chat` | NOT RUN | - |
| POS-001 | Posture full-body interaction | On `/posture`, click highlighted joints and other regions | Selection details update for each supported region; no fixed stale detail | posture module state | NOT RUN | - |

## 4. Quick SQL/API Data Sanity (Recommended)

Run before full walkthrough:
1. Auth tables: user account can be queried after register.
2. Exercise tables: verify seeded records > 0 and include multiple systems/styles.
3. Assessment tables: session + test-result records inserted during one run.
4. Profile tables: ability profile row written after summary.
5. Training tables: run and set logs written after workout execution.

If any item fails, mark affected checklist rows as `BLOCKED` and attach dependency note.

## 5. Bug Log (Current Round)

### BUG-SYS-001
- Title: Goal page has no real AI analysis action before entering assessment.
- Severity: High (core flow inconsistency)
- Status: Fixed in code (2026-04-16), pending UI retest
- Evidence:
  - Goal confirmation only trims text, stores localStorage, then jumps to assessment.
  - No AI API call in this action path.
- Code reference:
  - `src/modules/system/SystemFlowPages.tsx` lines ~1335-1343.
- Repro:
  1. Open `/system/goals`.
  2. Enter any 10+ chars text.
  3. Click `Confirm Goals`.
  4. Observe immediate route to `/system/assessment` with no analysis step.

### BUG-SYS-002
- Title: Biometric synthesis panel uses static data and does not bind to goal input.
- Severity: High (goal personalization missing)
- Status: Fixed in code (2026-04-16), pending UI retest
- Evidence:
  - `radarData` and `weights` are constant definitions.
  - Right panel is rendered from static arrays.
- Code reference:
  - `src/modules/system/SystemFlowPages.tsx` lines ~52-59, ~1322-1327, ~1407-1431.
- Repro:
  1. In `/system/goals`, enter two very different goal descriptions.
  2. Compare right panel chart/bars.
  3. Values remain unchanged.

### BUG-ATH-001
- Title: Profile summary may expose raw private lifestyle/injury text.
- Severity: Medium (privacy risk)
- Status: Fixed in code (2026-04-16), pending UI retest
- Evidence:
  - Summary text directly interpolates `mergedProfile.lifestyleNote`.
- Code reference:
  - `src/modules/profile/AthleteProfilePage.tsx` line ~379.
- Repro:
  1. Complete onboarding with sensitive injury details.
  2. Open `/athlete`.
  3. Observe raw text appears in headline summary.

## 6. Regression Record Template

Copy this block for each real execution round:

```
Run date:
Executor:
Frontend commit/tag:
Backend commit/tag:
Environment:

Result summary:
- Passed:
- Failed:
- Blocked:
- Not run:

New bug IDs:
- BUG-...

Retest bug IDs:
- BUG-...
```

## 7. Next Fix Order (Suggested)

1. Fix `BUG-SYS-001`: add explicit "Analyze" action and backend call completion gate.
2. Fix `BUG-SYS-002`: replace static goal chart/weights with backend structured response.
3. Fix `BUG-ATH-001`: keep private raw text hidden; render abstracted labels/score only.
4. Re-run checklist section `SYS-*` and `ATH-*` fully, then `LIB-*` + `TRN-*`.
