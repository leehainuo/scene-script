# 剧本YAML Schema v1.0 规范

## 概述

本文档定义了N2S（Novel To Screenplay）工具输出的标准剧本YAML格式，旨在为网文作者提供结构化、可编辑、可进一步打磨的剧本初稿。

## 设计原则

### 1. 结构化与可视化
- **分层设计**：章节 → 场景 → 分镜节拍，逐层递进，便于编剧在不同粒度上编辑和审视。
- **全局注册表**：`dramatis_personae` 和 `settings` 作为全剧人物和地点的唯一数据源，避免多处重复定义，降低维护成本。

### 2. 一致性保障
- **角色引用校验**：所有对话、视角、关系描述中的角色名必须在 `dramatis_personae` 中注册，系统自动检测未定义或悬空的引用。
- **地点引用校验（软匹配）**：所有场景的 `location` 会优先尝试与 `settings` 精确匹配；若不命中，系统会执行规范化 + 模糊匹配（包含关系、小差值容忍、bigram Jaccard 相似度阈值）来自动归并到已登记地点，减少“母地点 + 子区域”写法导致的误报。

### 3. 编剧友好
- **分镜类型明确**：`beats.type` 分为 `action`（动作）、`dialogue`（对白）、`inner`（内心独白）、`exposition`（叙述/说明），方便后期导演、美术、录音等部门拆解。
- **场景目标与收尾**：每个场景强制定义 `goal`（核心冲突/推进目标）和 `outcome`（场景收尾结果/遗留悬念），规避剧本松散流水账。

### 4. 工具友好
- **标准化格式**：遵循YAML规范，易于解析、版本控制、集成到编剧工具链。
- **元数据完整**：`metadata` 包含生成参数（体裁、语气、节奏）和生成时间，便于追溯和复现。

## YAML 完整规范

```yaml
version: "1.0"

metadata:
  title: "原作小说名称"
  author: "原作者名称"
  genre: "悬疑|言情|科幻|现实主义|其他"
  tone: "压抑|轻松|热血|温暖|其他"
  pacing: "fast|medium|slow"
  source_chapters: 3
  generated_at: "2025-06-05T12:30:00+08:00"

# 全剧人物总表（唯一数据源）
dramatis_personae:
  - name: "张三"
    archetype: "主角|配角|路人|反派"
    motivation: "角色核心行动动机，50-100字"
    traits: ["聪慧", "坚韧", "孤独"]
    relations: 
      - "和李四为兄弟"
      - "与王五敌对"
    first_appearance: "Chapter 1"
  
  - name: "李四"
    archetype: "配角"
    motivation: "..."
    traits: []
    relations: []
    first_appearance: "Chapter 2"

# 全剧场景地点总表（唯一数据源）
settings:
  - name: "XX公寓"
    description: "位于市中心的高档公寓，三室两厅，现代装修风格"
    importance: "high|medium|low"
    # 可选扩展字段（后向兼容）：
    aliases: ["XX小区公寓楼", "公寓"]
  
  - name: "废弃仓库"
    description: "郊外的老工业园区，昏暗潮湿"
    importance: "high"

# 正文章节数据
chapters:
  - id: "ch1"
    title: "第一章标题"
    summary: "50-100字章节梗概，概括本章主要事件和推进"
    scenes:
      - id: "ch1.sc1"
        title: "场景标题"
        goal: "本场景的核心冲突或推进目标，例：张三发现李四的秘密"
        location: "XX公寓书房"  # 原始地点短语（可包含子区）
        time: "Day|Night|Dawn|Dusk|Autumn|Spring|..."
        pov: "张三"  # 主视角角色名，必须对应 dramatis_personae
        mood: "阴郁|欢快|紧张|温暖|..."
        beats:
          - id: "ch1.sc1.b1"
            type: "action|dialogue|inner|exposition"
            summary: "分镜简短摘要，10-30字"
            dialogue:
              speaker: "张三"  # 必须对应 dramatis_personae
              content: "对白正文"
          
          - id: "ch1.sc1.b2"
            type: "dialogue"
            summary: "李四回应"
            dialogue:
              speaker: "李四"
              content: "..."
          
          - id: "ch1.sc1.b3"
            type: "inner"
            summary: "张三的内心独白"
            dialogue:
              speaker: "张三"
              content: "（内心）我终于明白了..."
        
        outcome: "场景收尾结果或遗留悬念，例：张三决定调查真相，但李四察觉到了异常"

      - id: "ch1.sc2"
        title: "第二场景"
        goal: "..."
        location: "废弃仓库"
        time: "Night"
        pov: "李四"
        mood: "紧张"
        beats: []
        outcome: "..."

  - id: "ch2"
    title: "第二章标题"
    summary: "..."
    scenes: []

  - id: "ch3"
    title: "第三章标题"
    summary: "..."
    scenes: []

# 剧本一致性质检报告（自动生成）
consistency_report:
  roles_missing:
    - "王五"  # dramatis_personae 中未定义但在剧本中被引用的角色
  settings_missing:
    - "神秘地下室"  # settings 中未定义但在场景中被引用的地点
  dangling_refs:
    - "角色 '赵六' 已定义但未在任何场景中出现"
    - "场景 '咖啡厅' 已定义但未被任何场景使用"
    - "第一章提及的'神秘钥匙'伏笔在全剧中未回收"
```

