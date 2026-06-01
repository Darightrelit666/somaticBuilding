# SomaticBuilding / Physical OS - 后端架构蓝图（Spring Cloud）

更新时间：2026-04-06（Asia/Shanghai）

## 1. 总体架构原则（参考凤凰架构）
- 业务域拆分：评估 / 体态 / 动作库 / 训练编排 / 训练执行 / 画像 / 推荐
- 服务治理：注册发现 + 配置中心 + 网关 + 链路追踪
- 可靠性优先：核心链路强一致，非核心最终一致
- 可演进：先核心链路，后非核心服务拆分

## 2. 服务划分建议
- gateway-service
- auth-service
- user-service
- assessment-service
- posture-service
- exercise-service
- workout-service
- training-service
- profile-service
- recommendation-service
- ai-assistant-service（后期）

## 3. Spring Cloud 组件清单
- 注册中心：Nacos
- 配置中心：Nacos Config
- 网关：Spring Cloud Gateway
- 负载均衡：Spring Cloud LoadBalancer
- 服务调用：OpenFeign
- 熔断限流：Sentinel / Resilience4j
- 链路追踪：Sleuth + Zipkin 或 SkyWalking
- 基础设施：MySQL / Redis / MQ（后期）

## 4. MVP 启动顺序
1. Nacos / MySQL / Redis
2. Gateway / Auth / User
3. Exercise / Workout / Training
4. Assessment / Profile / Posture
5. Recommendation / AI Assistant

## 5. 推荐工程目录结构
```
somatic-building
├── gateway-service
├── auth-service
├── user-service
├── assessment-service
├── posture-service
├── exercise-service
├── workout-service
├── training-service
├── profile-service
├── recommendation-service
├── ai-assistant-service (future)
├── common-lib
│   ├── common-core
│   ├── common-db
│   ├── common-security
│   ├── common-redis
│   └── common-event
└── docs
```

## 6. 服务内部结构规范
```
service-name
└── src/main/java
    ├── controller
    ├── service
    ├── domain
    ├── repository
    ├── dto
    ├── config
    └── infra
```
