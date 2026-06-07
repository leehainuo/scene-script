# AI 小说转剧本工具 YAML Schema v1.0

## 1. 文档说明

本文档用于交付“题目三：AI 小说转剧本工具”中的剧本 YAML Schema，说明**字段定义、校验规则、设计原因**以及它如何支撑“小说 -> 剧本初稿 -> 继续编辑”的完整链路。

题目要求如下：

> 能将 3 个章节以上的小说文本自动转换为结构化剧本（YAML 格式），让作者可以快速获得可编辑、可进一步打磨的剧本初稿。请额外写一篇文档，定义剧本的 YAML Schema。文档中需说明该 Schema 的设计原因。

本项目对题目的落地方式如下：

- 输入：接收 `3` 章及以上的小说文本，当前工程稳定范围为 `3~12` 章。
- 输出：生成结构化剧本 YAML，而不是自由文本。
- 目标：让结果既能被程序解析，也能被作者继续编辑和打磨。
- 补充：在 YAML 正文之外增加一致性质检信息，帮助作者更快发现结构问题。

## 2. 设计目标

本 Schema 不只是“把大模型输出包成一个格式”，而是围绕以下四个目标设计：

### 2.1 可解析

- 后端可以稳定解析 YAML，并做格式修复、Schema 校验和一致性检查。
- 前端可以把 YAML 转成结构树、表单和统计信息。

### 2.2 可编辑

- 作者修改人物、地点、场景、节拍时，系统可以精准定位到对应节点。
- 数据结构天然适合可视化编辑器，而不是只能展示原始文本。

### 2.3 可打磨

- 生成结果不是终稿，而是可继续改写的“剧本骨架”。
- 章节、场景、节拍的层级拆分，便于逐层精修。

### 2.4 可校验

- 长文本改编常见问题包括角色漏登记、地点不统一、跨章节引用漂移。
- Schema 通过注册表和一致性报告，把这些问题显式暴露出来。

## 4. 为什么这样设计 Schema

### 4.1 为什么要有 `dramatis_personae`

人物总表单独维护，而不是把人物信息分散写在正文中，原因是：

- 角色名称需要全剧统一，避免“张三 / 三哥 / 老张”混杂后难以维护。
- 人物动机、关系、首次出场信息适合集中管理。
- 前端在编辑 `pov`、`speaker` 时可以直接引用人物表，减少错误。

### 4.2 为什么要有 `settings`

地点总表单独维护，并支持 `aliases`，原因是：

- 小说原文中同一地点常出现不同叫法。
- 地点统一注册后，便于做精确匹配、软匹配和联动修改。
- 作者修改地点名称后，可以同步影响场景引用。

### 4.3 为什么采用 `chapters -> scenes -> beats`

这套层级是小说改编为剧本时最核心的结构化表达：

- `chapters` 保留原作章节级推进。
- `scenes` 表示剧本化后的场次，是戏剧组织的主单元。
- `beats` 把场景继续拆成动作、对白、内心、说明等可细修节点。

这样设计后，输出结果不只是“剧情摘要”，而是一份可继续创作的剧本初稿。

### 4.4 为什么要有 `consistency_report`

大模型即使能输出合法 YAML，也不代表内容一定完全可靠。

因此 Schema 额外保留一致性报告，用来暴露：

- 被引用但未定义的角色
- 被引用但未登记的地点
- 已定义但未使用的角色、地点或可疑线索

这样作者拿到的不是“只会生成”的结果，而是“生成 + 质检”的结果。

## 5. 顶层结构

完整 YAML 顶层固定为以下六部分：

```yaml
version: "1.0"
metadata: {}
dramatis_personae: []
settings: []
chapters: []
consistency_report: {}
```

字段说明：

- `version`：Schema 版本号。
- `metadata`：剧本生成元数据。
- `dramatis_personae`：人物总表。
- `settings`：地点总表。
- `chapters`：剧本正文章节内容。
- `consistency_report`：一致性质检结果。

## 6. 标准 YAML 示例

下面给出一份标准示例，用于说明推荐结构：

