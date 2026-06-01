-- Purpose: Improve exercise list query performance for /api/v1/exercise/list
-- Applied on: 2026-05-09
-- Environment note: Designed for MySQL 8.0+

USE somaticbuilding_db;

-- 1) Query path: exercise list with is_deleted + equipment / primary_muscle / difficulty filters
ALTER TABLE exercise
  ADD KEY idx_exercise_active_equipment (is_deleted, equipment, id),
  ADD KEY idx_exercise_active_primary_muscle (is_deleted, primary_muscle, id),
  ADD KEY idx_exercise_active_difficulty (is_deleted, difficulty, id);

-- 2) Query path: media prefetch by exercise_id with cover-first sorting
ALTER TABLE exercise_media
  ADD KEY idx_exercise_media_exercise_deleted_cover (exercise_id, is_deleted, cover_flag, id);

-- 3) Query path: tag list and tag mapping lookups
ALTER TABLE exercise_tag
  ADD KEY idx_exercise_tag_active_sort (is_deleted, tag_type, tag_name);

ALTER TABLE exercise_tag_map
  ADD KEY idx_exercise_tag_map_tag_deleted_exercise (tag_id, is_deleted, exercise_id);
