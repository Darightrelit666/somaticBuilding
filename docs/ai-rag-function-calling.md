# AI 编排 + RAG + Function Calling 实施说明

更新时间：2026-04-21（Asia/Shanghai）

## 1. 目标与边界

本项目已将 AI 助手拆成两条独立能力线，避免“训练编排”和“知识问答”互相污染：

1. `Plan` 路由：训练编排（Function Calling 风格）
2. `QA` 路由：RAG 知识问答

这两条路由在前端可显式切换，在后端也独立处理。

## 2. 已落地能力（后端）

### 2.1 AI 助手接口

文件：
- `backend/ai-assistant-service/src/main/java/com/somaticbuilding/aiassistant/interfaces/AiAssistantController.java`

已提供接口：
- `POST /api/v1/assistant/session`
- `GET /api/v1/assistant/session/{id}`
- `GET /api/v1/assistant/messages?session_id=...`
- `POST /api/v1/assistant/chat`
- `POST /api/v1/assistant/goal-synthesis`

### 2.2 Plan / QA 双路由

文件：
- `backend/ai-assistant-service/src/main/java/com/somaticbuilding/aiassistant/application/AiAssistantService.java`

关键逻辑：
- `mode=plan|qa|auto` 三种模式，后端统一入口分流。
- `plan` 分支：识别训练编排意图 -> 生成结构化方案。
- `qa` 分支：RAG 检索 + 问答输出。

### 2.3 Function Calling 风格编排（结构化协议）

当前实现不是“供应商原生 tool call”，而是**稳定的结构化 JSON 协议**，用于前后端联动：
- 后端在回复文本中注入 `[SB_PLAN_JSON]...[/SB_PLAN_JSON]`
- Payload 类型已支持：
  - `plan-scope`：先问“完整训练课 / 快速模块”
  - `plan-intake`：补齐器械、场地、频率、时长
  - `plan-options`：返回 3 套可预览可确认方案（含 blocks/items 参数）

方案数据包含：
- `planKind`（`course` / `module`）
- `programWeeks`、`sessionsPerWeek`、`sessionMinutes`
- `days[] -> blocks[] -> items[]`
- item 参数：`sets/reps/restSeconds/timeSeconds/rounds/groupMethod` 等

### 2.4 方案微调闭环

已支持在会话内微调（如“微调 A，减轻膝压力，改 45 分钟”）：
- 识别目标方案（A/B/C）
- 应用微调规则
- 返回 diff 说明
- 回传新的结构化 `plan-options`，供前端重新预览后确认

### 2.5 RAG 问答路径

文件：
- `backend/ai-assistant-service/src/main/java/com/somaticbuilding/aiassistant/application/RagKnowledgeService.java`

已实现：
- classpath 知识库加载：`classpath*:rag-kb/*.md`
- 外部目录加载：`./knowledge-base`（`.md/.txt`）
- 本地分块、token 检索、top-k 排序
- QA 提示中注入参考上下文，回答支持 `[R#]` 标注
- 模型不可用时，返回基于 RAG 的 fallback 答案

## 3. 已落地能力（前端）

### 3.1 悬浮 AI 助手双入口

文件：
- `src/shared/components/AppShell.tsx`

已实现：
- 悬浮窗内 `Plan` / `Q&A` 切换（机器人图标与双 tab）
- 文案与路由模式联动：
  - Plan：`Function Calling`
  - Q&A：`RAG Knowledge QA`

### 3.2 结构化 payload 可视化

已实现：
- `plan-scope`：渲染选择按钮（完整训练课 / 快速模块）
- `plan-intake`：渲染缺失条件与示例按钮
- `plan-options`：渲染 A/B/C 卡片、详情展开、确认、保存、打开预览

### 3.3 与训练模块联动

已实现：
- `course` 方案可写入 Workout Builder 草稿并跳转 `/workout-builder`
- `module` 方案可写入 Quick Module 草稿并跳转 `/modules`
- 支持“先预览再确认”，并可继续对话微调

前端接口文件：
- `src/shared/api/assistant.ts`

## 4. Goal Synthesis（系统评估联动）

已实现目标输入结构化分析接口：
- `POST /api/v1/assistant/goal-synthesis`
- 返回 `summary/recommendation/radar/targets` 标准结构
- 前端对多种返回字段命名做兼容归一化

## 5. 当前限制与风险

1. 当前“Function Calling”是结构化 JSON 协议，不是原生工具调用 API。
2. 若模型 key 余额不足或服务不可用，前端会进入降级提示/后端 fallback。
3. RAG 当前为本地检索增强，未做 embedding 向量库与重排序。
4. 专业教材/论文导入需先确认版权授权。

## 6. 下一步建议

1. 将结构化协议升级为标准 Tool Schema（可观测每次工具调用参数）。
2. 增加 RAG 来源管理（来源白名单、版本号、更新时间、可追溯引用）。
3. 增加编排结果审计日志（输入条件、方案版本、微调 diff、最终确认记录）。
4. 为 AI 编排增加端到端回归脚本（scope -> intake -> options -> preview -> confirm）。
