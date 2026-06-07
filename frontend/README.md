# Frontend Workspace

本目录是 Scene Script 的前端工作台，基于 React + TypeScript + Vite 构建，负责首页展示、工作台输入、全文导入、作品墙、详情编辑以及 SSE 任务状态联动。

## 当前能力

- 首页品牌展示与登录弹层
- 工作台逐章输入
- 全文导入、自动拆章、人工确认后导入工作台
- 上传 `txt / md / markdown` 文件并读取正文
- 异步生成任务提交与 SSE 状态流展示
- 作品墙查看、失败重试、作品删除
- 详情页概览、YAML 视图、结构化语义树编辑
- 人物表 / 地点表联动编辑

## 目录约定

```text
frontend/src/
├── components/
│   ├── script-workshop/   # 工作台拆分组件
│   ├── studio/            # 首页、侧边栏、登录弹层等
│   └── ui/                # 通用 UI 组件
├── lib/                   # 展示与解析工具
├── pages/
│   ├── dashboard/         # 首页
│   └── script-workshop/   # 工作台主页面
├── services/              # API 请求与 SSE 连接
├── stores/                # Zustand 状态管理
└── types/                 # 前端类型定义
```

## 本地开发

```bash
npm install
npm run dev
```

## 构建验证

```bash
npm run build
```

## 说明

- 工作台主页面当前仍是重点业务页面，状态和交互较多，后续可继续按视图和状态域做组件化拆分。
- 详细产品说明、整体能力与 Demo 入口请以根目录 `README.md` 为准。
