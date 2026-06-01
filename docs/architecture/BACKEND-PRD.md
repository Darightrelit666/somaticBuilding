# SomaticBuilding / Physical OS - 后端 PRD（架构与实施清单）

更新时间：2026-04-06（Asia/Shanghai）

## 一、Spring Cloud 组件清单（基础设施层）
### ✅ 必选组件（MVP 必须）
- 注册中心：Nacos  
- 配置中心：Nacos Config  
- 网关：Spring Cloud Gateway  
- 负载均衡：Spring Cloud LoadBalancer  
- 服务调用：OpenFeign  
- 熔断限流：Sentinel（或 Resilience4j）  
- 日志与链路：Sleuth + Zipkin 或 SkyWalking  

### ✅ 业务基础
- MySQL（主数据）  
- Redis（缓存 + 限流 + 会话）  
- 消息队列（后期，建议 RabbitMQ 或 Kafka）  

---

## 二、服务依赖关系（核心链路优先）

### 核心链路服务依赖
```
gateway
  ├── auth-service
  ├── user-service
  ├── assessment-service
  ├── posture-service
  ├── exercise-service
  ├── workout-service
  ├── training-service
  └── profile-service
```

### 服务间调用逻辑
- assessment-service → profile-service（生成画像）  
- workout-service → exercise-service（拉动作数据）  
- training-service → workout-service（读取编排结构）  
- training-service → recovery（恢复建议逻辑后续可接 AI）  

---

## 三、MVP 启动顺序（最小可运行版本）
1. 基础设施  
   - Nacos  
   - MySQL  
   - Redis  

2. 平台底座  
   - Gateway  
   - Auth / User  

3. 核心业务  
   - Exercise  
   - Workout  
   - Training  

4. 评估闭环  
   - Assessment  
   - Profile  
   - Posture  

---

## 四、最小可用服务拆分（MVP 优先级）
### 第 1 阶段必须上线
- gateway-service  
- auth-service  
- user-service  
- exercise-service  
- workout-service  
- training-service  

### 第 2 阶段补齐闭环
- assessment-service  
- profile-service  
- posture-service  

### 第 3 阶段（扩展）
- recommendation-service  
- ai-assistant-service  

---

## 五、下一步待输出（确认后展开）
- 各服务职责说明与关键接口边界  
- MVP 项目目录结构骨架（Spring Cloud 多模块）  

---

## 六、后端开发规范（必须遵守）

### 1) Java 开发规范
- **统一遵循**《阿里巴巴 Java 开发规范（嵩山版）》  

### 2) 分层与架构规范
- 分层规范参考凤凰架构（Fenixsoft）  
- 服务内部结构遵循：controller / service / domain / repository / dto / config / infra  

### 3) 统一返回体规范（企业级标准）
```json
{
  "code": 200,
  "message": "成功",
  "data": { }
}
```

### 4) 错误码规范（阿里系通用）
- 200 成功  
- 400 参数错误  
- 401 未登录  
- 403 无权限  
- 500 服务器错误  
- 业务码范围：10001 ~ 99999（统一管理，不允许随意写数字）  

### 5) 日志规范（SLF4J + 阿里标准）
- 必须使用 `@Slf4j`  
- 禁止 `System.out`  
- 日志禁止打印敏感信息（密码、手机号）  
- 异常必须打印堆栈：`log.error("异常", e)`  

### 6) API 规范（RESTful 国内通用）
- 查询：GET  
- 新增：POST  
- 修改：PUT  
- 删除：DELETE  
- 版本：`/api/v1/xxx`  

### 7) 安全规范（企业级）
- XSS 过滤  
- SQL 注入防御（MyBatis-Plus / 参数绑定）  
- 接口限流  
- 敏感数据脱敏  
- 权限控制统一处理  

### 8) CI/CD 规范（最简权威版）
- 主干分支：`main`  
- 开发分支：`dev`  
- 功能分支：`feature/xxx`  
- 发布前必须：格式化 + 单元测试 + 代码扫描  

---

## 七、服务职责与关键边界（已确认）

### 服务职责
- gateway-service：统一入口、路由、鉴权、限流、日志埋点  
- auth-service：注册/登录、Token 发放、会话管理、权限校验  
- user-service：用户资料、基础信息、偏好、体测档案  
- assessment-service：评估流程、评估动作、评分结果、红旗检测  
- posture-service：体态快照、关节状态、评估可视化数据  
- exercise-service：动作库、标签体系、动作媒体、筛选逻辑  
- workout-service：训练编排（Session/Block/Group/Exercise），模板管理  
- training-service：训练执行记录、计时日志、组数日志、动作日志  
- profile-service：能力画像生成、历史趋势、目标映射  
- recommendation-service（后期）：训练推荐、恢复建议、阶段计划  
- ai-assistant-service（后期）：悬浮助手对话、提示与训练反馈  

### 关键接口边界
- assessment-service → profile-service（评估结果触发画像更新）  
- workout-service → exercise-service（编排读取动作库信息）  
- training-service → workout-service（执行读取训练编排结构）  
- training-service → recovery/profile（训练结束更新恢复建议与画像）  

---

## 八、服务内部代码层次规范（凤凰架构）

### 统一层次结构
```
service-name
└── src/main/java
    ├── interfaces        // 接入层：Controller / DTO / API
    ├── application       // 应用层：用例编排 / Application Service
    ├── domain            // 领域层：实体 / 领域服务 / 领域事件
    ├── infrastructure    // 基础设施层：DAO / 外部接口 / MQ / Redis
    ├── common            // 服务内通用工具（可选）
    └── config            // 配置
```

### 层次调用关系（强制）
- `interfaces` 只能调用 `application`
- `application` 只能调用 `domain` 与 `infrastructure`
- `domain` 不得依赖 `interfaces / application / infrastructure`
- `infrastructure` 不得反向依赖 `interfaces / application / domain`
