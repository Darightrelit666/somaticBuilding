-- SomaticBuilding / Physical OS - MySQL Init Script
-- Updated: 2026-04-06 (Asia/Shanghai)
-- Charset: utf8mb4
-- Engine: InnoDB

CREATE DATABASE IF NOT EXISTS somaticbuilding_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE somaticbuilding_db;

-- 1. user_account
CREATE TABLE user_account (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(128),
  phone CHAR(11),
  password_hash VARCHAR(255) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_user_account_email (email),
  UNIQUE KEY uk_user_account_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. user_profile
CREATE TABLE user_profile (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  display_name VARCHAR(64),
  gender TINYINT,
  age TINYINT,
  height_cm SMALLINT,
  weight_kg DECIMAL(5,2),
  training_years TINYINT,
  lifestyle_note VARCHAR(255),
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_user_profile_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  UNIQUE KEY uk_user_profile_user (user_id),
  UNIQUE KEY uk_user_profile_display_name (display_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- user_oauth
CREATE TABLE user_oauth (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  provider VARCHAR(32) NOT NULL,
  open_id VARCHAR(128) NOT NULL,
  union_id VARCHAR(128),
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_user_oauth_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  UNIQUE KEY uk_user_oauth_provider_open (provider, open_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. assessment_session
CREATE TABLE assessment_session (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3),
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_assessment_session_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  KEY idx_assessment_session_user_time (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. assessment_step
CREATE TABLE assessment_step (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  step_type VARCHAR(64) NOT NULL,
  step_status TINYINT NOT NULL DEFAULT 0,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_assessment_step_session FOREIGN KEY (session_id) REFERENCES assessment_session(id),
  KEY idx_assessment_step_session_type (session_id, step_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. assessment_test
CREATE TABLE assessment_test (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(64),
  status TINYINT NOT NULL DEFAULT 0,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_assessment_test_session FOREIGN KEY (session_id) REFERENCES assessment_session(id),
  KEY idx_assessment_test_session_status (session_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. assessment_result
CREATE TABLE assessment_result (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  test_id BIGINT NOT NULL,
  score INT,
  note VARCHAR(255),
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_assessment_result_test FOREIGN KEY (test_id) REFERENCES assessment_test(id),
  KEY idx_assessment_result_test (test_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. joint_metric
CREATE TABLE joint_metric (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  result_id BIGINT NOT NULL,
  joint_name VARCHAR(64) NOT NULL,
  mobility INT,
  stability INT,
  motor_control INT,
  status TINYINT NOT NULL,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_joint_metric_result FOREIGN KEY (result_id) REFERENCES assessment_result(id),
  KEY idx_joint_metric_result_joint (result_id, joint_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. risk_alert
CREATE TABLE risk_alert (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  result_id BIGINT NOT NULL,
  joint_name VARCHAR(64) NOT NULL,
  severity TINYINT NOT NULL,
  message VARCHAR(255),
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_risk_alert_result FOREIGN KEY (result_id) REFERENCES assessment_result(id),
  KEY idx_risk_alert_result_severity (result_id, severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. posture_snapshot
CREATE TABLE posture_snapshot (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  snapshot_time DATETIME(3) NOT NULL,
  summary VARCHAR(255),
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_posture_snapshot_session FOREIGN KEY (session_id) REFERENCES assessment_session(id),
  KEY idx_posture_snapshot_session_time (session_id, snapshot_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. posture_joint_state
CREATE TABLE posture_joint_state (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  snapshot_id BIGINT NOT NULL,
  joint_name VARCHAR(64) NOT NULL,
  status TINYINT NOT NULL,
  note VARCHAR(255),
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_posture_joint_state_snapshot FOREIGN KEY (snapshot_id) REFERENCES posture_snapshot(id),
  KEY idx_posture_joint_state_snapshot_joint (snapshot_id, joint_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. exercise
CREATE TABLE exercise (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  primary_muscle VARCHAR(64),
  equipment VARCHAR(64),
  difficulty TINYINT,
  description TEXT,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  KEY idx_exercise_active_equipment (is_deleted, equipment, id),
  KEY idx_exercise_active_primary_muscle (is_deleted, primary_muscle, id),
  KEY idx_exercise_active_difficulty (is_deleted, difficulty, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. exercise_tag
CREATE TABLE exercise_tag (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tag_type VARCHAR(32) NOT NULL,
  tag_name VARCHAR(64) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_exercise_tag_type_name (tag_type, tag_name),
  KEY idx_exercise_tag_active_sort (is_deleted, tag_type, tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. exercise_media
CREATE TABLE exercise_media (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exercise_id BIGINT NOT NULL,
  media_type VARCHAR(32) NOT NULL,
  url VARCHAR(255) NOT NULL,
  cover_flag TINYINT NOT NULL DEFAULT 0,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_exercise_media_exercise FOREIGN KEY (exercise_id) REFERENCES exercise(id),
  KEY idx_exercise_media_exercise_cover (exercise_id, cover_flag),
  KEY idx_exercise_media_exercise_deleted_cover (exercise_id, is_deleted, cover_flag, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. exercise_tag_map
CREATE TABLE exercise_tag_map (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exercise_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_exercise_tag_map_exercise FOREIGN KEY (exercise_id) REFERENCES exercise(id),
  CONSTRAINT fk_exercise_tag_map_tag FOREIGN KEY (tag_id) REFERENCES exercise_tag(id),
  UNIQUE KEY uk_exercise_tag_map (exercise_id, tag_id),
  KEY idx_exercise_tag_map_tag (tag_id),
  KEY idx_exercise_tag_map_tag_deleted_exercise (tag_id, is_deleted, exercise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. exercise_cart
CREATE TABLE exercise_cart (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_exercise_cart_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  UNIQUE KEY uk_exercise_cart_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. cart_item
CREATE TABLE cart_item (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cart_id BIGINT NOT NULL,
  exercise_id BIGINT NOT NULL,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_cart_item_cart FOREIGN KEY (cart_id) REFERENCES exercise_cart(id),
  CONSTRAINT fk_cart_item_exercise FOREIGN KEY (exercise_id) REFERENCES exercise(id),
  UNIQUE KEY uk_cart_item (cart_id, exercise_id),
  KEY idx_cart_item_cart (cart_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. workout_template
CREATE TABLE workout_template (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  template_name VARCHAR(128) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_workout_template_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  UNIQUE KEY uk_workout_template_user_name (user_id, template_name),
  KEY idx_workout_template_user_time (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. template_exercise
CREATE TABLE template_exercise (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id BIGINT NOT NULL,
  exercise_id BIGINT NOT NULL,
  sets INT,
  reps INT,
  rest_seconds INT,
  time_seconds INT,
  rounds INT,
  order_index INT,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_template_exercise_template FOREIGN KEY (template_id) REFERENCES workout_template(id),
  CONSTRAINT fk_template_exercise_exercise FOREIGN KEY (exercise_id) REFERENCES exercise(id),
  KEY idx_template_exercise_order (template_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 19. workout_session
CREATE TABLE workout_session (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  session_name VARCHAR(128) NOT NULL,
  training_style VARCHAR(64) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_workout_session_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  KEY idx_workout_session_user_time (user_id, create_time),
  KEY idx_workout_session_user_style (user_id, training_style)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 20. workout_block
CREATE TABLE workout_block (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  block_name VARCHAR(64) NOT NULL,
  order_index INT,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_workout_block_session FOREIGN KEY (session_id) REFERENCES workout_session(id),
  KEY idx_workout_block_order (session_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 21. workout_group
CREATE TABLE workout_group (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  block_id BIGINT NOT NULL,
  group_type VARCHAR(32) NOT NULL,
  order_index INT,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_workout_group_block FOREIGN KEY (block_id) REFERENCES workout_block(id),
  KEY idx_workout_group_order (block_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 22. workout_exercise
CREATE TABLE workout_exercise (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  group_id BIGINT NOT NULL,
  exercise_id BIGINT NOT NULL,
  sets INT,
  reps INT,
  rest_seconds INT,
  time_seconds INT,
  rounds INT,
  order_index INT,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_workout_exercise_group FOREIGN KEY (group_id) REFERENCES workout_group(id),
  CONSTRAINT fk_workout_exercise_exercise FOREIGN KEY (exercise_id) REFERENCES exercise(id),
  KEY idx_workout_exercise_order (group_id, order_index),
  KEY idx_workout_exercise_usage (exercise_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 23. training_run
CREATE TABLE training_run (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3),
  status TINYINT NOT NULL,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_training_run_session FOREIGN KEY (session_id) REFERENCES workout_session(id),
  CONSTRAINT fk_training_run_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  KEY idx_training_run_user_time (user_id, start_time),
  KEY idx_training_run_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 24. set_log
CREATE TABLE set_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  exercise_id BIGINT NOT NULL,
  set_index INT,
  reps INT,
  weight_kg DECIMAL(6,2),
  duration_seconds INT,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_set_log_run FOREIGN KEY (run_id) REFERENCES training_run(id),
  CONSTRAINT fk_set_log_exercise FOREIGN KEY (exercise_id) REFERENCES exercise(id),
  KEY idx_set_log_order (run_id, set_index),
  KEY idx_set_log_exercise (exercise_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 25. timer_log
CREATE TABLE timer_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  phase_type VARCHAR(32) NOT NULL,
  duration_seconds INT,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3),
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_timer_log_run FOREIGN KEY (run_id) REFERENCES training_run(id),
  KEY idx_timer_log_run_time (run_id, start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 26. exercise_log
CREATE TABLE exercise_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  exercise_id BIGINT NOT NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3),
  status TINYINT NOT NULL DEFAULT 1,
  note VARCHAR(255),
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_exercise_log_run FOREIGN KEY (run_id) REFERENCES training_run(id),
  CONSTRAINT fk_exercise_log_exercise FOREIGN KEY (exercise_id) REFERENCES exercise(id),
  KEY idx_exercise_log_run_time (run_id, start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 27. recovery_log
CREATE TABLE recovery_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  run_id BIGINT NOT NULL,
  rpe TINYINT,
  sleep_score TINYINT,
  fatigue_score TINYINT,
  suggestion VARCHAR(255),
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_recovery_log_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  CONSTRAINT fk_recovery_log_run FOREIGN KEY (run_id) REFERENCES training_run(id),
  KEY idx_recovery_log_user_time (user_id, create_time),
  KEY idx_recovery_log_run (run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 28. goal_input
CREATE TABLE goal_input (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  raw_text TEXT NOT NULL,
  status TINYINT NOT NULL,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_goal_input_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  KEY idx_goal_input_user_time (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 29. goal_parsed
CREATE TABLE goal_parsed (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  goal_id BIGINT NOT NULL,
  parsed_json TEXT,
  status TINYINT NOT NULL,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_goal_parsed_goal FOREIGN KEY (goal_id) REFERENCES goal_input(id),
  UNIQUE KEY uk_goal_parsed_goal (goal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 30. ability_profile
CREATE TABLE ability_profile (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  strength INT,
  power INT,
  endurance INT,
  mobility INT,
  stability INT,
  speed INT,
  status TINYINT NOT NULL,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_ability_profile_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  KEY idx_ability_profile_user_time (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 31. ability_history
CREATE TABLE ability_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  profile_id BIGINT NOT NULL,
  record_time DATETIME(3) NOT NULL,
  delta_json TEXT,
  note VARCHAR(255),
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_ability_history_profile FOREIGN KEY (profile_id) REFERENCES ability_profile(id),
  KEY idx_ability_history_profile_time (profile_id, record_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 32. recommendation
CREATE TABLE recommendation (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  rec_type VARCHAR(32) NOT NULL,
  ref_id BIGINT,
  reason VARCHAR(255),
  status TINYINT NOT NULL,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_recommendation_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  KEY idx_recommendation_user_time (user_id, create_time),
  KEY idx_recommendation_user_type (user_id, rec_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 33. history_log
CREATE TABLE history_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  ref_id BIGINT,
  event_time DATETIME(3),
  note VARCHAR(255),
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_history_log_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  KEY idx_history_log_user_time (user_id, event_time),
  KEY idx_history_log_user_type (user_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 34. content_analysis_job
CREATE TABLE content_analysis_job (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  source_platform VARCHAR(32) NOT NULL DEFAULT 'unknown',
  source_url VARCHAR(1024) NOT NULL,
  source_video_id VARCHAR(128),
  analysis_mode VARCHAR(32) NOT NULL DEFAULT 'url_only',
  goal_type VARCHAR(16) NOT NULL DEFAULT 'course',
  pipeline_status VARCHAR(32) NOT NULL DEFAULT 'created',
  error_code VARCHAR(64),
  error_message VARCHAR(512),
  confidence_score DECIMAL(5,2),
  request_payload JSON,
  analysis_result_json JSON,
  result_summary VARCHAR(512),
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_content_analysis_job_user FOREIGN KEY (user_id) REFERENCES user_account(id),
  KEY idx_content_job_user_time (user_id, create_time),
  KEY idx_content_job_pipeline_status (pipeline_status, update_time),
  KEY idx_content_job_platform_video (source_platform, source_video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 35. content_analysis_asset
CREATE TABLE content_analysis_asset (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  job_id BIGINT NOT NULL,
  asset_type VARCHAR(32) NOT NULL,
  storage_provider VARCHAR(32) NOT NULL DEFAULT 'local',
  storage_key VARCHAR(255),
  source_url VARCHAR(1024),
  content_text MEDIUMTEXT,
  duration_sec DECIMAL(8,2),
  metadata_json JSON,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_content_asset_job FOREIGN KEY (job_id) REFERENCES content_analysis_job(id),
  KEY idx_content_asset_job_type (job_id, asset_type),
  KEY idx_content_asset_job_time (job_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 36. content_movement_candidate
CREATE TABLE content_movement_candidate (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  job_id BIGINT NOT NULL,
  raw_label VARCHAR(128) NOT NULL,
  normalized_label VARCHAR(128),
  start_sec DECIMAL(8,2),
  end_sec DECIMAL(8,2),
  confidence DECIMAL(5,2),
  notes VARCHAR(255),
  review_state VARCHAR(32) NOT NULL DEFAULT 'pending',
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_content_candidate_job FOREIGN KEY (job_id) REFERENCES content_analysis_job(id),
  KEY idx_content_candidate_job_review (job_id, review_state),
  KEY idx_content_candidate_job_conf (job_id, confidence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 37. content_exercise_mapping
CREATE TABLE content_exercise_mapping (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  job_id BIGINT NOT NULL,
  candidate_id BIGINT NOT NULL,
  exercise_id BIGINT NOT NULL,
  match_score DECIMAL(5,2),
  mapping_source VARCHAR(32) NOT NULL DEFAULT 'rule',
  final_selected TINYINT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_content_mapping_job FOREIGN KEY (job_id) REFERENCES content_analysis_job(id),
  CONSTRAINT fk_content_mapping_candidate FOREIGN KEY (candidate_id) REFERENCES content_movement_candidate(id),
  CONSTRAINT fk_content_mapping_exercise FOREIGN KEY (exercise_id) REFERENCES exercise(id),
  UNIQUE KEY uk_content_mapping_candidate_exercise (candidate_id, exercise_id),
  KEY idx_content_mapping_job_final (job_id, final_selected),
  KEY idx_content_mapping_job_score (job_id, match_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 38. content_plan_draft
CREATE TABLE content_plan_draft (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  job_id BIGINT NOT NULL,
  plan_type VARCHAR(16) NOT NULL,
  option_index INT NOT NULL,
  style VARCHAR(32),
  title VARCHAR(128) NOT NULL,
  summary VARCHAR(512),
  structure_json JSON NOT NULL,
  status_label VARCHAR(32) NOT NULL DEFAULT 'draft',
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME(3) NOT NULL,
  update_time DATETIME(3) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_content_plan_job FOREIGN KEY (job_id) REFERENCES content_analysis_job(id),
  UNIQUE KEY uk_content_plan_job_option (job_id, option_index),
  KEY idx_content_plan_job_status (job_id, status_label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
