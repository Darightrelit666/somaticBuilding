# Exercise Core Chain Load Test & Optimization Report

Date: 2026-05-09  
Service: `exercise-service`  
Core API Chain: `GET /api/v1/exercise/list?page=1&page_size=20&equipment=Bodyweight`

## 1. Goal

This report validates backend engineering upgrades on a real core chain:

1. Baseline load test (before optimization)
2. Backend optimization implementation (code + database index)
3. Reload test (after optimization)
4. Before/after comparison table
5. Capacity boundary statement

## 2. Test Setup

- Tool: `k6` (via Docker `grafana/k6`)
- Duration per scenario: `5m`
- Concurrency scenarios: `20 / 50 / 100` VUs
- Endpoint: `http://host.docker.internal:8083/api/v1/exercise/list?page=1&page_size=20&equipment=Bodyweight`
- Data source: MySQL `localhost:3308/somaticbuilding_db`
- Environment note: single-node local environment (service direct call, not gateway path)

## 3. Engineering Upgrades

### 3.1 Code optimization (eliminate N+1 query pattern)

Before:
- In list API mapping, each exercise item fetched media individually:
  - `1` paged exercise query + `N` media queries

After:
- Batch prefetch media by exercise IDs:
  - `1` paged exercise query + `1` batch media query

Related files:
- `backend/exercise-service/src/main/java/com/somaticbuilding/exercise/interfaces/ExerciseController.java`
- `backend/exercise-service/src/main/java/com/somaticbuilding/exercise/application/ExerciseService.java`
- `backend/exercise-service/src/main/java/com/somaticbuilding/exercise/infrastructure/mapper/ExerciseMediaMapper.java`

### 3.2 SQL index optimization

Added indexes for hot query predicates and sort paths:

- `exercise`
  - `idx_exercise_active_equipment (is_deleted, equipment, id)`
  - `idx_exercise_active_primary_muscle (is_deleted, primary_muscle, id)`
  - `idx_exercise_active_difficulty (is_deleted, difficulty, id)`
- `exercise_media`
  - `idx_exercise_media_exercise_deleted_cover (exercise_id, is_deleted, cover_flag, id)`
- `exercise_tag`
  - `idx_exercise_tag_active_sort (is_deleted, tag_type, tag_name)`
- `exercise_tag_map`
  - `idx_exercise_tag_map_tag_deleted_exercise (tag_id, is_deleted, exercise_id)`

Migration file:
- `docs/database/migrations/2026-05-09-exercise-performance-indexes.sql`

### 3.3 A/B switch for repeatable verification

Added feature switch:
- `exercise.performance.bulk-media-fetch-enabled: true`

Config file:
- `backend/exercise-service/src/main/resources/application.yml`

## 4. Results (Before vs After)

Source files:
- Baseline JSON: `docs/performance/baseline/*.json`
- Optimized JSON: `docs/performance/optimized/*.json`
- Auto-generated summary:
  - `docs/performance/reports/exercise_list_comparison.csv`
  - `docs/performance/reports/exercise_list_comparison.md`

| VUS | Avg(ms) Before | Avg(ms) After | Avg Improve | P95(ms) Before | P95(ms) After | P95 Improve | Error% Before | Error% After | RPS Before | RPS After | RPS Gain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 41.16 | 9.96 | 75.81% | 50.88 | 14.79 | 70.94% | 0.0126% | 0.0139% | 408.84 | 1334.95 | 226.52% |
| 50 | 110.92 | 21.16 | 80.92% | 136.26 | 36.53 | 73.19% | 0.0114% | 0.0288% | 400.06 | 1615.19 | 303.74% |
| 100 | 226.98 | 47.84 | 78.92% | 284.66 | 79.43 | 72.10% | 0.0000% | 0.0271% | 440.04 | 1666.36 | 278.68% |

## 5. Capacity Boundary Statement

Under the current single-node local environment (service direct call + local Docker MySQL):

1. This core chain can sustain `100` VUs for `5` minutes with:
   - P95 `79.43ms`
   - Error rate `0.0271%`
   - Throughput `1666.36 req/s`
2. For conservative production-like planning (without horizontal scaling evidence), recommended safe boundary:
   - `<= 50` concurrent on one instance
   - Keep P95 under `50ms` and error rate under `0.05%`
3. Above this boundary, capacity should be expanded via:
   - instance scale-out
   - gateway-level traffic shaping
   - cache and DB pool tuning

## 6. Residual Risks & Next Steps

1. Some high-concurrency windows showed sporadic Docker host-network I/O timeout warnings; error rate remains low but should be tracked in production network topology.
2. Next engineering upgrades:
   - extend cache scope to additional high-read APIs (detail/tags mix-path)
   - add dashboards/alerts on top of existing Micrometer + Prometheus metrics
   - run mixed-route gateway stress tests (list + detail + template CRUD)

Update note (2026-05-09 later session):
- Redis cache + Prometheus + gateway-path A/B load test have been completed.
- See `docs/performance/reports/2026-05-09-gateway-cache-loadtest.md`.
