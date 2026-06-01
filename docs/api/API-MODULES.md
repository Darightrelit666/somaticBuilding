# SomaticBuilding / Physical OS - API 模块划分与接口清单

更新时间：2026-04-06（Asia/Shanghai）

## 1. Auth / User
- `POST /auth/register`
- `POST /auth/login`
- `GET /user/profile`
- `PUT /user/profile`
- `GET /user/profile/display-name/availability`

## 2. Assessment / System Flow
- `POST /assessment/session`
- `GET /assessment/session/:id`
- `POST /assessment/step`
- `GET /assessment/test/list?session_id=`
- `POST /assessment/test/result`
- `GET /assessment/result?session_id=`
- `GET /assessment/alerts?session_id=`

## 3. Posture System
- `GET /posture/snapshot?session_id=`
- `POST /posture/snapshot`
- `GET /posture/joint-state?snapshot_id=`

## 4. Goal & Ability Profile
- `POST /goal/input`
- `GET /goal/latest`
- `GET /ability/profile/latest`
- `GET /ability/history`

## 5. Exercise Library
- `GET /exercise/list`
- `GET /exercise/:id`
- `GET /exercise/tags`

## 6. Cart
- `GET /cart`
- `POST /cart/item`
- `DELETE /cart/item/:id`

## 7. Template
- `GET /template/list`
- `POST /template`
- `GET /template/:id`
- `DELETE /template/:id`

## 8. Workout Builder / Session
- `POST /workout/session`
- `GET /workout/session/:id`
- `PUT /workout/session/:id`
- `POST /workout/block`
- `POST /workout/group`
- `POST /workout/exercise`
- `DELETE /workout/exercise/:id`

## 9. Training Run
- `POST /training/run`
- `PUT /training/run/:id`
- `POST /training/set-log`
- `POST /training/timer-log`
- `POST /training/exercise-log`
- `GET /training/history`

## 10. Recovery
- `POST /recovery`
- `GET /recovery/latest`

## 11. Recommendation / History
- `GET /recommendation`
- `GET /history`

## 12. AI Assistant
- `POST /assistant/session`
- `GET /assistant/session/:id`
- `GET /assistant/messages?session_id=`
- `POST /assistant/chat`
- `POST /assistant/goal-synthesis`
