# Gateway Path Load Test & Redis Cache A/B Report

Date: 2026-05-09  
Gateway: `http://localhost:8080`  
Downstream API: `GET /api/v1/exercise/list?page=1&page_size=20&equipment=Bodyweight`  
Duration: `5m` per scenario  
Concurrency: `20 / 50 / 100` VUs

## 1. Scope

This report validates the end-to-end gateway path performance impact of enabling Redis list-cache on `exercise-service`.

- A/B switch:
  - Before: `exercise.performance.list-cache-enabled=false`
  - After: `exercise.performance.list-cache-enabled=true`
- Redis config used:
  - host: `localhost`
  - port: `6380`
  - password: configured in service

## 2. Observability Validation

Prometheus endpoint was verified on `exercise-service`:

- `GET http://localhost:8083/actuator/prometheus`
- Sample metrics after repeated identical requests:
  - `exercise_list_cache_requests_total{result="miss"...} 1`
  - `exercise_list_cache_requests_total{result="hit"...} 3`
  - `exercise_list_cache_writes_total{result="success"...} 1`
  - `exercise_list_cache_payload_bytes_sum{...} 4807`

This confirms cache miss->write->hit behavior is active, not mocked.

## 3. A/B Results (Gateway Path)

| VUS | Avg(ms) Before | Avg(ms) After | Avg Improve | P95(ms) Before | P95(ms) After | P95 Improve | Error% Before | Error% After | RPS Before | RPS After | RPS Gain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 14.07 | 5.07 | 63.96% | 18.39 | 7.35 | 60.02% | 0% | 0% | 1404.96 | 3838.95 | 173.24% |
| 50 | 35.73 | 12.02 | 66.35% | 51.20 | 17.61 | 65.59% | 0% | 0% | 1392.46 | 4101.21 | 194.53% |
| 100 | 66.98 | 24.24 | 63.80% | 109.31 | 34.54 | 68.40% | 0% | 0% | 1489.20 | 4094.34 | 174.93% |

Raw artifacts:

- Before JSON: `docs/performance/gateway/before-cache/gateway_exercise_list_v{20|50|100}_before.json`
- After JSON: `docs/performance/gateway/optimized/gateway_exercise_list_v{20|50|100}_after.json`
- Comparison CSV: `docs/performance/reports/gateway_exercise_list_cache_comparison.csv`
- Comparison MD: `docs/performance/reports/gateway_exercise_list_cache_comparison.md`

## 4. Capacity Boundary Statement

Under current local single-node setup (gateway + single service instance + local MySQL + local Redis):

1. The gateway path sustained `100` VUs for `5m` with:
   - P95 `34.54ms`
   - Error rate `0.00%`
   - Throughput `4094.34 req/s`
2. Conservative single-instance boundary recommendation:
   - `<= 100` concurrent requests for this hot list endpoint
   - Keep p95 target under `50ms` and error-rate under `0.1%`
3. If future business traffic mixes more write-heavy APIs, boundary should be re-evaluated with mixed-scenario tests.

## 5. Engineering Conclusion

For this core chain, Redis list-cache plus existing SQL/index/query optimizations delivers a substantial and stable E2E uplift on the gateway path, with clear before/after evidence suitable for graduation defense materials.
