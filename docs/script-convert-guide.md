# AI 转换链路说明

## 1. 文档目的

本文档用于说明 Scene Script 中“小说转剧本”能力的完整实现链路，帮助评审、开发者和后续维护者快速理解以下问题：

- 用户输入的小说章节如何进入系统
- 后端如何以异步任务方式驱动 AI 生成
- 长文模式、YAML 校验、自动修复如何协同工作
- 前端如何通过 SSE 获取实时进度
- 生成后的 YAML 如何继续编辑、保存和二次打磨

本说明文档聚焦的是**当前项目实际实现**，不是抽象设计稿。

## 2. 能力概览

当前项目围绕“小说 -> 结构化剧本 YAML -> 持续打磨”实现了完整闭环，核心能力包括：

- 输入不少于 `3` 章的小说内容，当前工程稳定范围为 `3~12` 章
- 按 `genre`、`tone`、`pacing` 生成结构化剧本 YAML
- 通过异步任务模式执行生成，避免长耗时接口阻塞
- 通过 SSE 实时推送任务阶段和状态
- 长文自动进入摘要压缩模式，提升生成稳定性
- 对生成结果执行 YAML 解析、Schema 强校验和一致性质检
- 对不合法结果执行 repair 修复，而不是直接失败
- 支持查看、编辑、保存结果，并支持单场景 AI 重写
- 支持失败任务重试和作品删除

## 3. 整体链路

整体链路可以概括为：

1. 用户输入小说章节，并设置体裁、语气、节奏
2. 前端调用 `POST /api/v1/script/convert`
3. 后端校验输入后创建异步任务
4. 后台任务根据篇幅决定是否先做长文摘要压缩
5. 调用大模型生成剧本 YAML
6. 对 YAML 做清洗、解析和 Schema 校验
7. 若校验失败，则进入 repair 修复流程
8. 校验通过后生成 `consistency_report`
9. 将结果、摘要和任务状态落库
10. 前端通过 SSE 获取阶段更新并回拉详情
11. 用户进入详情页查看、编辑、保存，或对单个场景发起 AI 重写

核心链路图如下：

![核心链路图](images/核心链路图.png)

## 4. 核心接口

