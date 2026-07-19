# AI 虚拟试衣 V1

面向线上购买女装的女性消费者：上传本人照片 + 单件上衣/外套商品图，AI 生成多张静态虚拟试衣效果图，帮助判断衣服是否适合自己。

> V1 只提供视觉参考，不解决真实尺码、松紧、面料触感和实际合身度问题。

## 技术栈

- **前端**：Next.js 15 App Router + React 19 + TypeScript + Tailwind CSS + shadcn 风格组件 + TanStack Query（任务轮询）+ Zustand（上传会话）
- **后端**：Next.js Route Handlers + Drizzle ORM
- **数据库**：嵌入式 PGlite（零安装本地开发）或外部 PostgreSQL / Supabase（设 `DATABASE_URL` 即切换）
- **存储**：本地文件系统（`./uploads`），通过短期 JWT 签名 URL 访问
- **试衣 AI**：`TryOnProvider` 接口 + `MockTryOnProvider`（开发，无需 Key）+ `VolcanoTryOnProvider`（火山引擎图片换装 V2，需 AK/SK）

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

`.env.local` 已提供本地开发默认值（Mock 模式，无需任何 Key）。如需接入真实试衣，编辑 `.env.local`：

```bash
TRYON_PROVIDER=volcano
VOLC_ACCESS_KEY=你的AK
VOLC_SECRET_KEY=你的SK
```

### 3. 启动开发服务

```bash
pnpm dev
```

打开 http://localhost:3000 。数据库使用嵌入式 PGlite，首次访问会自动建表，无需额外安装。

> 首次启动会自动运行 Drizzle 迁移（`src/db/migrations`），数据持久化在 `./.pglite-data`。

## 本地 Mock 全流程

无需任何 API Key 即可跑通完整流程：

1. 首页点击「开始试衣」→ 进入 `/tryon`
2. 上传一张本人照片（JPG/PNG/WebP，短边 ≥ 512px）→ 自动预检
3. 选择服装类型（上衣/外套），上传一张单件服装图 → 自动预检
4. 点击「开始试穿」→ 跳转结果页
5. 等待约 3 秒（Mock 延迟），自动展示 3 张占位效果图
6. 可放大、保存、分享、删除结果；提交反馈；点「继续试穿其他衣服」复用本人照片

**异常路径验证**：
- 上传模糊/过小图片 → 预检失败，不消耗额度
- 额度耗尽（默认 5 次/天）→ 创建任务返回 402
- 任务进行中点「取消任务」→ 返还额度

## 切换到真实火山引擎试衣

1. 在 `.env.local` 填入 `VOLC_ACCESS_KEY` / `VOLC_SECRET_KEY`，设 `TRYON_PROVIDER=volcano`
2. 确认 `APP_URL` 为公网可达地址（火山服务需拉取你的图片，本地开发可用内网穿透）
3. 重启 `pnpm dev`

> `VolcanoTryOnProvider` 基于公开文档实现，部分参数标注 `[待确认]`，需结合实际 API 文档校正。

## 数据库

- **本地默认**：PGlite 嵌入式，数据在 `./.pglite-data`，零安装
- **外部 PG**：设 `DATABASE_URL=postgresql://...` 自动切换；可对接 Supabase
- **Schema 变更**：修改 `src/db/schema/*.ts` 后运行 `pnpm db:generate` 生成迁移，应用启动时自动 `migrate`

## 定时任务（Cron）

`/api/cron/*` 路由用于离线兜底，需请求头 `X-Cron-Secret: <CRON_SECRET>` 鉴权：

| 路由 | 作用 |
|---|---|
| `POST /api/cron/poll-tasks` | 推进在途任务、超时判定、自动重试 |
| `POST /api/cron/cleanup-uploads` | 清理过期上传图片 |
| `POST /api/cron/cleanup-results` | 清理过期试衣结果 |

本地开发可手动触发（PowerShell）：

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/cron/cleanup-uploads -Headers @{ "X-Cron-Secret" = "dev-cron-secret-7k2m9x" }
```

或运行 `scripts/trigger-cron.ps1`。

> 实际上 GET `/api/tryon/[taskId]` 会顺带推进在途任务，本地开发无需 cron 即可跑通；cron 仅在用户关闭页面后兜底。

## 目录结构

```
src/
├── app/
│   ├── (app)/{layout,tryon/page,tryon/[taskId]/page}.tsx   # 应用页面
│   ├── api/                                                 # 14 个 Route Handler
│   ├── privacy/page.tsx
│   ├── {layout,page,providers}.tsx
│   └── globals.css
├── components/{ui,upload,tryon,layout,privacy}/             # UI 组件
├── db/{schema,drizzle.ts,ensure-migrated.ts,migrations/}    # Drizzle ORM
├── hooks/                                                   # useUpload/useTaskPolling/useFeedback
├── lib/                                                     # env/errors/jwt/anon-auth/constants...
├── server/
│   ├── tryon/      # provider/mock/volcano/task-service/poll-worker/status-machine
│   ├── precheck/   # 规则 + 轻量检测
│   ├── storage/    # 本地 fs + 签名 URL
│   ├── quota/      # 额度原子扣减
│   └── metrics/    # 指标采集
├── stores/tryon-store.ts
└── types/{api,tryon}.ts
```

## 隐私

- 用户照片仅用于本次试衣，24 小时内自动删除
- 不用于模型训练，不向其他用户公开
- 图片访问使用短期签名 URL，过期失效
- 详见 `/privacy`

## 常用命令

```bash
pnpm dev          # 启动开发服务
pnpm build        # 生产构建
pnpm typecheck    # 类型检查
pnpm lint         # ESLint
pnpm db:generate  # 生成迁移
pnpm db:studio    # Drizzle Studio 查看数据
```

## 清理本地数据

删除上传图片与本地数据库：

```bash
rm -rf uploads .pglite-data
```

重启 `pnpm dev` 会自动重建。