```yaml
version: "1.0"

metadata:
  title: "长夜来信"
  author: "示例作者"
  genre: "悬疑"
  tone: "压抑"
  pacing: "medium"
  source_chapters: 3
  generated_at: "2026-06-06T12:30:00+08:00"

dramatis_personae:
  - name: "张三"
    archetype: "主角"
    motivation: "查清失踪案真相，并保护妹妹不被牵连。"
    traits:
      - "冷静"
      - "敏锐"
      - "执拗"
    relations:
      - "与李四是多年搭档"
      - "与周岚互不信任"
    first_appearance: "ch1"

  - name: "李四"
    archetype: "配角"
    motivation: "协助调查，但暗中保留关键线索。"
    traits:
      - "谨慎"
    relations: []
    first_appearance: "ch1"

settings:
  - name: "旧城区公寓"
    description: "位于旧城区尽头的老式公寓，狭窄昏暗，常年无人修缮。"
    importance: "high"
    aliases:
      - "老公寓"
      - "张三住处"

  - name: "废弃仓库"
    description: "郊外工业园里的一间废弃仓库，潮湿阴冷。"
    importance: "medium"

chapters:
  - id: "ch1"
    title: "深夜来信"
    summary: "张三收到匿名信，重新卷入多年前的失踪案。"
    scenes:
      - id: "ch1.sc1"
        title: "信封上的旧地址"
        goal: "建立悬念，推动主角重新展开调查。"
        location: "旧城区公寓"
        time: "Night"
        pov: "张三"
        mood: "压迫"
        beats:
          - id: "ch1.sc1.b1"
            type: "action"
            summary: "张三在门缝中发现一封没有署名的旧信。"
          - id: "ch1.sc1.b2"
            type: "dialogue"
            summary: "李四提醒张三不要再追查旧案。"
            dialogue:
              speaker: "李四"
              content: "这封信不该出现在这里，你最好当作没看见。"
          - id: "ch1.sc1.b3"
            type: "inner"
            summary: "张三意识到李四在隐瞒信息。"
            dialogue:
              speaker: "张三"
              content: "他越想阻止我，就越说明这封信和旧案有关。"
        outcome: "张三决定按信中的地址继续调查。"

  - id: "ch2"
    title: "雨夜追踪"
    summary: "张三与李四前往旧案现场，发现新的可疑痕迹。"
    scenes: []

  - id: "ch3"
    title: "仓库里的证词"
    summary: "主角一行人在废弃仓库取得关键证词，故事进入下一阶段。"
    scenes: []

consistency_report:
  roles_missing: []
  settings_missing: []
  dangling_refs: []
```

## 7. 字段定义

### 7.1 `metadata`

| 字段                | 类型     | 必填 | 说明                                |
| ----------------- | ------ | -- | --------------------------------- |
| `title`           | string | 是  | 原作标题或系统归纳出的剧本标题                   |
| `author`          | string | 是  | 原作者名称，未知时建议填“未知作者”                |
| `genre`           | string | 是  | 体裁，必须与转换请求一致                      |
| `tone`            | string | 是  | 语气，必须与转换请求一致                      |
| `pacing`          | string | 是  | 节奏，只能是 `fast` / `medium` / `slow` |
| `source_chapters` | int    | 是  | 源小说章节数，必须与输入章节数一致                 |
| `generated_at`    | string | 是  | 生成时间，必须为 RFC3339 格式               |

### 7.2 `dramatis_personae`

| 字段                 | 类型        | 必填 | 说明                 |
| ------------------ | --------- | -- | ------------------ |
| `name`             | string    | 是  | 角色名称，全剧唯一          |
| `archetype`        | string    | 是  | 角色类型，如主角、配角、反派     |
| `motivation`       | string    | 是  | 角色核心行动动机           |
| `traits`           | string\[] | 是  | 性格标签数组             |
| `relations`        | string\[] | 是  | 与其他角色的关系描述数组       |
| `first_appearance` | string    | 是  | 首次出现章节，建议格式为 `chN` |

### 7.3 `settings`

| 字段            | 类型        | 必填 | 说明                                 |
| ------------- | --------- | -- | ---------------------------------- |
| `name`        | string    | 是  | 地点名称，全剧唯一                          |
| `description` | string    | 是  | 地点说明，描述空间特征、氛围或用途                  |
| `importance`  | string    | 是  | 重要程度，只能是 `high` / `medium` / `low` |
| `aliases`     | string\[] | 否  | 地点别名数组，用于软匹配与检索                    |

### 7.4 `chapters`

| 字段        | 类型       | 必填 | 说明                  |
| --------- | -------- | -- | ------------------- |
| `id`      | string   | 是  | 章节 ID，格式为 `chN`     |
| `title`   | string   | 是  | 章节标题                |
| `summary` | string   | 是  | 章节梗概                |
| `scenes`  | Scene\[] | 是  | 场景数组，允许为空数组，但字段必须存在 |

### 7.5 `scenes`

| 字段         | 类型      | 必填 | 说明                              |
| ---------- | ------- | -- | ------------------------------- |
| `id`       | string  | 是  | 场景 ID，格式为 `chN.scN`             |
| `title`    | string  | 是  | 场景标题                            |
| `goal`     | string  | 是  | 本场景的核心推进目标或冲突                   |
| `location` | string  | 是  | 场景地点，优先与 `settings` 对齐          |
| `time`     | string  | 是  | 时间标签，如 `Day` / `Night` / `Dawn` |
| `pov`      | string  | 是  | 主视角角色，建议与人物表名称保持一致              |
| `mood`     | string  | 是  | 场景氛围                            |
| `beats`    | Beat\[] | 是  | 节拍数组，允许为空数组，但字段必须存在             |
| `outcome`  | string  | 是  | 场景结果、推进或悬念落点                    |

### 7.6 `beats`

