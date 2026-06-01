
  # 운동 라이브러리 화면 디자인

  This is a code bundle for 운동 라이브러리 화면 디자인. The original project is available at https://www.figma.com/design/TBo0nhImfV47B5xR42sSUL/%EC%9A%B4%EB%8F%99-%EB%9D%BC%EC%9D%B4%EB%B8%8C%EB%9F%AC%EB%A6%AC-%ED%99%94%EB%A9%B4-%EB%94%94%EC%9E%90%EC%9D%B8.

  ## Running the code

### 已完成模块与页面

#### 1. App Shell（全局底部导航）
固定底部导航：Home / Train / Build / Library / Profile
页面切换保留导航
Exercise 详情页已单独隐藏底部导航，避免挡住按钮

#### 2. Home 首页（Somatic Architect Landing）
黑金哲学风落地页
背景图来自 src/assets/home-hero.png
进入训练按钮指向 /training
移动端背景已适配全图显示

#### 3. Training Hub（/training）
Quick Workout / Custom Workout 两大入口
推荐课程 + 最近训练展示
Quick -> /modules
Custom -> /workout-style

#### 4. 训练风格选择页（/workout-style）
横向海报流转选择风格
选择风格后进入 /workout-builder
风格决定后续 block 结构

#### 5. 动作库系统（/systems → /library）
/systems 选择训练系统
/library/:systemId 进入动作库
动作列表卡片 + 购物车侧栏
过滤器已可用（Category / Ability / Equipment / Difficulty）
Add to cart / Clear / Save template

#### 6. 动作详情页（/exercise/:id）
艺术风 UI + 动作信息 +热区图+步骤+注意事项
Add to Workout -> 回动作库
返回按钮已修复（优先返回上一页，不行则回 /library）

#### 7. 训练编排页（/workout-builder）
训练 block 分阶段
支持拖拽：Cart 动作 → Block → Group
支持模板选择、保存
当前 block 放大显示
本地草稿自动保存（按风格保存）

#### 8. 训练进行页（/workout）
电影式训练 HUD
计时模式支持三类：
countup（Strength / Bodybuilding / Athletic / Functional）
countdown（Mobility / Yoga / Rehab）
hiit（CrossFit / Tabata / HIIT）
Start Set 手动启动（countup / countdown）
HIIT 自动倒计时
完成后跳转结算页

#### 9. 训练结算页（/workout-summary）
3D 交互背景（React Three Fiber）
训练结果与 CTA
可继续训练 / 查看 Profile

#### 10. Athlete Profile（/athlete）
节点式能力系统 + 训练状态 + tags + 训练日志

### 关键交互流程
Home → Training Hub → Quick Modules → 模块详情 → Start → Workout Player → Summary
Home → Training Hub → 选择风格 → Workout Builder → Start Training → Workout Player → Summary
Library → Exercise Detail → Add to Workout → Cart → Workout Builder

### 项目根目录（D:\somaticBuilding）
index.html
Vite 入口 HTML，设置浏览器标题和挂载点

package.json
项目名（somaticbuilding）、脚本命令、依赖列表

pnpm-lock.yaml
锁定依赖版本，保证一致性

vite.config.ts
Vite 构建/开发配置

postcss.config.mjs
Tailwind + PostCSS 配置

README.md
项目说明文档

node_modules/
依赖包目录

scripts/
工具脚本
import-open-exercises.mjs：导入开源动作库数据
dev.mjs：用于修复 esbuild 启动的自定义 dev 脚本
src/ 主代码目录
src/app/

核心入口与路由层
App.tsx：应用入口
routes.tsx：路由配置（页面对应关系）
src/modules/（按业务模块划分）
home/

首页落地页与宣传页
SomaticArchitectLandingPage.tsx
HomePage.tsx
training/

训练相关全流程
WorkoutSetupPage.tsx：训练入口页
WorkoutStyleSelectionPage.tsx：选择训练风格
WorkoutBuilderPage.tsx：训练编排
QuickModuleHubPage.tsx：快速训练模块入口
ModuleDetailPage.tsx：模块详情
WorkoutPlayerPage.tsx：训练进行中
WorkoutSummaryPage.tsx：训练结算页
TemplateLibraryPage.tsx：模板库页

library/
动作库系统
SystemSelection.tsx：系统选择页
Library.tsx：动作库列表 + cart
ExerciseDetail.tsx：动作详情页

profile/
运动员个人能力档案
AthleteProfilePage.tsx
src/shared/（全局复用）

components/
公共组件
AppShell.tsx：底部导航框架
Header.tsx：动作库顶部栏
Filters.tsx：筛选组件
ExerciseCard.tsx：动作卡片
SomaticCanvas.tsx：3D 结算背景
FloatingAvatarCompanion.tsx：悬浮助手
figma/ImageWithFallback.tsx

components/ui/
shadcn UI 组件库封装

data/
全局数据源
exercises.ts：动作数据入口（优先读开源库 JSON）
systems.ts：系统列表
open-exercises.json：导入后的开源动作库原始数据

src/styles/
全局 Tailwind 样式

src/assets/
静态素材（首页背景等）

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  