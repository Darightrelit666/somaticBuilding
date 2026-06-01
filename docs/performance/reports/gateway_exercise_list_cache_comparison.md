# Gateway Exercise List Cache Comparison

Scenario: `GET /api/v1/exercise/list?page=1&page_size=20&equipment=Bodyweight` via gateway `:8080`
Duration: 5m per VUS

| VUS | Avg(ms) Before | Avg(ms) After | Avg Improve | P95(ms) Before | P95(ms) After | P95 Improve | Error% Before | Error% After | RPS Before | RPS After | RPS Gain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 14.07 | 5.07 | 63.96% | 18.39 | 7.35 | 60.02% | 0% | 0% | 1404.96 | 3838.95 | 173.24% |
| 50 | 35.73 | 12.02 | 66.35% | 51.2 | 17.61 | 65.59% | 0% | 0% | 1392.46 | 4101.21 | 194.53% |
| 100 | 66.98 | 24.24 | 63.8% | 109.31 | 34.54 | 68.4% | 0% | 0% | 1489.2 | 4094.34 | 174.93% |

Generated at: 2026-05-09 13:35:56 +08:00