## 字段详解

### metadata（元数据）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| title | string | ✓ | 原作小说名称 |
| author | string | ✓ | 原作者名称 |
| genre | string | ✓ | 体裁：悬疑/言情/科幻/现实主义/其他 |
| tone | string | ✓ | 语气：压抑/轻松/热血/温暖/其他 |
| pacing | string | ✓ | 节奏：fast(快)/medium(中)/slow(慢) |
| source_chapters | int | ✓ | 源小说章节数 |
| generated_at | string | ✓ | 生成时间（ISO 8601格式） |

### dramatis_personae（人物表）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | ✓ | 角色名称，全剧唯一 |
| archetype | string | ✓ | 角色类型：主角/配角/路人/反派 |
| motivation | string | ✓ | 核心行动动机，50-100字 |
| traits | array | ✓ | 性格标签数组，如["聪慧", "坚韧"] |
| relations | array | ✓ | 与其他角色的关系描述数组 |
| first_appearance | string | ✓ | 首次出现的章节，如"Chapter 1" |

### settings（地点表）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | ✓ | 地点名称，全剧唯一 |
| description | string | ✓ | 地点描述，环境、氛围等 |
| importance | string | ✓ | 重要程度：high/medium/low |
| aliases | array | ✗ | 可选：地点别名集合（如“城南老宅院落/老宅院落”），用于软匹配与检索 |

### chapters（章节）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | ✓ | 章节ID，如"ch1"、"ch2" |
| title | string | ✓ | 章节标题 |
| summary | string | ✓ | 章节梗概，50-100字 |
| scenes | array | ✓ | 场景数组 |

### scenes（场景）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | ✓ | 场景ID，如"ch1.sc1" |
| title | string | ✓ | 场景标题 |
| goal | string | ✓ | 场景目标/核心冲突 |
| location | string | ✓ | 地点短语，优先与 settings 精确匹配；不命中时进入软匹配流程 |
| time | string | ✓ | 时间：Day/Night/Dawn/Dusk/季节等 |
| pov | string | ✓ | 主视角角色，必须对应dramatis_personae |
| mood | string | ✓ | 场景氛围：阴郁/欢快/紧张等 |
| beats | array | ✓ | 分镜节拍数组 |
| outcome | string | ✓ | 场景收尾或遗留悬念 |

### beats（分镜节拍）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | ✓ | 分镜ID，如"ch1.sc1.b1" |
| type | string | ✓ | 类型：action/dialogue/inner/exposition |
| summary | string | ✓ | 分镜摘要，10-30字 |
| dialogue | object | ✗ | 对白对象，type为dialogue/inner时使用 |

### dialogue（对白）
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| speaker | string | ✓ | 说话人，必须对应dramatis_personae |
| content | string | ✓ | 对白内容 |

### consistency_report（一致性报告）
| 字段 | 类型 | 说明 |
|------|------|------|
| roles_missing | array | dramatis_personae 中未定义但被引用的角色 |
| settings_missing | array | settings 中未定义但被引用的地点（已应用软匹配后仍无法归并的项） |
| dangling_refs | array | 已定义但未使用的角色/地点或未回收的伏笔 |

> 说明：为保持与 v1.0 校验逻辑兼容，`consistency_report` 结构不变。系统内部已启用软匹配（规范化、包含关系的小差值容忍、bigram Jaccard 阈值），只有在无法可靠归并时，才会把地点加入 `settings_missing`。

