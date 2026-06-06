# AI 小说转剧本工具 YAML Schema v1.0

## 文档目的

本文档用于交付“题目三：AI 小说转剧本工具”中的 YAML Schema 设计说明，并作为当前项目的统一数据契约。目标是让系统能够把小说章节自动转换为**结构化、可解析、可编辑、可进一步打磨**的剧本初稿。

本项目当前实现满足题目“3 个章节以上”的要求，并在工程上增加了稳定性上限：

- 输入章节数最少为 `3`
- 输入章节数最大为 `12`
- `3~12` 为当前后端和前端统一约束

其中，上限 `12` 是当前 MVP 阶段为保证 LLM 输出稳定性、接口时延和前端渲染流畅度而设置的工程边界。

## 题目对应关系

题目要求：

> 能将 3 个章节以上的小说文本自动转换为结构化剧本（YAML 格式），让作者可以快速获得可编辑、可进一步打磨的剧本初稿。请额外写一篇文档，定义剧本的 YAML Schema。文档中需说明该 Schema 的设计原因。

本 Schema 对应方式如下：

- `chapters`：承载输入小说章节改编后的正文章节结构
- `dramatis_personae`：输出全剧人物总表，支持后续人物关系编辑
- `settings`：输出全剧地点总表，支持地点复用与一致性归并
- `scenes` 与 `beats`：把原始叙事拆成可编辑的场景与分镜节拍
- `consistency_report`：输出自动质检结果，帮助作者快速发现角色、地点、伏笔等问题

## 当前项目实现是否符合本 Schema

结论：**整体符合，且核心数据结构已经按本 Schema 落地。**

已确认一致的部分：