| 字段         | 类型     | 必填   | 说明                                                 |
| ---------- | ------ | ---- | -------------------------------------------------- |
| `id`       | string | 是    | 节拍 ID，格式为 `chN.scN.bN`                             |
| `type`     | string | 是    | 只能是 `action` / `dialogue` / `inner` / `exposition` |
| `summary`  | string | 是    | 节拍摘要                                               |
| `dialogue` | object | 条件必填 | 当 `type` 为 `dialogue` 或 `inner` 时必须存在              |

### 7.7 `dialogue`

| 字段        | 类型     | 必填 | 说明             |
| --------- | ------ | -- | -------------- |
| `speaker` | string | 是  | 说话人，建议与人物表名称一致 |
| `content` | string | 是  | 对白或内心独白内容      |

### 7.8 `consistency_report`

| 字段                 | 类型        | 说明                                 |
| ------------------ | --------- | ---------------------------------- |
| `roles_missing`    | string\[] | 已被引用但未在 `dramatis_personae` 中定义的角色 |
| `settings_missing` | string\[] | 已被引用但未在 `settings` 中可靠匹配的地点        |
| `dangling_refs`    | string\[] | 已定义但未被使用，或疑似未回收的引用                 |

## 8. 强校验规则

当前项目对以下内容进行强校验：

- 顶层必须包含 `version`、`metadata`、`dramatis_personae`、`settings`、`chapters`、`consistency_report`。
- `version` 必须是 `"1.0"`。
- `metadata.title`、`metadata.author` 必须非空。
- `metadata.genre`、`metadata.tone`、`metadata.pacing` 必须与请求参数一致。
- `metadata.pacing` 只能是 `fast`、`medium`、`slow`。
- `metadata.source_chapters` 必须等于输入章节数。
- `metadata.generated_at` 必须符合 RFC3339。
- 人物名、地点名必须在各自注册表中唯一。
- `chapters[].id` 必须匹配 `chN`。
- `scenes[].id` 必须匹配 `chN.scN`。
- `beats[].id` 必须匹配 `chN.scN.bN`。
- `beats[].type` 只能是 `action`、`dialogue`、`inner`、`exposition`。
- 当 `beat.type` 为 `dialogue` 或 `inner` 时，`dialogue.speaker` 和 `dialogue.content` 必须存在且非空。
- `traits`、`relations`、`aliases`、`roles_missing`、`settings_missing`、`dangling_refs` 必须是数组。

## 9. 一致性检查规则

除强校验外，系统还会基于注册表做一致性质检。

### 9.1 角色检查

- 检查 `scene.pov` 是否在 `dramatis_personae` 中登记。
- 检查 `beat.dialogue.speaker` 是否在 `dramatis_personae` 中登记。

### 9.2 地点检查

地点采用“精确匹配 + 软匹配”组合策略：

1. 先与 `settings.name` 精确匹配。
2. 再与 `settings.aliases` 精确匹配。
3. 若仍未命中，再做保守的文本相似归并。

这样设计是因为小说原文中的地点表达常常不统一，例如“老宅”“城南老宅”“城南老宅院落”可能实际上是同一处地点。

### 9.3 悬空引用检查

系统会识别：

- 已定义但长期未被使用的角色或地点
- 结构上可疑的悬空引用

这些信息会写入 `consistency_report`，供作者二次排查。

## 10. 与题目要求的对应关系

题目要求的“结构化剧本初稿”在本 Schema 中具体体现为：

- `metadata`：说明这份 YAML 来源于哪部作品、何种风格约束。
- `dramatis_personae`：让角色在全剧中统一维护。
- `settings`：让地点表达可复用、可归并。
- `chapters`：保留原作章节推进。
- `scenes`：完成剧本化场次拆分。
- `beats`：提供继续打磨的最小叙事节点。
- `consistency_report`：帮助作者发现结构问题，而不是只拿到一份“看起来像剧本”的文本。

因此，这份 Schema 服务的不是“展示一次结果”，而是“支撑后续编辑与打磨”。

## 11. 当前工程约束

题目要求是“3 个章节以上”，当前工程实现进一步收敛为：

- 最少 `3` 章
- 最多 `12` 章
- 推荐区间 `5~10` 章

原因如下：

- 少于 `3` 章时，人物关系和剧情主线信息通常不足，剧本化质量不稳定。
- 多于 `12` 章时，单轮大模型输出更容易截断、结构损坏或超时。

因此，`3~12` 是当前版本在生成稳定性和产品体验之间的工程折中。

补充说明：

- 当前接口是**异步任务模式**，YAML 结果通过任务详情返回。
- 系统会在生成后自动补写 `consistency_report`。
- 若模型输出中对白结构不完整，系统可能在修复阶段将异常节拍降级为 `exposition`，以优先保住整体结构合法性。

## 13. 使用建议

为了获得更稳定的剧本初稿，建议：

1. 优先输入 `5~10` 章内容。
2. 章节文本尽量保留关键情节、人物关系和地点信息。
3. 生成后优先检查人物表、地点表和一致性报告，再精修场景与节拍。
4. 长对白或长说明文本建议使用 YAML block scalar，减少转义风险。

