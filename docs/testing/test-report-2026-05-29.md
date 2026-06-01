# SomaticBuilding 单元测试与集成测试报告

日期：2026-05-29

## 1. 测试建设目标

本次测试建设目标不是重写功能，而是在现有功能基础上补齐可运行、可复现、可展示的自动化测试体系，重点覆盖近期高风险链路：

- AI 训练计划生成中的动作名安全过滤，防止“目标描述句/解释句”被错误创建为动作。
- 短视频解析和自然语言训练生成相关的动作自动补全安全边界。
- TrainingHub 真实数据流涉及的推荐与训练历史读取接口。
- training-service 的训练执行记录、训练历史和训练总结统计逻辑。
- Web Controller 层接口响应结构，确保前端接入的 JSON 数据格式稳定。

## 2. 测试类型

| 类型 | 技术栈 | 覆盖对象 | 是否连接真实数据库 | 是否调用真实 AI |
|---|---|---|---|---|
| 前端单元测试 | Vitest | 工具函数、API 响应解析 | 否 | 否 |
| 后端单元测试 | JUnit 5 + Mockito | Service 业务逻辑、AI 自动补动作安全判断 | 否 | 否 |
| 后端集成测试 | Spring Boot Test + MockMvc | Controller HTTP 接口层、JSON 响应结构 | 否，使用 mock service | 否 |
| 生产构建验证 | Vite build | 前端完整打包链路 | 否 | 否 |

说明：本轮测试刻意不接真实 MySQL、Redis 和第三方 AI，避免测试不稳定、产生费用或污染真实业务数据。对答辩而言，这属于合理的“可重复自动化测试环境”，适合放入工程质量说明。

## 3. 新增测试文件

### 3.1 前端测试

| 文件 | 测试内容 |
|---|---|
| `src/shared/utils/exerciseLabelSafety.test.ts` | 验证具体动作名可以通过，训练目标/解释性句子会被拦截，`Exercise #12`、`动作3` 等占位名会被拦截。 |
| `src/shared/api/recommendation.test.ts` | 验证 recommendation-service 返回的后端数据可以被前端正确归一化；验证后端错误响应会被正确抛出。 |

### 3.2 后端测试

| 文件 | 测试内容 |
|---|---|
| `backend/ai-assistant-service/src/test/java/com/somaticbuilding/aiassistant/application/ExerciseAutoProvisionServiceTest.java` | 验证 AI 自动补动作不会把中文训练目标描述句、英文解释句创建成动作；验证危险标签会在视频片段提取前被拦截。 |
| `backend/training-service/src/test/java/com/somaticbuilding/training/application/TrainingServiceTest.java` | 验证创建训练 run 时默认状态、用户、session 和时间字段正确；验证训练总结会基于真实 set/timer/exercise log 聚合总次数、总重量、总时长、动作数、跳过动作数。 |
| `backend/training-service/src/test/java/com/somaticbuilding/training/interfaces/TrainingControllerIntegrationTest.java` | 使用 MockMvc 验证 `/api/v1/training/run` 和 `/api/v1/training/history` 的 HTTP 响应结构，确保前端读取训练历史的数据契约稳定。 |

## 4. 新增测试脚本

`package.json` 新增：

```json
{
  "test": "npm run test:frontend && npm run test:backend",
  "test:frontend": "vitest run",
  "test:backend": "cd backend && mvn -pl ai-assistant-service,training-service -am test"
}
```

后端 Maven 配置新增：

- 父级 `backend/pom.xml` 增加 `maven-surefire-plugin`，用于运行 JUnit 5 测试。
- `ai-assistant-service/pom.xml` 增加 `spring-boot-starter-test`。
- `training-service/pom.xml` 增加 `spring-boot-starter-test`。

## 5. 测试用例清单

### 5.1 前端单元测试

| 编号 | 用例 | 期望结果 |
|---|---|---|
| FE-UT-001 | `杠铃卧推`、`引体向上`、`Dumbbell Shoulder Press`、`Box Jump` 等具体动作名 | 识别为合法动作名 |
| FE-UT-002 | `为了发展扣篮所需的下肢爆发力，我们将采用Athletic风格` | 拦截，不允许作为动作名 |
| FE-UT-003 | `Designed to improve upper-body strength through progressive loading` | 拦截，不允许作为动作名 |
| FE-UT-004 | `Exercise #12`、`动作3` | 拦截，占位动作名不合法 |
| FE-UT-005 | recommendation-service 响应 `{ code: 0, data: [...] }` | 正确归一化为 `RecommendationItem` |
| FE-UT-006 | recommendation-service 返回错误响应 | 前端 API 抛出后端错误信息 |

