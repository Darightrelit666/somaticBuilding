# SomaticBuilding / Physical OS - API 请求/响应规范

更新时间：2026-04-06（Asia/Shanghai）

说明：按“最常用链路优先”逐模块补充。

---

## ① Exercise Library（已确认）

### 1. 获取动作列表
**GET /exercise/list**

Query 参数  
- `keyword` (string, 可选)  
- `tag_ids` (string, 可选，逗号分隔)  
- `difficulty` (int, 可选)  
- `equipment` (string, 可选)  
- `page` (int, 默认 1)  
- `page_size` (int, 默认 20)

响应
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 101,
        "name": "Bench Press",
        "primary_muscle": "Chest",
        "equipment": "Barbell",
        "difficulty": 2,
        "cover_url": "https://..."
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 128
  }
}
```

---

## User Profile Nickname Availability
### 1. Check nickname availability
**GET /user/profile/display-name/availability**

Query params:
- `display_name` (string, required)
- `user_id` (number, optional, used to ignore current user's own nickname)

Response:
```json
{
  "code": 0,
  "data": {
    "available": true,
    "display_name": "SomaticHero"
  }
}
```

---

## ② Cart（已确认）

### 1. 获取购物车
**GET /cart**

响应
```json
{
  "code": 0,
  "data": {
    "cart_id": 1001,
    "items": [
      { "id": 1, "exercise_id": 101, "name": "Bench Press", "cover_url": "https://..." }
    ]
  }
}
```

---

## ③ Workout Builder（已确认）

### 1. 新建训练编排（自动生成固定 Blocks）
**POST /workout/session**

请求
```json
{
  "session_name": "Upper Body Strength",
  "training_style": "Strength & Conditioning"
}
```

---

## ④ Template（已确认）

### 1. 获取模板列表
**GET /template/list**

响应
```json
{
  "code": 0,
  "data": [
    { "id": 501, "template_name": "Upper Strength A" }
  ]
}
```

---

## ⑤ Training Run（已确认）

### 1. 开始训练
**POST /training/run**

请求
```json
{
  "session_id": 2001
}
```

---

## ⑥ Recovery（已确认）

### 1. 记录恢复建议
**POST /recovery**

请求
```json
{
  "run_id": 9001,
  "rpe": 8,
  "sleep_score": 2,
  "fatigue_score": 4,
  "suggestion": "建议48小时内进行低强度训练或恢复"
}
```

---

## ⑦ Profile / Ability（已确认）

### 1. 获取能力画像（最新）
**GET /ability/profile/latest**

响应
```json
{
  "code": 0,
  "data": {
    "strength": 85,
    "power": 70,
    "endurance": 60,
    "mobility": 75,
    "stability": 80,
    "speed": 65
  }
}
```

---

## ⑧ Assessment + Posture（已确认）

### A. 评估流程

#### 1. 创建评估 Session
**POST /assessment/session**

请求
```json
{
  "user_id": 1
}
```

响应
```json
{ "code": 0, "data": { "id": 3001 } }
```

#### 2. 获取评估 Session
**GET /assessment/session/:id**

响应
```json
{
  "code": 0,
  "data": {
    "id": 3001,
    "status": 1,
    "start_time": "2026-04-06 09:00:00.000"
  }
}
```

#### 3. 更新评估步骤
**POST /assessment/step**

请求
```json
{
  "session_id": 3001,
  "step_type": "baseline",
  "step_status": 1
}
```

响应
```json
{ "code": 0 }
```

#### 4. 获取评估测试列表
**GET /assessment/test/list?session_id=3001**

响应
```json
{
  "code": 0,
  "data": [
    { "id": 401, "name": "Deep Squat", "status": 0 }
  ]
}
```

#### 5. 提交测试结果
**POST /assessment/test/result**

请求
```json
{
  "test_id": 401,
  "score": 2,
  "note": "Knee valgus detected"
}
```

响应
```json
{ "code": 0 }
```

#### 6. 获取评估结果
**GET /assessment/result?session_id=3001**

响应
```json
{
  "code": 0,
  "data": {
    "summary": "Lower limb instability",
    "joint_metrics": [
      { "joint": "Left Ankle", "mobility": 45, "stability": 70 }
    ],
    "risk_alerts": [
      { "joint": "Left Ankle", "severity": 2, "message": "ROM deficit" }
    ]
  }
}
```

### B. 体态快照

#### 7. 创建体态快照
**POST /posture/snapshot**

请求
```json
{
  "session_id": 3001,
  "summary": "Left ankle restriction"
}
```

响应
```json
{ "code": 0, "data": { "id": 6001 } }
```

#### 8. 获取体态快照
**GET /posture/snapshot?session_id=3001**

响应
```json
{
  "code": 0,
  "data": [
    { "id": 6001, "snapshot_time": "2026-04-06 09:10:00.000" }
  ]
}
```

#### 9. 获取关节状态
**GET /posture/joint-state?snapshot_id=6001**

响应
```json
{
  "code": 0,
  "data": [
    { "joint_name": "Left Ankle", "status": 2, "note": "ROM deficit" }
  ]
}
```

### 2. 获取能力画像历史
**GET /ability/history**

响应
```json
{
  "code": 0,
  "data": [
    { "record_time": "2026-04-01 10:00:00.000", "strength": 82, "power": 68 }
  ]
}
```

### 3. 获取用户 Profile
**GET /user/profile**

响应
```json
{
  "code": 0,
  "data": {
    "display_name": "heiyuk6",
    "gender": 1,
    "age": 23,
    "height_cm": 175,
    "weight_kg": 70.5
  }
}
```

响应
```json
{ "code": 0 }
```

### 2. 获取最近恢复建议
**GET /recovery/latest**

响应
```json
{
  "code": 0,
  "data": {
    "run_id": 9001,
    "rpe": 8,
    "sleep_score": 2,
    "fatigue_score": 4,
    "suggestion": "建议48小时内进行低强度训练或恢复"
  }
}
```

响应
```json
{ "code": 0, "data": { "id": 9001 } }
```

### 2. 更新训练状态
**PUT /training/run/:id**

请求
```json
{
  "status": 2
}
```

响应
```json
{ "code": 0 }
```

### 3. 记录组数
**POST /training/set-log**

请求
```json
{
  "run_id": 9001,
  "exercise_id": 101,
  "set_index": 1,
  "reps": 10,
  "weight_kg": 60
}
```

响应
```json
{ "code": 0 }
```

### 4. 记录计时段
**POST /training/timer-log**

请求
```json
{
  "run_id": 9001,
  "phase_type": "work",
  "duration_seconds": 45
}
```

响应
```json
{ "code": 0 }
```

### 5. 记录动作执行
**POST /training/exercise-log**

请求
```json
{
  "run_id": 9001,
  "exercise_id": 101,
  "start_time": "2026-04-06 10:01:00.000",
  "end_time": "2026-04-06 10:02:00.000"
}
```

响应
```json
{ "code": 0 }
```

### 6. 训练历史
**GET /training/history**

响应
```json
{
  "code": 0,
  "data": [
    { "run_id": 9001, "session_id": 2001, "start_time": "2026-04-06 10:00:00.000" }
  ]
}
```

### 2. 新建模板
**POST /template**

请求
```json
{
  "template_name": "Upper Strength A",
  "exercise_ids": [101, 102, 103]
}
```

响应
```json
{ "code": 0, "data": { "id": 501 } }
```

### 3. 获取模板详情
**GET /template/:id**

响应
```json
{
  "code": 0,
  "data": {
    "id": 501,
    "template_name": "Upper Strength A",
    "exercises": [
      { "exercise_id": 101, "sets": 3, "reps": 10 }
    ]
  }
}
```

### 4. 删除模板
**DELETE /template/:id**

响应
```json
{ "code": 0 }
```

响应
```json
{
  "code": 0,
  "data": {
    "id": 2001,
    "blocks": [
      { "id": 11, "block_name": "Warmup", "order_index": 1 },
      { "id": 12, "block_name": "Strength", "order_index": 2 }
    ]
  }
}
```

### 2. 获取训练编排
**GET /workout/session/:id**

响应
```json
{
  "code": 0,
  "data": {
    "id": 2001,
    "session_name": "Upper Body Strength",
    "training_style": "Strength & Conditioning",
    "blocks": [
      {
        "id": 11,
        "block_name": "Warmup",
        "order_index": 1,
        "groups": [
          {
            "id": 31,
            "group_type": "straight",
            "order_index": 1,
            "exercises": [
              { "id": 81, "exercise_id": 101, "sets": 3, "reps": 12, "rest_seconds": 60 }
            ]
          }
        ]
      }
    ]
  }
}
```

### 3. 更新训练编排信息
**PUT /workout/session/:id**

请求
```json
{
  "session_name": "Upper Body Strength",
  "training_style": "Strength & Conditioning"
}
```

响应
```json
{ "code": 0 }
```

### 4. 新增 Group
**POST /workout/group**

请求
```json
{
  "block_id": 12,
  "group_type": "superset",
  "order_index": 1
}
```

响应
```json
{ "code": 0, "data": { "id": 32 } }
```

### 5. 新增 Exercise
**POST /workout/exercise**

请求
```json
{
  "group_id": 32,
  "exercise_id": 101,
  "sets": 3,
  "reps": 10,
  "rest_seconds": 60,
  "time_seconds": 0,
  "rounds": 1,
  "order_index": 1
}
```

响应
```json
{ "code": 0, "data": { "id": 90 } }
```

### 6. 删除 Exercise
**DELETE /workout/exercise/:id**

响应
```json
{ "code": 0 }
```

### 2. 加入购物车
**POST /cart/item**

请求
```json
{
  "exercise_id": 101
}
```

响应
```json
{ "code": 0, "data": { "id": 1 } }
```

### 3. 删除购物车动作
**DELETE /cart/item/:id**

响应
```json
{ "code": 0 }
```

### 2. 获取动作详情
**GET /exercise/:id**

响应
```json
{
  "code": 0,
  "data": {
    "id": 101,
    "name": "Bench Press",
    "primary_muscle": "Chest",
    "equipment": "Barbell",
    "difficulty": 2,
    "description": "..."
  }
}
```

### 3. 获取动作媒体
**GET /exercise/:id/media**

响应
```json
{
  "code": 0,
  "data": [
    { "url": "https://...", "media_type": "image", "cover_flag": 1 }
  ]
}
```

### 4. 获取标签（筛选用）
**GET /exercise/tags**

响应
```json
{
  "code": 0,
  "data": [
    { "id": 1, "tag_type": "muscle", "tag_name": "Chest" },
    { "id": 2, "tag_type": "equipment", "tag_name": "Barbell" }
  ]
}
```

---

## 鈽匔I Assistant Goal Synthesis锛堟柊澧烇級
### 1. Goal Analysis
**POST /assistant/goal-synthesis**

璇锋眰
```json
{
  "user_id": 1,
  "goal_input": "Increase strength while keeping movement quality and protecting previous injuries.",
  "lifestyle_profile": "discipline:powerlifting | history:lumbar issue | level:advanced"
}
```

鍝嶅簲
```json
{
  "code": 0,
  "data": {
    "summary": "Primary objective emphasizes Strength and Control while monitoring Mobility.",
    "recommendation": "Begin with mobility prep and increase load progressively after alignment checks.",
    "radar": [
      { "subject": "Mobility", "score": 68, "fullMark": 100 },
      { "subject": "Stability", "score": 72, "fullMark": 100 },
      { "subject": "Control", "score": 78, "fullMark": 100 },
      { "subject": "Strength", "score": 84, "fullMark": 100 },
      { "subject": "Power", "score": 70, "fullMark": 100 },
      { "subject": "Endurance", "score": 63, "fullMark": 100 }
    ],
    "targets": [
      { "label": "Hypertrophy", "score": 74, "level": "High" },
      { "label": "Neural Adaptation", "score": 71, "level": "High" },
      { "label": "Injury Rehab", "score": 66, "level": "Med" },
      { "label": "Metabolic Stress", "score": 58, "level": "Med" }
    ]
  }
}
```