当前项目中与脚本转换相关的核心接口如下：

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/script/convert` | 创建剧本转换任务 |
| `GET` | `/api/v1/script` | 获取作品历史列表 |
| `GET` | `/api/v1/script/:id` | 获取任务详情与结果 |
| `GET` | `/api/v1/script/:id/events` | 通过 SSE 订阅任务事件流 |
| `POST` | `/api/v1/script/:id/scene-rewrite` | 对单个场景进行 AI 重写 |
| `POST` | `/api/v1/script/:id/retry` | 重试失败作品 |
| `PUT` | `/api/v1/script/:id/result` | 保存编辑后的 YAML |
| `DELETE` | `/api/v1/script/:id` | 删除已完成或失败作品 |

这些路由定义见 [v1.go](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/internal/router/api/v1/v1.go)。

## 5. 输入约束

发起转换时，前端传入的数据结构如下：

```json
{
  "chapters": [
    { "title": "第一章", "text": "小说正文..." },
    { "title": "第二章", "text": "小说正文..." },
    { "title": "第三章", "text": "小说正文..." }
  ],
  "genre": "悬疑",
  "tone": "压抑",
  "pacing": "medium"
}
```

输入要求：

- `chapters.length` 不少于 `3`
- 当前工程稳定范围为 `3~12`
- 每章都必须包含 `title` 与 `text`
- `pacing` 只能是 `fast`、`medium`、`slow`
- 用户必须已登录并携带有效鉴权信息

前端类型定义可参考 [script.ts](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/frontend/src/types/script.ts)。

## 6. 异步任务模式

### 6.1 为什么采用异步任务

小说转剧本不是轻量级请求，尤其在以下情况下更容易出现长耗时：

- 输入章节较多
- 单章内容很长
- 首轮结果需要 repair 修复
- 需要额外执行摘要压缩和一致性质检

因此项目没有把 `/convert` 设计成同步接口，而是采用：

- 创建任务
- 立即返回任务信息
- 后台异步执行
- 前端通过 SSE 获取进度

这样可以避免前端长时间阻塞等待，也更方便失败重试和任务历史管理。

### 6.2 创建任务后的响应

`POST /api/v1/script/convert` 会返回 `202 Accepted`，响应数据包含：

- `id`
- `status`
- `detail_url`
- `event_url`

前端随后使用 `event_url` 建立 SSE 监听，并在任务完成后请求 `detail_url` 获取最终结果。

## 7. SSE 任务事件流

任务状态流是当前项目的重要工程亮点之一。

### 7.1 推送方式

后端通过 `GET /api/v1/script/:id/events` 建立 `text/event-stream` 连接，向前端持续推送 `script-task` 事件。

实现见 [watch_script_events_handler.go](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/internal/handler/script/watch_script_events_handler.go)。

### 7.2 阶段定义

当前前后端对齐的阶段包括：

- `queued`
- `starting`
- `summarizing`
- `generating`
- `validating`
- `repairing`
- `persisting`
- `completed`
- `failed`

### 7.3 作用

SSE 的作用不仅是“显示加载中”，更重要的是：

- 告诉用户系统当前正在做什么
- 区分普通生成与长文模式
- 在 repair 或失败时提供更明确的状态感知
- 提升作品墙和详情页的实时体验

## 8. 长文模式

### 8.1 为什么需要长文模式

如果把很长的小说章节一次性直接交给模型，常见问题包括：

- 接口响应慢
- 输出截断
- YAML 结构损坏
- 场景和节拍数量失控
- repair 成本增大

### 8.2 当前实现方式

当系统判断输入属于长文场景时，会先进入 `summarizing` 阶段，对各章内容做摘要压缩，再基于摘要后的章节内容生成最终 YAML。

这个策略的目标是：

- 控制 prompt 长度
- 提高结构化输出稳定性
- 降低长文直接生成带来的超时和解析失败概率

因此，当前工程把输入章节控制在 `3~12` 章的稳定区间内。

## 9. YAML 生成、解析与校验

### 9.1 生成目标

系统要求模型输出的不是普通文本，而是标准 YAML，顶层结构包括：

```yaml
version: "1.0"
metadata: {}
dramatis_personae: []
settings: []
chapters: []
consistency_report: {}
```

对应模型结构定义见 [script_schema.go](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/internal/model/script_schema.go)。

### 9.2 解析过程

模型返回 YAML 后，后端会执行：

1. 清洗模型输出
2. 解析为 `ScriptYAML`
3. 做结构归一化
4. 执行 Schema 强校验
5. 生成 `consistency_report`
6. 重新序列化为标准化 YAML

### 9.3 强校验内容

当前实现会重点校验：

- `version` 是否为 `1.0`
- `metadata.genre`、`tone`、`pacing` 是否与请求一致
- `metadata.source_chapters` 是否等于输入章节数
- `generated_at` 是否为 RFC3339
- 章节、场景、节拍的 ID 是否符合命名规则
- `beat.type` 是否属于合法枚举
- `dialogue` / `inner` 类型是否提供 `speaker` 与 `content`
- 人物名、地点名是否唯一

相关逻辑见 [script_converter.go](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/internal/service/script_converter.go#L1328-L1475)。

## 10. repair 自动修复

### 10.1 为什么需要 repair

大模型即使能理解结构要求，也仍可能出现：

- YAML 语法不合法
- 字段类型错误
- 列表写成字符串
- 输出截断
- 部分字段缺失

### 10.2 当前策略

当前项目不是在首轮失败后直接返回错误，而是：

1. 记录首轮失败原因
2. 进入 `repairing` 阶段
3. 让模型基于校验错误重新输出一份更紧凑、更完整的 YAML
4. 再次执行解析和校验

如果 repair 仍然失败，则任务最终进入失败状态。

这一步让项目从“能调模型”提升为“对生成结果负责”的工程化系统。

## 11. 一致性质检

在结构校验通过后，系统还会补充 `consistency_report`，用于发现跨章节的一致性问题。

重点检查内容包括：

- 被引用但未登记的人物
- 被引用但未登记的地点
- 已定义但未被使用的悬空引用

这意味着当前项目不仅输出剧本结果，还会主动帮助作者发现结构风险。

## 12. 结果保存与编辑

生成完成后，前端可以从多个视角查看结果：

- 概览视图
- YAML 视图
- 结构视图
- 人物表 / 地点表视图

编辑后的结果可通过 `PUT /api/v1/script/:id/result` 保存回后端。

这一部分的意义在于，用户拿到的不只是“生成结果”，而是可继续修改、继续打磨的剧本工作台。

## 13. 单场景 AI 重写

除整部作品生成外，当前项目还支持对单个场景继续使用 AI 打磨。

接口为：

`POST /api/v1/script/:id/scene-rewrite`

请求体包含：

- 当前 YAML
- `chapter_index`
- `scene_index`
- `instruction`

这项能力是超出题目基础要求的额外亮点，因为它意味着作者可以在已有作品上继续做局部 AI 润色，而不是只能重新生成整部作品。

实现入口见 [rewrite_script_scene_handler.go](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/internal/handler/script/rewrite_script_scene_handler.go)。

## 14. 失败重试与历史保留

当前项目支持对失败任务发起重试：

- 只有 `failed` 任务允许重试
- 重试不会覆盖旧任务，而是创建一条新任务
- 系统会尝试读取失败任务保存的输入快照，恢复原始章节内容

这样做的好处是：

- 保留失败历史，方便演示与排查
- 让任务模型更贴近真实产品
- 避免覆盖旧结果带来的调试困难

## 15. 作品删除策略

当前项目支持：

- 删除 `succeeded` 作品
- 删除 `failed` 作品

当前版本暂不支持取消运行中的任务，这是一种面向 MVP 阶段的简化取舍，优先保证核心链路清晰稳定。

## 16. 当前链路的产品亮点

除了满足题目“小说转结构化剧本”的基础要求外，这条链路还有几个额外亮点：

- 不是普通文本生成，而是结构化 YAML 输出
- 不是一次性返回，而是异步任务 + SSE 状态流
- 不是只会生成，而是支持保存、继续编辑和单场景 AI 重写
- 不是只输出结果，还会自动做一致性质检
- 不是简单调用模型，而是加入长文模式与 repair 修复，提升工程稳定性

## 17. 相关文档

- YAML Schema 文档：[script-schema.md](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/docs/schema/script-schema.md)
- 路演视频台词：[DEMO_VIDEO_SCRIPT.md](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/docs/DEMO_VIDEO_SCRIPT.md)
- 仓库说明：[README.md](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/README.md)
