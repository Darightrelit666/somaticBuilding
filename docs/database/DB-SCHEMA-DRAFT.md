# SomaticBuilding / Physical OS - MySQL 表结构草案（按规范）

更新时间：2026-04-06（Asia/Shanghai）

说明：
- 按 DB-DESIGN-SPEC.md 规范执行（InnoDB / DATETIME(3) / 逻辑删除等）。
- 先提供字段草案，后续再补充索引与约束细节。

---

## 第 1 组：用户与基础信息（已确认）

### 1. `user_account`
- `id` BIGINT PK  
- `email` VARCHAR(128) UNIQUE  
- `phone` CHAR(11) UNIQUE  
- `password_hash` VARCHAR(255)  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 2. `user_profile`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `display_name` VARCHAR(64)  
- `gender` TINYINT (0=未知/1=男/2=女)  
- `age` TINYINT  
- `height_cm` SMALLINT  
- `weight_kg` DECIMAL(5,2)  
- `training_years` TINYINT  
- `lifestyle_note` VARCHAR(255)  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 3. `user_oauth`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `provider` VARCHAR(32)  
- `open_id` VARCHAR(128)  
- `union_id` VARCHAR(128)  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

---

## 第 2 组：评估系统（含体态快照）（已确认）

### 1. `assessment_session`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `status` TINYINT DEFAULT 1  
- `start_time` DATETIME(3)  
- `end_time` DATETIME(3)  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 2. `assessment_step`
- `id` BIGINT PK  
- `session_id` BIGINT FK  
- `step_type` VARCHAR(64)  (baseline / goals / intro / test / summary)  
- `step_status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 3. `assessment_test`
- `id` BIGINT PK  
- `session_id` BIGINT FK  
- `name` VARCHAR(128)  
- `category` VARCHAR(64)  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 4. `assessment_result`
- `id` BIGINT PK  
- `test_id` BIGINT FK  
- `score` INT  
- `note` VARCHAR(255)  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 5. `joint_metric`
- `id` BIGINT PK  
- `result_id` BIGINT FK  
- `joint_name` VARCHAR(64)  
- `mobility` INT  
- `stability` INT  
- `motor_control` INT  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 6. `risk_alert`
- `id` BIGINT PK  
- `result_id` BIGINT FK  
- `joint_name` VARCHAR(64)  
- `severity` TINYINT  
- `message` VARCHAR(255)  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 7. `posture_snapshot`
- `id` BIGINT PK  
- `session_id` BIGINT FK  
- `snapshot_time` DATETIME(3)  
- `summary` VARCHAR(255)  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 8. `posture_joint_state`
- `id` BIGINT PK  
- `snapshot_id` BIGINT FK  
- `joint_name` VARCHAR(64)  
- `status` TINYINT  
- `note` VARCHAR(255)  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

---

## 第 3 组：动作库 + 训练编排（已确认）

### 1. `exercise`
- `id` BIGINT PK  
- `name` VARCHAR(128)  
- `primary_muscle` VARCHAR(64)  
- `equipment` VARCHAR(64)  
- `difficulty` TINYINT  
- `description` TEXT  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 2. `exercise_media`
- `id` BIGINT PK  
- `exercise_id` BIGINT FK  
- `media_type` VARCHAR(32)  (image/gif/video)  
- `url` VARCHAR(255)  
- `cover_flag` TINYINT DEFAULT 0  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 3. `exercise_tag`
- `id` BIGINT PK  
- `tag_type` VARCHAR(32)  (muscle/equipment/difficulty/type/style)  
- `tag_name` VARCHAR(64)  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 4. `exercise_tag_map`
- `id` BIGINT PK  
- `exercise_id` BIGINT FK  
- `tag_id` BIGINT FK  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 5. `exercise_cart`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 6. `cart_item`
- `id` BIGINT PK  
- `cart_id` BIGINT FK  
- `exercise_id` BIGINT FK  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 7. `workout_template`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `template_name` VARCHAR(128)  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 8. `template_exercise`
- `id` BIGINT PK  
- `template_id` BIGINT FK  
- `exercise_id` BIGINT FK  
- `sets` INT  
- `reps` INT  
- `rest_seconds` INT  
- `time_seconds` INT  
- `rounds` INT  
- `order_index` INT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 9. `workout_session`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `session_name` VARCHAR(128)  
- `training_style` VARCHAR(64)  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 10. `workout_block`
- `id` BIGINT PK  
- `session_id` BIGINT FK  
- `block_name` VARCHAR(64)  
- `order_index` INT  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 11. `workout_group`
- `id` BIGINT PK  
- `block_id` BIGINT FK  
- `group_type` VARCHAR(32) (straight/superset/circuit/interval)  
- `order_index` INT  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 12. `workout_exercise`
- `id` BIGINT PK  
- `group_id` BIGINT FK  
- `exercise_id` BIGINT FK  
- `sets` INT  
- `reps` INT  
- `rest_seconds` INT  
- `time_seconds` INT  
- `rounds` INT  
- `order_index` INT  
- `status` TINYINT DEFAULT 1  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

---

## 第 4 组：训练执行日志 + 推荐与历史（已确认）

### 1. `training_run`
- `id` BIGINT PK  
- `session_id` BIGINT FK  
- `user_id` BIGINT FK  
- `start_time` DATETIME(3)  
- `end_time` DATETIME(3)  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 2. `set_log`
- `id` BIGINT PK  
- `run_id` BIGINT FK  
- `exercise_id` BIGINT FK  
- `set_index` INT  
- `reps` INT  
- `weight_kg` DECIMAL(6,2)  
- `duration_seconds` INT  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 3. `timer_log`
- `id` BIGINT PK  
- `run_id` BIGINT FK  
- `phase_type` VARCHAR(32) (work/rest)  
- `duration_seconds` INT  
- `start_time` DATETIME(3)  
- `end_time` DATETIME(3)  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 4. `exercise_log`
- `id` BIGINT PK  
- `run_id` BIGINT FK  
- `exercise_id` BIGINT FK  
- `start_time` DATETIME(3)  
- `end_time` DATETIME(3)  
- `status` TINYINT  
- `note` VARCHAR(255)  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 5. `recommendation`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `rec_type` VARCHAR(32)  
- `ref_id` BIGINT  
- `reason` VARCHAR(255)  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 6. `history_log`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `event_type` VARCHAR(32)  
- `ref_id` BIGINT  
- `event_time` DATETIME(3)  
- `note` VARCHAR(255)  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 7. `recovery_log`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `run_id` BIGINT FK  
- `rpe` TINYINT  
- `sleep_score` TINYINT  
- `fatigue_score` TINYINT  
- `suggestion` VARCHAR(255)  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

---

## 第 5 组：目标与能力画像（已确认）

### 1. `goal_input`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `raw_text` TEXT  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

---

## 索引与约束设计（按业务流重新确认）

### 1. 用户与基础信息
**`user_account`**
- PK: `id`
- UNIQUE: `email`
- UNIQUE: `phone`

**`user_profile`**
- PK: `id`
- UNIQUE: `user_id`
- UNIQUE: `display_name`

### 2. 评估系统 & 体态快照
**`assessment_session`**
- PK: `id`
- INDEX: `(user_id, create_time)`

**`assessment_step`**
- PK: `id`
- INDEX: `(session_id, step_type)`

**`assessment_test`**
- PK: `id`
- INDEX: `(session_id, status)`

**`assessment_result`**
- PK: `id`
- INDEX: `test_id`

**`joint_metric`**
- PK: `id`
- INDEX: `(result_id, joint_name)`

**`risk_alert`**
- PK: `id`
- INDEX: `(result_id, severity)`

**`posture_snapshot`**
- PK: `id`
- INDEX: `(session_id, snapshot_time)`

**`posture_joint_state`**
- PK: `id`
- INDEX: `(snapshot_id, joint_name)`

### 3. 动作库
**`exercise`**
- PK: `id`
- UNIQUE: `name`（若动作名全局唯一）

**`exercise_media`**
- PK: `id`
- INDEX: `(exercise_id, cover_flag)`

**`exercise_tag`**
- PK: `id`
- UNIQUE: `(tag_type, tag_name)`

**`exercise_tag_map`**
- PK: `id`
- UNIQUE: `(exercise_id, tag_id)`
- INDEX: `tag_id`

### 4. 购物车 & 模板
**`exercise_cart`**
- PK: `id`
- UNIQUE: `user_id`

**`cart_item`**
- PK: `id`
- UNIQUE: `(cart_id, exercise_id)`
- INDEX: `cart_id`

**`workout_template`**
- PK: `id`
- UNIQUE: `(user_id, template_name)`
- INDEX: `(user_id, create_time)`

**`template_exercise`**
- PK: `id`
- INDEX: `(template_id, order_index)`

### 5. 训练编排
**`workout_session`**
- PK: `id`
- INDEX: `(user_id, create_time)`
- INDEX: `(user_id, training_style)`

**`workout_block`**
- PK: `id`
- INDEX: `(session_id, order_index)`

**`workout_group`**
- PK: `id`
- INDEX: `(block_id, order_index)`

**`workout_exercise`**
- PK: `id`
- INDEX: `(group_id, order_index)`
- INDEX: `(exercise_id, create_time)`

### 6. 训练执行与记录
**`training_run`**
- PK: `id`
- INDEX: `(user_id, start_time)`
- INDEX: `session_id`

**`set_log`**
- PK: `id`
- INDEX: `(run_id, set_index)`
- INDEX: `(exercise_id, create_time)`

**`timer_log`**
- PK: `id`
- INDEX: `(run_id, start_time)`

**`exercise_log`**
- PK: `id`
- INDEX: `(run_id, start_time)`

### 7. 恢复建议
**`recovery_log`**
- PK: `id`
- INDEX: `(user_id, create_time)`
- INDEX: `run_id`

### 8. 目标与能力画像
**`goal_input`**
- PK: `id`
- INDEX: `(user_id, create_time)`

**`goal_parsed`**
- PK: `id`
- UNIQUE: `goal_id`

**`ability_profile`**
- PK: `id`
- INDEX: `(user_id, create_time)`

**`ability_history`**
- PK: `id`
- INDEX: `(profile_id, record_time)`

### 2. `goal_parsed`
- `id` BIGINT PK  
- `goal_id` BIGINT FK  
- `parsed_json` TEXT  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 3. `ability_profile`
- `id` BIGINT PK  
- `user_id` BIGINT FK  
- `strength` INT  
- `power` INT  
- `endurance` INT  
- `mobility` INT  
- `stability` INT  
- `speed` INT  
- `status` TINYINT  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  

### 4. `ability_history`
- `id` BIGINT PK  
- `profile_id` BIGINT FK  
- `record_time` DATETIME(3)  
- `delta_json` TEXT  
- `note` VARCHAR(255)  
- `create_time` DATETIME(3)  
- `update_time` DATETIME(3)  
- `is_deleted` TINYINT DEFAULT 0  
