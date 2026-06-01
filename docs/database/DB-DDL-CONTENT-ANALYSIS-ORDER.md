# Content Analysis DDL Order

Last updated: 2026-05-02 (Asia/Shanghai)

## Execution Order
Run this addon script after base schema is initialized:

1. `user_account` (already exists)
2. `exercise` (already exists)
3. `content_analysis_job`
4. `content_analysis_asset`
5. `content_movement_candidate`
6. `content_exercise_mapping`
7. `content_plan_draft`

## Script
- `docs/database/DB-DDL-CONTENT-ANALYSIS.sql`

## Notes
- This addon follows existing project convention:
  - InnoDB
  - `DATETIME(3)`
  - `status` + `is_deleted`
- Apply with:

```sql
SOURCE docs/database/DB-DDL-CONTENT-ANALYSIS.sql;
```