### 5.2 后端单元测试

| 编号 | 用例 | 期望结果 |
|---|---|---|
| BE-UT-001 | `ExerciseAutoProvisionService.provisionFromLabel` 接收中文训练目标描述句 | 返回 `unsafe_label`，不调用动作创建 |
| BE-UT-002 | `ExerciseAutoProvisionService.provisionFromCandidate` 接收英文解释句 | 返回 `unsafe_candidate_label`，不提取视频片段 |
| BE-UT-003 | `TrainingService.startRun` 创建训练 run | 写入 sessionId、userId、status=1、isDeleted=0、startTime/createTime |
| BE-UT-004 | `TrainingService.getRunSummary` 聚合 set/timer/exercise logs | 正确计算总次数、总重量、训练时长、动作数和跳过动作数 |

### 5.3 后端集成测试

| 编号 | 接口 | 用例 | 期望结果 |
|---|---|---|---|
| BE-IT-001 | `POST /api/v1/training/run` | 创建训练 run | HTTP 200，响应 `code=200`，返回 `data.id` |
| BE-IT-002 | `GET /api/v1/training/history` | 查询用户训练历史 | HTTP 200，响应包含 `runId`、`sessionId`、`startTime`、`endTime` |

## 6. 实际运行结果

### 6.1 前端测试

命令：

```bash
npm run test:frontend
```

结果：

```text
Test Files  2 passed (2)
Tests       5 passed (5)
```

### 6.2 后端测试

命令：

```bash
cd backend && mvn -pl ai-assistant-service,training-service -am test
```

结果：

```text
training-service:
Tests run: 4, Failures: 0, Errors: 0, Skipped: 0

ai-assistant-service:
Tests run: 2, Failures: 0, Errors: 0, Skipped: 0

BUILD SUCCESS
```

### 6.3 一键测试

命令：

```bash
npm run test
```

结果：

```text
前端：2 个测试文件，5 条测试，通过。
后端：6 条测试，通过。
整体：通过。
```

### 6.4 生产构建验证

命令：

```bash
npm run build
```

结果：

```text
vite build 成功。
```

备注：构建过程中仍存在历史已有的 `three-mesh-bvh` / `three` 版本导出警告，以及 chunk 体积警告。这两个警告不是本次测试代码引入，不影响当前构建成功。

## 7. 本轮测试覆盖结论

本轮已补齐基础自动化测试闭环：

- 前端具备 `Vitest` 单元测试能力。
- 后端具备 `JUnit 5 + Mockito` 单元测试能力。
- 后端具备 `MockMvc` Web 层集成测试能力。
- 项目根目录具备 `npm run test` 一键测试命令。
- 本轮新增测试覆盖了 AI 训练生成、动作自动补全、推荐读取、训练执行记录、训练总结、训练历史接口等关键链路。

## 8. 当前边界与后续扩展

本轮测试重点是“可运行、可证明、可答辩展示”的工程测试体系，并没有直接连接真实 MySQL/Redis，也没有调用真实 AI。

后续如果要进一步提高测试等级，可以继续补：

- 使用 Testcontainers 或 Docker Compose 启动 MySQL/Redis，做真实数据库集成测试。
- 给 workout-service 增加训练课/模块模板 CRUD 集成测试。
- 给 exercise-service 增加自定义动作创建、媒体上传、短链接/视频动作映射相关测试。
- 给 ai-assistant-service 增加 content job 到 candidate review 再到 plan generation 的端到端 mock 流程测试。
- 前端增加 React Testing Library，对 `TrainingHub`、`Profile` 和 `AI Coach` 做组件级渲染测试。

## 9. 对毕业设计工程性的支撑说明

这套测试可以用于说明项目具备基本工程质量保障：

- 不是只完成页面展示，而是对关键业务逻辑建立自动化回归验证。
- 对 AI 生成内容的不确定性增加安全测试，防止脏数据进入动作库。
- 对训练执行数据链路增加 Service 层和 Controller 层测试，证明训练记录不是静态页面。
- 对前后端数据契约增加测试，降低接口字段变化导致页面异常的风险。
- 测试命令可重复执行，便于后续持续集成扩展。
