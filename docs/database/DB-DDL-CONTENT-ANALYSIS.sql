-- SomaticBuilding / Physical OS
-- Content Analysis + Video Link -> Training Plan
-- Updated: 2026-05-02 (Asia/Shanghai)
-- Engine: InnoDB
-- Charset: utf8mb4
--
-- Execution prerequisite:
-- 1) Database `somaticbuilding_db` already created
-- 2) Base tables already created (especially `user_account`, `exercise`)
--
-- Suggested execution position:
-- After base workout/profile tables from DB-INIT.sql

USE somaticbuilding_db;

-- 1) Job lifecycle table
CREATE TABLE IF NOT EXISTS content_analysis_job (
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
  CONSTRAINT fk_content_analysis_job_user
    FOREIGN KEY (user_id) REFERENCES user_account(id),
  KEY idx_content_job_user_time (user_id, create_time),
  KEY idx_content_job_pipeline_status (pipeline_status, update_time),
  KEY idx_content_job_platform_video (source_platform, source_video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Input/derived assets for each job
CREATE TABLE IF NOT EXISTS content_analysis_asset (
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
  CONSTRAINT fk_content_asset_job
    FOREIGN KEY (job_id) REFERENCES content_analysis_job(id),
  KEY idx_content_asset_job_type (job_id, asset_type),
  KEY idx_content_asset_job_time (job_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Movement candidates recognized from content
CREATE TABLE IF NOT EXISTS content_movement_candidate (
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
  CONSTRAINT fk_content_candidate_job
    FOREIGN KEY (job_id) REFERENCES content_analysis_job(id),
  KEY idx_content_candidate_job_review (job_id, review_state),
  KEY idx_content_candidate_job_conf (job_id, confidence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) Mapping candidate -> exercise library entries
CREATE TABLE IF NOT EXISTS content_exercise_mapping (
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
  CONSTRAINT fk_content_mapping_job
    FOREIGN KEY (job_id) REFERENCES content_analysis_job(id),
  CONSTRAINT fk_content_mapping_candidate
    FOREIGN KEY (candidate_id) REFERENCES content_movement_candidate(id),
  CONSTRAINT fk_content_mapping_exercise
    FOREIGN KEY (exercise_id) REFERENCES exercise(id),
  UNIQUE KEY uk_content_mapping_candidate_exercise (candidate_id, exercise_id),
  KEY idx_content_mapping_job_final (job_id, final_selected),
  KEY idx_content_mapping_job_score (job_id, match_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) Generated plan options before apply
CREATE TABLE IF NOT EXISTS content_plan_draft (
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
  CONSTRAINT fk_content_plan_job
    FOREIGN KEY (job_id) REFERENCES content_analysis_job(id),
  UNIQUE KEY uk_content_plan_job_option (job_id, option_index),
  KEY idx_content_plan_job_status (job_id, status_label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

