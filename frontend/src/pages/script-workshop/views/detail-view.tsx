import type { Dispatch, RefObject, SetStateAction } from "react"
import { Copy, Download, GripVertical, Trash2, Wand2 } from "lucide-react"
import { ScriptDetailHeader } from "@/components/script-workshop/detail-header"
import { SegmentedToolbar } from "@/components/script-workshop/segmented-toolbar"
import { TreeNode } from "@/components/script-workshop/tree-node"
import { ValidationMessage } from "@/components/script-workshop/validation-message"
import { StudioPanel } from "@/components/studio/studio-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatScriptStyleSummary, getPacingLabel } from "@/lib/script-display"
import {
  BEAT_TYPE_OPTIONS,
  formatDateTime,
  getBeatTypeLabel,
} from "@/lib/script-workshop"
import type { RegistryTab, ResultView, ScriptTreeNode, WorkshopResult } from "@/lib/script-workshop"
import { cn } from "@/lib/utils"
import type {
  ScriptBeat,
  ScriptChapter,
  ScriptScene,
  ScriptTaskMeta,
  ScriptYamlDocument,
} from "@/types"

type Summary = {
  chapters: number
  scenes: number
  beats: number
  characters: number
  settings: number
}

type Consistency = {
  rolesMissing: string[]
  settingsMissing: string[]
  danglingRefs: string[]
}