#### 一致性软匹配规则（实现说明）
- 规范化：小写、去空白与常见标点，移除弱语气助词（如“的/里”）。
- 匹配级联：
  1) 精确匹配：与 `settings.name` 或其 `aliases` 完全相同。
  2) 包含匹配（小差值容忍）：若 A 包含 B 且长度差 ≤ 4（如“城南老宅院落”⊇“城南老宅”），视为同一地点。
  3) 相似度匹配：按 bigram Jaccard 相似度择优；阈值默认 0.72，低于阈值不自动归并。
- 置信度：当出现多个候选时，择最高分；若最高分仍低于阈值，保留为缺失项以避免误归。

## 示例：完整剧本

```yaml
version: "1.0"
metadata:
  title: "三体"
  author: "刘慈欣"
  genre: "科幻"
  tone: "压抑"
  pacing: "medium"
  source_chapters: 3
  generated_at: "2025-06-05T12:30:00+08:00"

dramatis_personae:
  - name: "叶文洁"
    archetype: "主角"
    motivation: "为人类文明寻找出路，不惜与外星文明接触"
    traits: ["聪慧", "执着", "孤独"]
    relations: ["与丈夫杨卫宁感情破裂", "与女儿叶朵关系冷漠"]
    first_appearance: "Chapter 1"
  
  - name: "杨卫宁"
    archetype: "配角"
    motivation: "追求科学真理，却在文革中遭遇打击"
    traits: ["理想主义", "脆弱"]
    relations: ["叶文洁的丈夫"]
    first_appearance: "Chapter 1"

settings:
  - name: "红岸基地"
    description: "深山中的秘密军事基地，用于接收宇宙信号"
    importance: "high"
  
  - name: "叶文洁的家"
    description: "简陋的农村住所，见证了一个家庭的破裂"
    importance: "medium"

chapters:
  - id: "ch1"
    title: "文革时期"
    summary: "叶文洁和丈夫杨卫宁在文革中遭遇打击，杨卫宁自杀身亡，叶文洁陷入绝望。"
    scenes:
      - id: "ch1.sc1"
        title: "批斗大会"
        goal: "展现文革的残酷，杨卫宁在批斗中失去理性"
        location: "叶文洁的家"
        time: "Day"
        pov: "叶文洁"
        mood: "压抑"
        beats:
          - id: "ch1.sc1.b1"
            type: "exposition"
            summary: "叙述文革背景和杨卫宁的遭遇"
            dialogue: null
          
          - id: "ch1.sc1.b2"
            type: "dialogue"
            summary: "杨卫宁与叶文洁的对话"
            dialogue:
              speaker: "杨卫宁"
              content: "文洁，我们完了。这个世界没有希望了。"
          
          - id: "ch1.sc1.b3"
            type: "inner"
            summary: "叶文洁的内心独白"
            dialogue:
              speaker: "叶文洁"
              content: "（内心）我不能失去他。但我也无力拯救他。"
        
        outcome: "杨卫宁最终选择了自杀，叶文洁陷入深深的绝望和愤怒。"

consistency_report:
  roles_missing: []
  settings_missing: []
  dangling_refs: []
```

## API 使用说明

### 请求示例

```bash
curl -X POST http://localhost:8000/api/v1/script/convert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "chapters": [
      {
        "title": "第一章",
        "text": "小说正文内容..."
      },
      {
        "title": "第二章",
        "text": "小说正文内容..."
      },
      {
        "title": "第三章",
        "text": "小说正文内容..."
      }
    ],
    "genre": "悬疑",
    "tone": "压抑",
    "pacing": "medium"
  }'
```

### 响应示例

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
    }
  },
  "trace_id": "xxx"
}
```

## 最佳实践

1. **角色设定**：确保每个角色都有明确的动机和关系，避免"工具人"角色。
2. **场景设计**：每个场景都应有明确的目标和收尾，推进故事进展。
3. **分镜拆解**：action/dialogue/inner/exposition 的比例应合理，避免过度对话或过度叙述。
4. **一致性检查**：定期查看 consistency_report，及时修正未定义或悬空的引用。
5. **版本管理**：使用 Git 管理 YAML 文件，便于追溯修改历史和协同编辑。

## 版本历史

- **v1.0** (2025-06-05)：初版发布，包含完整的剧本结构、人物表、地点表、分镜设计和一致性校验。
- **v1.0（2026-06-06附注）**：在不改动 version 的前提下，补充 `settings.aliases`（地点别名）并完善一致性“软匹配”策略说明；向后兼容现有解析与校验。