- 后端核心模型与 YAML 字段一致，见 [script_schema.go](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/internal/model/script_schema.go)
- 后端 schema 校验逻辑与文档字段要求基本一致，见 [script_converter.go](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/internal/service/script_converter.go#L654-L800)
- 前端 YAML 文档类型与本 Schema 对齐，见 [script.ts](file:///Users/lihainuo/Develop/Code/Co/qiniuyun/scene-script/frontend/src/types/script.ts#L23-L91)

本次文档已补齐并修正的实现差异：

- 输入约束已明确为 `3~12` 章；旧文档仅写“3 章以上”
- API 实际为**异步任务模式**，旧文档中的同步直返 YAML 示例已不符合当前实现
- `settings.aliases` 已是当前实现的一部分，且会参与地点软匹配
- `consistency_report` 会由系统自动生成，不依赖模型自由发挥

## Schema 设计原因

### 1. 为什么采用 YAML

- YAML 适合层级结构表达，天然适合“章节 -> 场景 -> 分镜节拍”的剧本树形结构
- 相比自由文本，YAML 更容易被程序解析、保存、质检、回显和二次编辑
- 相比 JSON，YAML 更适合作者人工阅读和局部修改

### 2. 为什么采用分层结构

- 小说到剧本不是简单摘要，而是要把叙事拆成可编排的戏剧单元
- `chapters` 保留原作章节级改编结果
- `scenes` 承担剧本化后的场次组织
- `beats` 承担更细粒度的动作、对白、内心与说明

这种设计既适合 AI 生成，也适合作者后续逐层打磨。

### 3. 为什么单独维护人物表和地点表

- 长篇改编最容易出现角色名字漂移、地点写法不统一、前后称呼不一致
- 将 `dramatis_personae` 和 `settings` 作为全剧唯一注册表，可以把正文引用统一收口
- 这样既方便一致性检查，也方便前端做树形导航、筛选、聚合编辑

### 4. 为什么要有 consistency_report

- 大模型即使能生成结构化内容，也仍然可能出现遗漏角色、漏登记地点、伏笔未回收等问题
- `consistency_report` 相当于自动质检层，不改变主结构，但能把风险暴露给作者
- 这使得工具从“生成器”升级为“生成 + 校验”的辅助创作系统

### 5. 为什么输入限制为 3~12 章

- 少于 `3` 章时，人物关系、地点复用和剧情主线信息往往不足，生成质量不稳定
- 多于 `12` 章时，单轮 LLM 输出更容易出现截断、结构崩坏和接口超时
- 因此当前工程选择 `3~12` 作为可用区间，其中 `5~10` 为推荐稳定区间

## YAML 结构总览

顶层结构固定如下：

```yaml
version: "1.0"
metadata: {}
dramatis_personae: []
settings: []
chapters: []
consistency_report: {}
```

字段说明：

- `version`：Schema 版本号
- `metadata`：生成元数据
- `dramatis_personae`：人物总表
- `settings`：地点总表
- `chapters`：剧本正文章节
- `consistency_report`：一致性质检报告

## YAML 完整规范

```yaml
version: "1.0"

metadata:
  title: "原作小说名称"
  author: "原作者名称"
  genre: "悬疑|言情|科幻|现实主义|奇幻|其他"
  tone: "压抑|轻松|热血|温暖|其他"
  pacing: "fast|medium|slow"
  source_chapters: 3
  generated_at: "2026-06-06T12:30:00+08:00"

dramatis_personae:
  - name: "张三"
    archetype: "主角|配角|路人|反派"
    motivation: "角色核心行动动机"
    traits:
      - "聪慧"
      - "坚韧"
      - "孤独"
    relations:
      - "和李四为兄弟"
      - "与王五敌对"
    first_appearance: "ch1"

  - name: "李四"
    archetype: "配角"
    motivation: "协助主角推进调查，同时隐瞒自己的真实立场"
    traits: []
    relations: []
    first_appearance: "ch2"

settings:
  - name: "XX公寓"
    description: "位于市中心的高档公寓，三室两厅，现代装修风格"
    importance: "high"
    aliases:
      - "XX小区公寓楼"
      - "公寓"

  - name: "废弃仓库"
    description: "郊外老工业园区中的废弃仓库，昏暗潮湿"
    importance: "medium"

chapters:
  - id: "ch1"
    title: "第一章标题"
    summary: "本章梗概，概括主要事件与推进。"
    scenes:
      - id: "ch1.sc1"
        title: "场景标题"
        goal: "本场景的核心冲突或推进目标"
        location: "XX公寓书房"
        time: "Night"
        pov: "张三"
        mood: "紧张"
        beats:
          - id: "ch1.sc1.b1"
            type: "action"
            summary: "张三发现桌上的陌生信件"
          - id: "ch1.sc1.b2"
            type: "dialogue"
            summary: "李四试图掩饰异常"
            dialogue:
              speaker: "李四"
              content: "这封信不是给你的，别再追问了。"
          - id: "ch1.sc1.b3"
            type: "inner"
            summary: "张三意识到李四在隐瞒关键信息"
            dialogue:
              speaker: "张三"
              content: "（内心）他越解释，越说明这件事有问题。"
        outcome: "张三决定继续调查，李四开始对他保持戒备。"

  - id: "ch2"
    title: "第二章标题"
    summary: "本章梗概。"
    scenes: []

  - id: "ch3"
    title: "第三章标题"
    summary: "本章梗概。"
    scenes: []

consistency_report:
  roles_missing: []
  settings_missing: []
  dangling_refs: []
```

## 字段详解

### metadata（元数据）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| title | string | ✓ | 原作小说名称或系统归纳出的剧本标题 |
| author | string | ✓ | 原作者名称；未知时可写“未知作者” |
| genre | string | ✓ | 体裁，必须与转换请求中的 `genre` 一致 |
| tone | string | ✓ | 语气，必须与转换请求中的 `tone` 一致 |
| pacing | string | ✓ | 节奏，必须为 `fast` / `medium` / `slow` |
| source_chapters | int | ✓ | 源小说章节数，必须与输入章节数一致 |
| generated_at | string | ✓ | 生成时间，必须是 RFC3339 / ISO 8601 时间格式 |

### dramatis_personae（人物表）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | ✓ | 角色名称，全剧唯一 |
| archetype | string | ✓ | 角色类型，如主角/配角/路人/反派 |
| motivation | string | ✓ | 角色核心行动动机 |
| traits | array | ✓ | 性格标签数组，必须是 YAML sequence |
| relations | array | ✓ | 与其他角色的关系描述数组，必须是 YAML sequence |
| first_appearance | string | ✓ | 首次出现章节，当前实现建议使用 `chN` |

### settings（地点表）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | ✓ | 地点名称，全剧唯一 |
| description | string | ✓ | 地点描述，包含环境、氛围或功能 |
| importance | string | ✓ | 重要程度，必须为 `high` / `medium` / `low` |
| aliases | array | ✗ | 地点别名数组，用于软匹配与检索 |

### chapters（章节）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | ✓ | 章节 ID，必须匹配 `chN` |
| title | string | ✓ | 章节标题 |
| summary | string | ✓ | 章节梗概 |
| scenes | array | ✓ | 场景数组，可为空数组，但字段必须存在 |

### scenes（场景）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | ✓ | 场景 ID，必须匹配 `chN.scN` |
| title | string | ✓ | 场景标题 |
| goal | string | ✓ | 场景目标或核心冲突 |
| location | string | ✓ | 地点短语，优先与 `settings` 精确匹配；不命中时进入软匹配 |
| time | string | ✓ | 时间标签，如 `Day` / `Night` / `Dawn` / `Dusk` |
| pov | string | ✓ | 主视角角色，必须对应 `dramatis_personae.name` |
| mood | string | ✓ | 场景氛围 |
| beats | array | ✓ | 分镜节拍数组，可为空数组，但字段必须存在 |
| outcome | string | ✓ | 场景结果或遗留悬念 |

### beats（分镜节拍）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | ✓ | 分镜 ID，必须匹配 `chN.scN.bN` |
| type | string | ✓ | 必须为 `action` / `dialogue` / `inner` / `exposition` |
| summary | string | ✓ | 分镜摘要 |
| dialogue | object | ✗ | 当 `type=dialogue` 或 `type=inner` 时必填 |

### dialogue（对白）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| speaker | string | ✓ | 说话人，必须对应 `dramatis_personae.name` |
| content | string | ✓ | 对白或内心独白内容 |

### consistency_report（一致性报告）
| 字段 | 类型 | 说明 |
|------|------|------|
| roles_missing | array | 已被引用但未在 `dramatis_personae` 中定义的角色 |
| settings_missing | array | 已被引用但未在 `settings` 中可靠匹配到的地点 |
| dangling_refs | array | 已定义但未使用的角色/地点，或未回收的关键线索 |

## 强校验规则

当前项目实现会对以下内容进行强校验：

- 顶层必须包含 `version`、`metadata`、`dramatis_personae`、`settings`、`chapters`、`consistency_report`
- `version` 必须为 `"1.0"`
- `metadata.genre`、`metadata.tone`、`metadata.pacing` 必须与请求参数一致
- `metadata.source_chapters` 必须等于输入章节数
- `metadata.generated_at` 必须能被 RFC3339 成功解析
- `chapters[].id` 必须匹配 `chN`
- `scenes[].id` 必须匹配 `chN.scN`
- `beats[].id` 必须匹配 `chN.scN.bN`
- `beats[].type` 只能是 `action`、`dialogue`、`inner`、`exposition`
- `dialogue` 和 `inner` 类型的 beat 必须包含 `dialogue.speaker` 与 `dialogue.content`
- `traits`、`relations`、`aliases`、`roles_missing`、`settings_missing`、`dangling_refs` 都必须是数组

## 一致性软匹配规则

地点引用校验采用“精确匹配 + 软匹配”组合策略：

1. 精确匹配：与 `settings.name` 或 `settings.aliases` 完全一致
2. 包含匹配：若地点字符串之间存在明显包含关系，且长度差较小，则尝试归并
3. 相似度匹配：使用 bigram Jaccard 相似度择优匹配

设计原因：

- 小说原文中的地点表达常常不统一，例如“城南老宅”“城南老宅院落”“老宅”
- 纯精确匹配会带来大量误报
- 软匹配可以降低人工清洗成本，同时保留保守兜底，避免误归并

## API 使用说明

当前项目采用**异步任务模式**，而不是同步直接返回 YAML。

### 1. 发起转换任务

```bash
curl -X POST http://localhost:8000/api/v1/script/convert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "chapters": [
      { "title": "第一章", "text": "小说正文内容..." },
      { "title": "第二章", "text": "小说正文内容..." },
      { "title": "第三章", "text": "小说正文内容..." }
    ],
    "genre": "悬疑",
    "tone": "压抑",
    "pacing": "medium"
  }'
```

请求约束：

- `chapters.length` 必须在 `3~12`
- 每个章节必须同时包含 `title` 和 `text`
- `pacing` 只能是 `fast` / `medium` / `slow`

### 2. 发起转换的响应示例

```json
{
  "code": 200,
  "data": {
    "id": "task_1717590600000000000",
    "status": "pending",
    "detail_url": "/api/v1/script/task_1717590600000000000",
    "event_url": "/api/v1/script/task_1717590600000000000/events"
  },
  "trace_id": "xxx"
}
```

### 3. 查询任务详情的响应示例

```json
{
  "code": 200,
  "data": {
    "id": "task_1717590600000000000",
    "yaml": "version: \"1.0\"\nmetadata:\n  ...",
    "summary": {
      "chapters": 3,
      "scenes": 12,
      "beats": 45,
      "characters": 8,
      "settings": 5
    },
    "consistency_report": {
      "roles_missing": [],
      "settings_missing": [],
      "dangling_refs": []
    },
    "metadata": {
      "id": "task_1717590600000000000",
      "title": "尾声典当行",
      "genre": "悬疑",
      "tone": "压抑",
      "pacing": "medium",
      "source_chapters": 3,
      "status": "succeeded",
      "created_at": "2026-06-06T04:58:00+08:00",
      "updated_at": "2026-06-06T04:58:30+08:00"
    }
  },
  "trace_id": "xxx"
}
```

## 最佳实践

1. 章节输入优先控制在 `5~10` 章，兼顾内容完整度和生成稳定性。
2. 长文本章节应尽量保留关键剧情、角色关系和地点信息，减少无关铺陈。
3. 生成后优先检查 `dramatis_personae`、`settings` 和 `consistency_report`，再细修场景与 beat。
4. 修改 YAML 时应保持 ID 结构稳定，避免破坏 `chN / chN.scN / chN.scN.bN` 引用规则。
5. 对长对白、说明性文本建议使用 YAML block scalar，减少引号和转义带来的解析风险。

## 版本历史

- **v1.0** (2025-06-05)：初版发布，定义了小说转剧本的基础 YAML 结构。
- **v1.0（2026-06-06附注）**：补充 `settings.aliases`、地点软匹配说明、异步任务接口说明，以及当前工程 `3~12` 章节约束。