function parseInlineList(value: string) {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatInlineList(values?: string[]) {
  return (values ?? []).join("，")
}

function formatConsistencyItem(
  kind: "rolesMissing" | "settingsMissing" | "danglingRefs",
  item: string
) {
  if (kind === "rolesMissing") {
    return `人物「${item}」在正文里已经用到，但人物表里还没登记。`
  }

  if (kind === "settingsMissing") {
    return `地点「${item}」在场景里已经用到，但地点表里还没登记。`
  }

  const danglingRoleMatch = item.match(/^角色 '(.+)' 已定义但未在任何场景中出现$/)
  if (danglingRoleMatch) {
    return `人物表里有「${danglingRoleMatch[1]}」，但当前正文还没用到。`
  }

  const danglingSettingMatch = item.match(/^(场景|地点) '(.+)' 已定义但未被任何场景使用$/)
  if (danglingSettingMatch) {
    return `地点表里有「${danglingSettingMatch[2]}」，但当前场景还没引用。`
  }

  return item
}

const detailCardEnterClass =
  "animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out fill-mode-both"

function getDetailCardAnimationDelay(index: number) {
  return { animationDelay: `${Math.min(index, 8) * 60}ms` }
}

type DetailViewProps = {
  activeResult: WorkshopResult | null
  activeTaskMeta: ScriptTaskMeta | null
  activeStatus: { label: string }
  taskProgressMessage: string
  hasUnsavedChanges: boolean
  view: ResultView
  setView: Dispatch<SetStateAction<ResultView>>
  summary: Summary
  consistency: Consistency
  handleCopyYaml: () => Promise<void>
  handleDownloadYaml: () => void
  liveYaml: string
  semanticTree: ScriptTreeNode[]
  selectedNode: ScriptTreeNode | null
  selectedNodeId: string | null
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>
  editableDocument: ScriptYamlDocument | null
  selectedChapterData: ScriptChapter | null
  selectedSceneData: ScriptScene | null
  selectedBeatData: ScriptBeat | null
  updateScriptChapter: (chapterIndex: number, updater: (chapter: ScriptChapter) => ScriptChapter) => void
  updateScriptScene: (
    chapterIndex: number,
    sceneIndex: number,
    updater: (scene: ScriptScene) => ScriptScene
  ) => void
  updateScriptBeat: (
    chapterIndex: number,
    sceneIndex: number,
    beatIndex: number,
    updater: (beat: ScriptBeat) => ScriptBeat
  ) => void
  moveBeatInScene: (chapterIndex: number, sceneIndex: number, fromIndex: number, toIndex: number) => void
  draggedBeatId: string | null
  setDraggedBeatId: Dispatch<SetStateAction<string | null>>
  dragOverBeatId: string | null
  setDragOverBeatId: Dispatch<SetStateAction<string | null>>
  getFieldClassName: (path: string, baseClassName: string) => string
  getFieldError: (path: string) => string | undefined
  setRegistryTab: Dispatch<SetStateAction<RegistryTab>>
  registryView: RegistryTab
  activeRegistryIndex: number
  setSelectedCharacterIndex: Dispatch<SetStateAction<number>>
  setSelectedSettingIndex: Dispatch<SetStateAction<number>>
  selectedCharacter: ScriptYamlDocument["dramatis_personae"][number] | null
  selectedSetting: ScriptYamlDocument["settings"][number] | null
  addCharacter: () => void
  addSetting: () => void
  deleteCharacter: (index: number) => void
  deleteSetting: (index: number) => void
  updateScriptCharacter: (
    index: number,
    updater: (
      character: ScriptYamlDocument["dramatis_personae"][number]
    ) => ScriptYamlDocument["dramatis_personae"][number]
  ) => void
  updateScriptSetting: (
    index: number,
    updater: (setting: ScriptYamlDocument["settings"][number]) => ScriptYamlDocument["settings"][number]
  ) => void
  characterRenameOriginRef: RefObject<Record<number, string>>
  settingRenameOriginRef: RefObject<Record<number, string>>
  requestRenameConfirm: (kind: RegistryTab, previousName: string, nextName: string) => void
  characterNames: string[]
  settingNames: string[]
  currentPovOptions: string[]
  currentLocationOptions: string[]
  currentSpeakerOptions: string[]
  sceneRewriteInstruction: string
  setSceneRewriteInstruction: Dispatch<SetStateAction<string>>
  isSceneRewriting: boolean
  handleRewriteScene: () => Promise<void>
}

export function DetailView({
  activeResult,
  activeTaskMeta,
  activeStatus,
  taskProgressMessage,
  hasUnsavedChanges,
  view,
  setView,
  summary,
  consistency,
  handleCopyYaml,
  handleDownloadYaml,
  liveYaml,
  semanticTree,
  selectedNode,
  selectedNodeId,
  setSelectedNodeId,
  editableDocument,
  selectedChapterData,
  selectedSceneData,
  selectedBeatData,
  updateScriptChapter,
  updateScriptScene,
  updateScriptBeat,
  moveBeatInScene,
  draggedBeatId,
  setDraggedBeatId,
  dragOverBeatId,
  setDragOverBeatId,
  getFieldClassName,
  getFieldError,
  setRegistryTab,
  registryView,
  activeRegistryIndex,
  setSelectedCharacterIndex,
  setSelectedSettingIndex,
  selectedCharacter,
  selectedSetting,
  addCharacter,
  addSetting,
  deleteCharacter,
  deleteSetting,
  updateScriptCharacter,
  updateScriptSetting,
  characterRenameOriginRef,
  settingRenameOriginRef,
  requestRenameConfirm,
  characterNames,
  settingNames,
  currentPovOptions,
  currentLocationOptions,
  currentSpeakerOptions,
  sceneRewriteInstruction,
  setSceneRewriteInstruction,
  isSceneRewriting,
  handleRewriteScene,
}: DetailViewProps) {
  return (
    <div className="mx-auto max-w-[1040px] space-y-6">
      {!activeResult ? (
        <StudioPanel
          eyebrow="Detail"
          title={activeTaskMeta ? activeTaskMeta.title || "任务详情" : "详情预览"}
          description={
            activeTaskMeta
              ? "任务状态会实时同步，完成后会自动载入最终 YAML 与结构结果。"
              : "先在工作台生成剧本，或从作品中点开一个历史结果。"
          }
          animateOnMount
          animationDelayMs={0}
          className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
        >
          {activeTaskMeta ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: "状态", value: activeStatus.label },
                  { label: "体裁", value: activeTaskMeta.genre },
                  { label: "语气", value: activeTaskMeta.tone },
                  { label: "节奏", value: getPacingLabel(activeTaskMeta.pacing) },
                  { label: "章节", value: `${activeTaskMeta.source_chapters} 章` },
                ].map((item) => (
                  <div key={item.label} className="rounded-[22px] border border-black/6 bg-slate-50 px-4 py-4">
                    <p className="text-xs text-slate-400">{item.label}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
                <p className="text-xs text-slate-400">当前进度</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {taskProgressMessage ||
                    (activeTaskMeta.status === "failed"
                      ? activeTaskMeta.err_msg || "任务执行失败，请稍后重试。"
                      : "任务仍在处理中，已连接后台状态流，请稍候。")}
                </p>
                <p className="mt-4 text-sm text-slate-400">
                  最近更新：{formatDateTime(activeTaskMeta.updated_at)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-16 text-center">
              <p className="text-lg font-medium text-slate-800">还没有可展示的详情</p>
              <p className="mt-2 text-sm text-slate-400">
                你可以前往工作台生成，或者打开左侧“作品”选择一个已生成结果。
              </p>
            </div>
          )}
        </StudioPanel>
      ) : (
        <>
          <ScriptDetailHeader
            title={activeResult.metadata.title}
            hasUnsavedChanges={hasUnsavedChanges}
            view={view}
            onViewChange={setView}
            tabs={[
              { key: "summary", label: "总览", count: summary.chapters },
              {
                key: "registry",
                label: "注册表",
                count:
                  (editableDocument?.dramatis_personae.length ?? 0) +
                  (editableDocument?.settings.length ?? 0),
              },
              {
                key: "consistency",
                label: "质检",
                count:
                  consistency.rolesMissing.length +
                  consistency.settingsMissing.length +
                  consistency.danglingRefs.length,
              },
              { key: "structure", label: "结构" },
              { key: "yaml", label: "YAML" },
            ]}
          >
            {view === "summary" ? (
              <div className="space-y-5">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      {[
                        { label: "章节", value: summary.chapters },
                        { label: "场景", value: summary.scenes },
                        { label: "节拍", value: summary.beats },
                        { label: "角色", value: summary.characters },
                        { label: "地点", value: summary.settings },
                      ].map((item, index) => (
                        <div
                          key={item.label}
                          className={cn(
                            "rounded-[22px] border border-black/6 bg-slate-50 px-4 py-4",
                            detailCardEnterClass
                          )}
                          style={getDetailCardAnimationDelay(index)}
                        >
                          <p className="text-xs text-slate-400">{item.label}</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div
                        className={cn(
                          "rounded-[24px] border border-black/6 bg-slate-50 p-5",
                          detailCardEnterClass
                        )}
                        style={getDetailCardAnimationDelay(5)}
                      >
                        <p className="text-xs text-slate-400">结果摘要</p>
                        <p className="mt-3 text-sm leading-7 text-slate-600">
                          当前风格为{" "}
                          {formatScriptStyleSummary(
                            activeResult.metadata.genre,
                            activeResult.metadata.tone,
                            activeResult.metadata.pacing
                          )}
                          。本次结果基于 {activeResult.metadata.source_chapters} 章输入生成。
                        </p>
                        <p className="mt-4 text-sm text-slate-400">
                          最近更新：{formatDateTime(activeResult.metadata.updated_at)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "rounded-[24px] border border-black/6 bg-slate-50 p-5",
                          detailCardEnterClass
                        )}
                        style={getDetailCardAnimationDelay(6)}
                      >
                        <p className="text-xs text-slate-400">一致性质检概况</p>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                            正文用了但人物表没登记：{consistency.rolesMissing.length}
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                            场景用了但地点表没登记：{consistency.settingsMissing.length}
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                            已登记但当前未使用：{consistency.danglingRefs.length}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              </div>
            ) : null}

            {view === "registry" ? (
              !editableDocument ? (
                <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-12 text-center text-sm text-slate-400">
                  当前结果暂时无法编辑人物表和地点表。
                </div>
              ) : (
                <div className="space-y-5">
                  <SegmentedToolbar
                    items={[
                      {
                        key: "characters",
                        label: "人物",
                        count: editableDocument.dramatis_personae.length,
                      },
                      {
                        key: "settings",
                        label: "地点",
                        count: editableDocument.settings.length,
                      },
                    ]}
                    activeKey={registryView}
                    onChange={(key) => setRegistryTab(key as RegistryTab)}
                    actions={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={registryView === "characters" ? addCharacter : addSetting}
                        className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        {registryView === "characters" ? "新增角色" : "新增地点"}
                      </Button>
                    }
                  />

                  <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                        <div
                          className={cn(
                            "rounded-[24px] border border-black/6 bg-slate-50 p-3",
                            detailCardEnterClass
                          )}
                          style={getDetailCardAnimationDelay(0)}
                        >
                          <div className="max-h-[560px] space-y-2 overflow-y-auto">
                            {registryView === "characters"
                              ? editableDocument.dramatis_personae.map((character, index) => (
                                  <button
                                    key={`character-item-${index}`}
                                    type="button"
                                    onClick={() => setSelectedCharacterIndex(index)}
                                    className={cn(
                                      "w-full rounded-[20px] border px-4 py-4 text-left transition-colors",
                                      activeRegistryIndex === index
                                        ? "border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                                        : "border-transparent bg-transparent hover:border-black/6 hover:bg-white/80"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-slate-900">
                                          {character.name || `角色 ${index + 1}`}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                          {character.archetype || "未设置角色类型"}
                                        </p>
                                      </div>
                                      <span className="rounded-full border border-black/6 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                                        {character.first_appearance || "待补充"}
                                      </span>
                                    </div>
                                    <p className="mt-3 line-clamp-2 text-xs leading-6 text-slate-500">
                                      {character.motivation || "还没有填写角色动机。"}
                                    </p>
                                  </button>
                                ))
                              : editableDocument.settings.map((setting, index) => (
                                  <button
                                    key={`setting-item-${index}`}
                                    type="button"
                                    onClick={() => setSelectedSettingIndex(index)}
                                    className={cn(
                                      "w-full rounded-[20px] border px-4 py-4 text-left transition-colors",
                                      activeRegistryIndex === index
                                        ? "border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                                        : "border-transparent bg-transparent hover:border-black/6 hover:bg-white/80"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-slate-900">
                                          {setting.name || `地点 ${index + 1}`}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                          {setting.description || "还没有填写地点描述。"}
                                        </p>
                                      </div>
                                      <span className="rounded-full border border-black/6 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                                        {setting.importance}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                          </div>
                        </div>

                        <div
                          className={cn(
                            "rounded-[24px] border border-black/6 bg-slate-50 p-5",
                            detailCardEnterClass
                          )}
                          style={getDetailCardAnimationDelay(1)}
                        >
                          {registryView === "characters" ? (
                            selectedCharacter ? (
                              <div className="space-y-5">
                                <div className="rounded-[20px] bg-white px-4 py-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div>
                                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                        人物编辑
                                      </p>
                                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                                        {selectedCharacter.name || `角色 ${activeRegistryIndex + 1}`}
                                      </h3>
                                      <p className="mt-2 text-sm leading-6 text-slate-500">
                                        这里维护角色注册表，改名时会先确认是否同步更新视角角色、对白说话人和命中的正文文本。
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => deleteCharacter(activeRegistryIndex)}
                                      className="border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      删除
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label className="text-slate-600">角色名</Label>
                                    <Input
                                      value={selectedCharacter.name}
                                      onFocus={() => {
                                        characterRenameOriginRef.current[activeRegistryIndex] =
                                          selectedCharacter.name
                                      }}
                                      onChange={(event) =>
                                        updateScriptCharacter(activeRegistryIndex, (item) => ({
                                          ...item,
                                          name: event.target.value,
                                        }))
                                      }
                                      onBlur={(event) => {
                                        const previousName =
                                          characterRenameOriginRef.current[activeRegistryIndex] ??
                                          selectedCharacter.name
                                        requestRenameConfirm(
                                          "characters",
                                          previousName,
                                          event.target.value
                                        )
                                        delete characterRenameOriginRef.current[activeRegistryIndex]
                                      }}
                                      placeholder="请输入角色名"
                                      className={getFieldClassName(
                                        `dramatis_personae[${activeRegistryIndex}].name`,
                                        "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                      )}
                                    />
                                    <ValidationMessage
                                      message={getFieldError(
                                        `dramatis_personae[${activeRegistryIndex}].name`
                                      )}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-slate-600">角色类型</Label>
                                    <Input
                                      value={selectedCharacter.archetype}
                                      onChange={(event) =>
                                        updateScriptCharacter(activeRegistryIndex, (item) => ({
                                          ...item,
                                          archetype: event.target.value,
                                        }))
                                      }
                                      placeholder="主角 / 配角 / 反派"
                                      className={getFieldClassName(
                                        `dramatis_personae[${activeRegistryIndex}].archetype`,
                                        "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                      )}
                                    />
                                    <ValidationMessage
                                      message={getFieldError(
                                        `dramatis_personae[${activeRegistryIndex}].archetype`
                                      )}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-slate-600">动机</Label>
                                  <textarea
                                    value={selectedCharacter.motivation}
                                    onChange={(event) =>
                                      updateScriptCharacter(activeRegistryIndex, (item) => ({
                                        ...item,
                                        motivation: event.target.value,
                                      }))
                                    }
                                    placeholder="写下角色核心行动动机"
                                    className={getFieldClassName(
                                      `dramatis_personae[${activeRegistryIndex}].motivation`,
                                      "min-h-[120px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                    )}
                                  />
                                  <ValidationMessage
                                    message={getFieldError(
                                      `dramatis_personae[${activeRegistryIndex}].motivation`
                                    )}
                                  />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label className="text-slate-600">性格标签</Label>
                                    <Input
                                      key={`traits-${activeRegistryIndex}-${selectedCharacter.name}`}
                                      defaultValue={formatInlineList(selectedCharacter.traits)}
                                      onChange={(event) => {
                                        const nextValue = event.target.value
                                        updateScriptCharacter(activeRegistryIndex, (item) => ({
                                          ...item,
                                          traits: parseInlineList(nextValue),
                                        }))
                                      }}
                                      onBlur={(event) => {
                                        const normalized = formatInlineList(
                                          parseInlineList(event.target.value)
                                        )
                                        event.target.value = normalized
                                        updateScriptCharacter(activeRegistryIndex, (item) => ({
                                          ...item,
                                          traits: parseInlineList(normalized),
                                        }))
                                      }}
                                      placeholder="冷静，执着"
                                      className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-slate-600">首次出现</Label>
                                    <Input
                                      value={selectedCharacter.first_appearance}
                                      onChange={(event) =>
                                        updateScriptCharacter(activeRegistryIndex, (item) => ({
                                          ...item,
                                          first_appearance: event.target.value,
                                        }))
                                      }
                                      placeholder="Chapter 1"
                                      className={getFieldClassName(
                                        `dramatis_personae[${activeRegistryIndex}].first_appearance`,
                                        "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                      )}
                                    />
                                    <ValidationMessage
                                      message={getFieldError(
                                        `dramatis_personae[${activeRegistryIndex}].first_appearance`
                                      )}
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-[20px] border border-dashed border-black/8 bg-white px-4 py-12 text-center text-sm text-slate-400">
                                当前还没有角色，点击左上角“新增角色”开始维护。
                              </div>
                            )
                          ) : selectedSetting ? (
                            <div className="space-y-5">
                              <div className="rounded-[20px] bg-white px-4 py-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                      地点编辑
                                    </p>
                                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                                      {selectedSetting.name || `地点 ${activeRegistryIndex + 1}`}
                                    </h3>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                      这里维护地点注册表，改名时会先确认是否同步更新场景地点引用和命中的正文文本。
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteSetting(activeRegistryIndex)}
                                    className="border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除
                                  </Button>
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label className="text-slate-600">地点名</Label>
                                  <Input
                                    value={selectedSetting.name}
                                    onFocus={() => {
                                      settingRenameOriginRef.current[activeRegistryIndex] =
                                        selectedSetting.name
                                    }}
                                    onChange={(event) =>
                                      updateScriptSetting(activeRegistryIndex, (item) => ({
                                        ...item,
                                        name: event.target.value,
                                      }))
                                    }
                                    onBlur={(event) => {
                                      const previousName =
                                        settingRenameOriginRef.current[activeRegistryIndex] ??
                                        selectedSetting.name
                                      requestRenameConfirm(
                                        "settings",
                                        previousName,
                                        event.target.value
                                      )
                                      delete settingRenameOriginRef.current[activeRegistryIndex]
                                    }}
                                    placeholder="请输入地点名"
                                    className={getFieldClassName(
                                      `settings[${activeRegistryIndex}].name`,
                                      "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                    )}
                                  />
                                  <ValidationMessage
                                    message={getFieldError(`settings[${activeRegistryIndex}].name`)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-slate-600">重要程度</Label>
                                  <select
                                    value={selectedSetting.importance}
                                    onChange={(event) =>
                                      updateScriptSetting(activeRegistryIndex, (item) => ({
                                        ...item,
                                        importance: event.target.value,
                                      }))
                                    }
                                    className={getFieldClassName(
                                      `settings[${activeRegistryIndex}].importance`,
                                      "h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                    )}
                                  >
                                    <option value="high">high</option>
                                    <option value="medium">medium</option>
                                    <option value="low">low</option>
                                  </select>
                                  <ValidationMessage
                                    message={getFieldError(`settings[${activeRegistryIndex}].importance`)}
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-slate-600">地点别名（可选）</Label>
                                <Input
                                  key={`aliases-${activeRegistryIndex}-${selectedSetting.name}`}
                                  defaultValue={formatInlineList(selectedSetting.aliases)}
                                  onChange={(event) => {
                                    const nextValue = event.target.value
                                    updateScriptSetting(activeRegistryIndex, (item) => ({
                                      ...item,
                                      aliases: parseInlineList(nextValue),
                                    }))
                                  }}
                                  onBlur={(event) => {
                                    const normalized = formatInlineList(
                                      parseInlineList(event.target.value)
                                    )
                                    event.target.value = normalized
                                    updateScriptSetting(activeRegistryIndex, (item) => ({
                                      ...item,
                                      aliases: parseInlineList(normalized),
                                    }))
                                  }}
                                  placeholder="例如：城南老宅院落，老宅院落"
                                  className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-slate-600">地点描述</Label>
                                <textarea
                                  value={selectedSetting.description}
                                  onChange={(event) =>
                                    updateScriptSetting(activeRegistryIndex, (item) => ({
                                      ...item,
                                      description: event.target.value,
                                    }))
                                  }
                                  placeholder="描述环境、氛围和重要细节"
                                  className={getFieldClassName(
                                    `settings[${activeRegistryIndex}].description`,
                                    "min-h-[180px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                  )}
                                />
                                <ValidationMessage
                                  message={getFieldError(`settings[${activeRegistryIndex}].description`)}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-[20px] border border-dashed border-black/8 bg-white px-4 py-12 text-center text-sm text-slate-400">
                              当前还没有地点，点击左上角“新增地点”开始维护。
                            </div>
                          )}
                        </div>
                      </div>
                  </div>
              )
            ) : null}

            {view === "consistency" ? (
              <div className="grid gap-4 md:grid-cols-3">
                {([
                  {
                    label: "正文用了但人物表没登记",
                    items: consistency.rolesMissing,
                    kind: "rolesMissing",
                  },
                  {
                    label: "场景用了但地点表没登记",
                    items: consistency.settingsMissing,
                    kind: "settingsMissing",
                  },
                  {
                    label: "已登记但当前未使用",
                    items: consistency.danglingRefs,
                    kind: "danglingRefs",
                  },
                ] as const).map((group, index) => (
                  <div
                    key={group.label}
                    className={cn(
                      "rounded-[24px] border border-black/6 bg-slate-50 p-4",
                      detailCardEnterClass
                    )}
                    style={getDetailCardAnimationDelay(index)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{group.label}</p>
                      <span className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-xs text-slate-500">
                        {group.items.length}
                      </span>
                    </div>
                    {group.items.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {group.items.map((item) => (
                          <li
                            key={`${group.label}-${item}`}
                            className="rounded-2xl bg-white px-3 py-2"
                          >
                            {formatConsistencyItem(group.kind, item)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">暂无问题</p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {view === "yaml" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyYaml()}
                    className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDownloadYaml}
                    className="bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    下载
                  </Button>
                </div>
                <div
                  className={cn(
                    "rounded-[24px] border border-black/6 bg-slate-900 p-4",
                    detailCardEnterClass
                  )}
                  style={getDetailCardAnimationDelay(0)}
                >
                  <pre className="max-h-[560px] overflow-auto whitespace-pre font-mono text-sm leading-6 text-slate-100">
                    {liveYaml}
                  </pre>
                </div>
              </div>
            ) : null}

            {view === "structure" ? (
              <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                <div className="space-y-4 xl:sticky xl:top-28 xl:self-start">
                  <div
                    className={cn(
                      "h-[clamp(420px,calc(100vh-9rem),760px)] overflow-y-auto rounded-[24px] border border-black/6 bg-slate-50 p-3",
                      detailCardEnterClass
                    )}
                    style={getDetailCardAnimationDelay(0)}
                  >
                    <div className="space-y-1">
                      {semanticTree.map((node) => (
                        <TreeNode
                          key={node.id}
                          node={node}
                          selectedId={selectedNode?.id ?? null}
                          onSelect={(node) => setSelectedNodeId(node.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "rounded-[24px] border border-black/6 bg-slate-50 p-5",
                    detailCardEnterClass
                  )}
                  style={getDetailCardAnimationDelay(1)}
                >
                  {!editableDocument ? (
                    <div className="rounded-[20px] border border-dashed border-black/8 bg-white px-4 py-10 text-center text-sm text-slate-400">
                      当前结果暂时无法解析成语义结构，请先重新生成一次剧本。
                    </div>
                  ) : !selectedNode ? (
                    <div className="rounded-[20px] border border-dashed border-black/8 bg-white px-4 py-10 text-center text-sm text-slate-400">
                      选择左侧节点开始编辑。
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[20px] bg-white px-4 py-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            {selectedNode.kind === "chapter"
                              ? "章节编辑"
                              : selectedNode.kind === "scene"
                                ? "场景编辑"
                                : "节拍编辑"}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-slate-900">
                            {selectedNode.label}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            修改这里的可视化字段后，YAML 源码视图会实时同步更新。
                          </p>
                        </div>
                        <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-600">
                          子节点 {selectedNode.children.length}
                        </span>
                      </div>

                      {selectedNode.kind === "chapter" && selectedChapterData ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-slate-600">章节标题</Label>
                            <Input
                              value={selectedChapterData.title}
                              onChange={(event) =>
                                updateScriptChapter(selectedNode.chapterIndex, (chapter) => ({
                                  ...chapter,
                                  title: event.target.value,
                                }))
                              }
                              placeholder="请输入章节标题"
                              className={getFieldClassName(
                                `chapters[${selectedNode.chapterIndex}].title`,
                                "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                              )}
                            />
                            <ValidationMessage
                              message={getFieldError(`chapters[${selectedNode.chapterIndex}].title`)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-600">章节梗概</Label>
                            <textarea
                              value={selectedChapterData.summary}
                              onChange={(event) =>
                                updateScriptChapter(selectedNode.chapterIndex, (chapter) => ({
                                  ...chapter,
                                  summary: event.target.value,
                                }))
                              }
                              placeholder="概括这一章的主要推进"
                              className={getFieldClassName(
                                `chapters[${selectedNode.chapterIndex}].summary`,
                                "min-h-[180px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                              )}
                            />
                            <ValidationMessage
                              message={getFieldError(`chapters[${selectedNode.chapterIndex}].summary`)}
                            />
                          </div>
                        </div>
                      ) : null}

                      {selectedNode.kind === "scene" && selectedSceneData ? (
                        <div className="space-y-4">
                          <div className="rounded-[20px] border border-sky-100 bg-sky-50/70 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">AI 场景改写</p>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                  写下你希望这个场景怎么调整，系统会结合当前章节原文和这个场景的现有结构一起改写。结果会先进入当前编辑态，不会自动覆盖已保存版本。
                                </p>
                              </div>
                              <span className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs text-sky-600">
                                当前场景 {selectedSceneData.beats.length} 个节拍
                              </span>
                            </div>
                            <div className="mt-4 space-y-3">
                              <textarea
                                value={sceneRewriteInstruction}
                                onChange={(event) => setSceneRewriteInstruction(event.target.value)}
                                placeholder="例如：保留原文事实，不改结局，把冲突集中到沈砚与典当行老板之间，对白更克制一些。"
                                className="min-h-[120px] w-full rounded-[20px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                maxLength={300}
                              />
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs leading-5 text-slate-400">
                                  只描述这个场景要怎么改，不要要求改整章或整部作品。最多 300 字。
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isSceneRewriting}
                                  onClick={() => void handleRewriteScene()}
                                  className="rounded-full bg-slate-900 text-white hover:bg-slate-800"
                                >
                                  <Wand2 className="mr-2 h-4 w-4" />
                                  {isSceneRewriting ? "改写中..." : "按要求改写"}
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-slate-600">场景标题</Label>
                              <Input
                                value={selectedSceneData.title}
                                onChange={(event) =>
                                  updateScriptScene(
                                    selectedNode.chapterIndex,
                                    selectedNode.sceneIndex ?? 0,
                                    (scene) => ({ ...scene, title: event.target.value })
                                  )
                                }
                                placeholder="请输入场景标题"
                                className={getFieldClassName(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].title`,
                                  "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                )}
                              />
                              <ValidationMessage
                                message={getFieldError(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].title`
                                )}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-600">地点</Label>
                              <select
                                value={selectedSceneData.location}
                                onChange={(event) =>
                                  updateScriptScene(
                                    selectedNode.chapterIndex,
                                    selectedNode.sceneIndex ?? 0,
                                    (scene) => ({ ...scene, location: event.target.value })
                                  )
                                }
                                className={getFieldClassName(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].location`,
                                  "h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                )}
                              >
                                <option value="">请选择地点</option>
                                {currentLocationOptions.map((item) => (
                                  <option key={item} value={item}>
                                    {settingNames.includes(item) ? item : `${item}（未注册）`}
                                  </option>
                                ))}
                              </select>
                              <ValidationMessage
                                message={getFieldError(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].location`
                                )}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-600">时间</Label>
                              <Input
                                value={selectedSceneData.time}
                                onChange={(event) =>
                                  updateScriptScene(
                                    selectedNode.chapterIndex,
                                    selectedNode.sceneIndex ?? 0,
                                    (scene) => ({ ...scene, time: event.target.value })
                                  )
                                }
                                placeholder="如 Day / Night"
                                className={getFieldClassName(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].time`,
                                  "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                )}
                              />
                              <ValidationMessage
                                message={getFieldError(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].time`
                                )}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-600">视角角色</Label>
                              <select
                                value={selectedSceneData.pov}
                                onChange={(event) =>
                                  updateScriptScene(
                                    selectedNode.chapterIndex,
                                    selectedNode.sceneIndex ?? 0,
                                    (scene) => ({ ...scene, pov: event.target.value })
                                  )
                                }
                                className={getFieldClassName(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].pov`,
                                  "h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                )}
                              >
                                <option value="">请选择角色</option>
                                {currentPovOptions.map((item) => (
                                  <option key={item} value={item}>
                                    {characterNames.includes(item) ? item : `${item}（未注册）`}
                                  </option>
                                ))}
                              </select>
                              <ValidationMessage
                                message={getFieldError(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].pov`
                                )}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-600">场景目标</Label>
                            <textarea
                              value={selectedSceneData.goal}
                              onChange={(event) =>
                                updateScriptScene(
                                  selectedNode.chapterIndex,
                                  selectedNode.sceneIndex ?? 0,
                                  (scene) => ({ ...scene, goal: event.target.value })
                                )
                              }
                              placeholder="写下这一场景的推进目标"
                              className={getFieldClassName(
                                `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].goal`,
                                "min-h-[120px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                              )}
                            />
                            <ValidationMessage
                              message={getFieldError(
                                `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].goal`
                              )}
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-slate-600">氛围</Label>
                              <Input
                                value={selectedSceneData.mood}
                                onChange={(event) =>
                                  updateScriptScene(
                                    selectedNode.chapterIndex,
                                    selectedNode.sceneIndex ?? 0,
                                    (scene) => ({ ...scene, mood: event.target.value })
                                  )
                                }
                                placeholder="如 紧张 / 温暖"
                                className={getFieldClassName(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].mood`,
                                  "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                )}
                              />
                              <ValidationMessage
                                message={getFieldError(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].mood`
                                )}
                              />
                            </div>
                            <div className="rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-slate-500">
                              该场景共有 {selectedSceneData.beats.length} 个节拍。你可以直接拖拽下方卡片调整顺序，或点击左侧节拍节点编辑内容。
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-slate-600">节拍排序</Label>
                              <span className="text-xs text-slate-400">拖拽卡片可调整顺序</span>
                            </div>
                            <div className="space-y-3">
                              {selectedSceneData.beats.map((beat, beatIndex) => {
                                const beatNodeId = `beat-${beat.id}`
                                const active = selectedNodeId === beatNodeId
                                const isDragOver = dragOverBeatId === beat.id

                                return (
                                  <button
                                    key={beat.id}
                                    type="button"
                                    draggable
                                    onDragStart={() => setDraggedBeatId(beat.id)}
                                    onDragOver={(event) => {
                                      event.preventDefault()
                                      if (dragOverBeatId !== beat.id) {
                                        setDragOverBeatId(beat.id)
                                      }
                                    }}
                                    onDragEnd={() => {
                                      setDraggedBeatId(null)
                                      setDragOverBeatId(null)
                                    }}
                                    onDrop={(event) => {
                                      event.preventDefault()
                                      const fromIndex = selectedSceneData.beats.findIndex(
                                        (item) => item.id === draggedBeatId
                                      )
                                      if (fromIndex >= 0) {
                                        moveBeatInScene(
                                          selectedNode.chapterIndex,
                                          selectedNode.sceneIndex ?? 0,
                                          fromIndex,
                                          beatIndex
                                        )
                                      }
                                      setDraggedBeatId(null)
                                      setDragOverBeatId(null)
                                    }}
                                    onClick={() => setSelectedNodeId(beatNodeId)}
                                    className={cn(
                                      "flex w-full items-start gap-3 rounded-[20px] border bg-white px-4 py-4 text-left transition-all",
                                      active ? "border-sky-200 bg-sky-50/70" : "border-black/6 hover:bg-slate-50",
                                      isDragOver &&
                                        "border-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,0.25)]",
                                      draggedBeatId === beat.id && "opacity-60"
                                    )}
                                  >
                                    <div className="mt-0.5 flex items-center gap-3 text-slate-300">
                                      <GripVertical className="h-4 w-4" />
                                      <span className="text-xs font-medium text-slate-400">
                                        {beatIndex + 1}
                                      </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-black/8 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500">
                                          {getBeatTypeLabel(beat.type)}
                                        </span>
                                        <span className="text-sm font-medium text-slate-900">
                                          {beat.summary || `节拍 ${beatIndex + 1}`}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-sm leading-6 text-slate-500">
                                        {beat.dialogue?.speaker
                                          ? `${beat.dialogue.speaker}：${beat.dialogue.content || "待补充对白"}`
                                          : "动作 / 叙述类节拍，可点击进入编辑详情。"}
                                      </p>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-600">场景收尾</Label>
                            <textarea
                              value={selectedSceneData.outcome}
                              onChange={(event) =>
                                updateScriptScene(
                                  selectedNode.chapterIndex,
                                  selectedNode.sceneIndex ?? 0,
                                  (scene) => ({ ...scene, outcome: event.target.value })
                                )
                              }
                              placeholder="描述这一场的收尾结果或悬念"
                              className={getFieldClassName(
                                `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].outcome`,
                                "min-h-[120px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                              )}
                            />
                            <ValidationMessage
                              message={getFieldError(
                                `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].outcome`
                              )}
                            />
                          </div>
                        </div>
                      ) : null}

                      {selectedNode.kind === "beat" && selectedBeatData ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {BEAT_TYPE_OPTIONS.map((item) => (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() =>
                                  updateScriptBeat(
                                    selectedNode.chapterIndex,
                                    selectedNode.sceneIndex ?? 0,
                                    selectedNode.beatIndex ?? 0,
                                    (beat) => ({
                                      ...beat,
                                      type: item.value,
                                      dialogue:
                                        item.value === "dialogue" || item.value === "inner"
                                          ? beat.dialogue ?? { speaker: "", content: "" }
                                          : undefined,
                                    })
                                  )
                                }
                                className={cn(
                                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                  selectedBeatData.type === item.value
                                    ? "border-sky-200 bg-sky-50 text-sky-700"
                                    : "border-black/8 bg-white text-slate-500 hover:bg-slate-50"
                                )}
                                title={item.hint}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-600">节拍摘要</Label>
                            <Input
                              value={selectedBeatData.summary}
                              onChange={(event) =>
                                updateScriptBeat(
                                  selectedNode.chapterIndex,
                                  selectedNode.sceneIndex ?? 0,
                                  selectedNode.beatIndex ?? 0,
                                  (beat) => ({ ...beat, summary: event.target.value })
                                )
                              }
                              placeholder="概括这一拍发生了什么"
                              className={getFieldClassName(
                                `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].summary`,
                                "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                              )}
                            />
                            <ValidationMessage
                              message={getFieldError(
                                `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].summary`
                              )}
                            />
                          </div>
                          {selectedBeatData.type === "dialogue" || selectedBeatData.type === "inner" ? (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label className="text-slate-600">角色名</Label>
                                <select
                                  value={selectedBeatData.dialogue?.speaker ?? ""}
                                  onChange={(event) =>
                                    updateScriptBeat(
                                      selectedNode.chapterIndex,
                                      selectedNode.sceneIndex ?? 0,
                                      selectedNode.beatIndex ?? 0,
                                      (beat) => ({
                                        ...beat,
                                        dialogue: {
                                          speaker: event.target.value,
                                          content: beat.dialogue?.content ?? "",
                                        },
                                      })
                                    )
                                  }
                                  className={getFieldClassName(
                                    `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].dialogue.speaker`,
                                    "h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                  )}
                                >
                                  <option value="">请选择角色</option>
                                  {currentSpeakerOptions.map((item) => (
                                    <option key={item} value={item}>
                                      {characterNames.includes(item) ? item : `${item}（未注册）`}
                                    </option>
                                  ))}
                                </select>
                                <ValidationMessage
                                  message={getFieldError(
                                    `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].dialogue.speaker`
                                  )}
                                />
                              </div>
                              <div className="rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-slate-500">
                                这里修改角色名后，源码视图中的 `dialogue.speaker` 会实时同步。
                              </div>
                            </div>
                          ) : null}
                          {selectedBeatData.type === "dialogue" || selectedBeatData.type === "inner" ? (
                            <div className="space-y-2">
                              <Label className="text-slate-600">对白内容</Label>
                              <textarea
                                value={selectedBeatData.dialogue?.content ?? ""}
                                onChange={(event) =>
                                  updateScriptBeat(
                                    selectedNode.chapterIndex,
                                    selectedNode.sceneIndex ?? 0,
                                    selectedNode.beatIndex ?? 0,
                                    (beat) => ({
                                      ...beat,
                                      dialogue: {
                                        speaker: beat.dialogue?.speaker ?? "",
                                        content: event.target.value,
                                      },
                                    })
                                  )
                                }
                                placeholder="请输入对白或内心独白"
                                className={getFieldClassName(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].dialogue.content`,
                                  "min-h-[160px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                )}
                              />
                              <ValidationMessage
                                message={getFieldError(
                                  `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].dialogue.content`
                                )}
                              />
                            </div>
                          ) : (
                            <div className="rounded-[20px] border border-dashed border-black/8 bg-white px-4 py-6 text-sm text-slate-400">
                              当前节拍类型无需对白字段，你可以继续编辑节拍摘要，或切换成 dialogue / inner 类型。
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </ScriptDetailHeader>

        </>
      )}
    </div>
  )
}
