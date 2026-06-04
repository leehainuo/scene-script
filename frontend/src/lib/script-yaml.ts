import YAML from "yaml"
import type {
  ScriptBeat,
  ScriptCharacter,
  ScriptChapter,
  ScriptConsistencyReport,
  ScriptDialogue,
  ScriptScene,
  ScriptSetting,
  ScriptSummary,
  ScriptYamlDocument,
  ScriptYamlMetadata,
} from "@/types"

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function normalizeDialogue(value: unknown): ScriptDialogue | undefined {
  const record = asRecord(value)
  if (!record) {
    return undefined
  }

  return {
    speaker: asString(record.speaker),
    content: asString(record.content),
  }
}

function normalizeBeat(value: unknown, chapterIndex: number, sceneIndex: number, beatIndex: number): ScriptBeat {
  const record = asRecord(value) ?? {}
  return {
    id: asString(record.id, `ch${chapterIndex + 1}.sc${sceneIndex + 1}.b${beatIndex + 1}`),
    type: asString(record.type, "action"),
    summary: asString(record.summary),
    dialogue: normalizeDialogue(record.dialogue),
  }
}

function normalizeScene(value: unknown, chapterIndex: number, sceneIndex: number): ScriptScene {
  const record = asRecord(value) ?? {}
  const rawBeats = Array.isArray(record.beats) ? record.beats : []

  return {
    id: asString(record.id, `ch${chapterIndex + 1}.sc${sceneIndex + 1}`),
    title: asString(record.title, `场景 ${sceneIndex + 1}`),
    goal: asString(record.goal),
    location: asString(record.location),
    time: asString(record.time),
    pov: asString(record.pov),
    mood: asString(record.mood),
    beats: rawBeats.map((beat, beatIndex) =>
      normalizeBeat(beat, chapterIndex, sceneIndex, beatIndex)
    ),
    outcome: asString(record.outcome),
  }
}

function normalizeChapter(value: unknown, chapterIndex: number): ScriptChapter {
  const record = asRecord(value) ?? {}
  const rawScenes = Array.isArray(record.scenes) ? record.scenes : []

  return {
    id: asString(record.id, `ch${chapterIndex + 1}`),
    title: asString(record.title, `第${chapterIndex + 1}章`),
    summary: asString(record.summary),
    scenes: rawScenes.map((scene, sceneIndex) =>
      normalizeScene(scene, chapterIndex, sceneIndex)
    ),
  }
}

function normalizeCharacter(value: unknown): ScriptCharacter {
  const record = asRecord(value) ?? {}

  return {
    name: asString(record.name),
    archetype: asString(record.archetype),
    motivation: asString(record.motivation),
    traits: asStringArray(record.traits),
    relations: asStringArray(record.relations),
    first_appearance: asString(record.first_appearance),
  }
}

function normalizeSetting(value: unknown): ScriptSetting {
  const record = asRecord(value) ?? {}

  return {
    name: asString(record.name),
    description: asString(record.description),
    importance: asString(record.importance, "medium"),
  }
}

function normalizeMetadata(value: unknown): ScriptYamlMetadata {
  const record = asRecord(value) ?? {}
  const sourceChapters =
    typeof record.source_chapters === "number"
      ? record.source_chapters
      : Number(record.source_chapters) || 0

  return {
    title: asString(record.title, "未命名剧本"),
    author: asString(record.author, "未知作者"),
    genre: asString(record.genre),
    tone: asString(record.tone),
    pacing: asString(record.pacing, "medium"),
    source_chapters: sourceChapters,
    generated_at: asString(record.generated_at, new Date().toISOString()),
  }
}

export function normalizeConsistency(report?: ScriptConsistencyReport) {
  return {
    rolesMissing: report?.roles_missing ?? report?.RolesMissing ?? [],
    settingsMissing: report?.settings_missing ?? report?.SettingsMissing ?? [],
    danglingRefs: report?.dangling_refs ?? report?.DanglingRefs ?? [],
  }
}

export function buildScriptConsistency(document: ScriptYamlDocument) {
  const definedRoles = new Set(
    document.dramatis_personae.map((item) => item.name.trim()).filter(Boolean)
  )
  const definedSettings = new Set(
    document.settings.map((item) => item.name.trim()).filter(Boolean)
  )

  const usedRoles = new Set<string>()
  const usedSettings = new Set<string>()

  document.chapters.forEach((chapter) => {
    chapter.scenes.forEach((scene) => {
      const pov = scene.pov.trim()
      const location = scene.location.trim()

      if (pov) {
        usedRoles.add(pov)
      }
      if (location) {
        usedSettings.add(location)
      }

      scene.beats.forEach((beat) => {
        const speaker = beat.dialogue?.speaker.trim()
        if (speaker) {
          usedRoles.add(speaker)
        }
      })
    })
  })

  const rolesMissing = [...usedRoles].filter((item) => !definedRoles.has(item)).sort()
  const settingsMissing = [...usedSettings]
    .filter((item) => !definedSettings.has(item))
    .sort()
  const danglingRoles = [...definedRoles]
    .filter((item) => !usedRoles.has(item))
    .map((item) => `角色 '${item}' 已定义但未在任何场景中出现`)
  const danglingSettings = [...definedSettings]
    .filter((item) => !usedSettings.has(item))
    .map((item) => `场景 '${item}' 已定义但未被任何场景使用`)

  return {
    roles_missing: rolesMissing,
    settings_missing: settingsMissing,
    dangling_refs: [...danglingRoles, ...danglingSettings],
  }
}

export function buildScriptSummary(document: ScriptYamlDocument): ScriptSummary {
  const scenes = document.chapters.reduce((count, chapter) => count + chapter.scenes.length, 0)
  const beats = document.chapters.reduce(
    (count, chapter) =>
      count + chapter.scenes.reduce((sceneCount, scene) => sceneCount + scene.beats.length, 0),
    0
  )

  return {
    chapters: document.chapters.length,
    scenes,
    beats,
    characters: document.dramatis_personae.length,
    settings: document.settings.length,
  }
}

export function parseScriptYaml(yamlText?: string) {
  if (!yamlText) {
    return null
  }

  try {
    const parsed = YAML.parse(yamlText) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== "object") {
      return null
    }

    const document: ScriptYamlDocument = {
      version: asString(parsed.version, "1.0"),
      metadata: normalizeMetadata(parsed.metadata),
      dramatis_personae: Array.isArray(parsed.dramatis_personae)
        ? parsed.dramatis_personae.map(normalizeCharacter)
        : [],
      settings: Array.isArray(parsed.settings) ? parsed.settings.map(normalizeSetting) : [],
      chapters: Array.isArray(parsed.chapters)
        ? parsed.chapters.map((chapter, chapterIndex) => normalizeChapter(chapter, chapterIndex))
        : [],
      consistency_report: {
        roles_missing: [],
        settings_missing: [],
        dangling_refs: [],
      },
    }

    document.consistency_report = buildScriptConsistency(document)
    return document
  } catch {
    return null
  }
}

export function serializeScriptYaml(document: ScriptYamlDocument) {
  const payload: ScriptYamlDocument = {
    ...document,
    consistency_report: buildScriptConsistency(document),
  }

  return YAML.stringify(payload, {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
  })
}
