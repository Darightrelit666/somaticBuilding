# SomaticBuilding / Physical OS - 待开发清单（全量）

更新时间：2026-04-05（Asia/Shanghai）

> 说明：该清单包含**前端剩余工作 + 数据库/后端**。已完成部分不再列入（训练执行逻辑已完成）。

---

## 1. 数据库与后端（MySQL）
- 建立数据模型与表关系（用户、动作库、训练编排、评估、画像、训练日志等）
- 数据结构与接口规范（REST 或 RPC 约定）
- 基础认证与用户会话数据对接
- 评估结果、训练模板、训练记录的持久化
- 数据迁移策略与示例种子数据

---

## 2. 动作库系统（数据流 & 逻辑闭环）
- 筛选器逻辑真正生效（肌群/器械/难度/类别）
- 动作详情页与“加入编排”完整数据流
- Cart → 编排页面的稳定数据传递与状态同步
- 动作库数据结构与后端接口对接

---

## 3. 训练编排系统（交互补齐）
- 模板系统逻辑闭环
  - 保存模板
  - 应用模板不覆盖原有 block 结构
  - 模板动作正确映射到编排区
- 拖拽细节完善
  - 动作进入 block 后从 cart 消失
  - 支持再次拖拽到其他 block
  - 支持删除与顺序调整
- 训练组（group）类型的结构化落地
  - Straight Sets / Superset / Circuit 等作为真实结构而非标签

---

## 4. 体态/关节系统（视觉与交互微调）
- 关节点与引线位置微调（与模型对齐）
- 点击关节后的联动数据一致性优化
- 评估历史入口与“再次评估”入口接入 profile
- 体态系统数据与评估记录的后端联动

---

## 5. 评估流程系统（数据整合）
- 评估流程各阶段数据结构化存储（基础信息/目标/动作评估）
- 评估结果与能力画像的历史记录机制
- 评估结果反哺训练推荐逻辑（数据接口预留）

---

## 6. 个人画像与目标系统
- 目标输入 → AI解析结果的结构化落库
- Ability Profile 历史数据与趋势展示
- Profile 内“阶段目标更新 / 再设定”入口逻辑

---

## 7. 全局体验一致性
- Logo/项目名称全局统一
- AppShell 与各路由页风格一致化
- 空状态 / 错误状态统一策略
- 响应式细节微调（移动端可用性）

---

## 8. 训练记录与推荐
- 训练执行结果写入训练历史
- 推荐训练课/模块的数据结构与展示逻辑
- 历史记录入口与汇总页关联

---

## 9. 虚拟人物助手（AI 对话）
- 设计 AI 对话数据模型（会话、消息、状态）
- 对话历史存储与查询策略（后端 + 缓存）
- 前端对话界面与交互设计
- 虚拟人物形象与动效设计（悬浮助手扩展）

---

## 10. Video Link -> Training Plan (New)
- Input mainstream platform links (Bilibili / Douyin / Xiaohongshu) and create analysis jobs.
- Build fallback path for user-supplied material: upload video / keyframes / subtitle text.
- Add async content analysis pipeline: parse -> candidate movements -> exercise mapping.
- Add candidate review gate before plan generation/apply.
- Generate structured options for both quick module and full training course.
- Support preview-first flow, then apply to workout builder/template.
- Define retention/deletion policy for uploaded media and derived artifacts.
- Track confidence score + failure reasons for each analysis job.
