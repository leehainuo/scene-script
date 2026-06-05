import type { Dispatch, RefObject, SetStateAction } from "react"
import { Copy, Download, GripVertical, Trash2 } from "lucide-react"
import { ConsistencyPanel } from "@/components/script-workshop/consistency-panel"
import { ScriptDetailHeader } from "@/components/script-workshop/detail-header"
import { TreeNode } from "@/components/script-workshop/tree-node"
import { ValidationMessage } from "@/components/script-workshop/validation-message"
import { StudioPanel } from "@/components/studio/studio-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatScriptStyleSummary, getPacingLabel } from "@/lib/script-display"
import { formatDateTime } from "@/lib/script-workshop"
import type { RegistryTab, ResultView, ScriptTreeNode, WorkshopResult } from "@/lib/script-workshop"
import { cn } from "@/lib/utils"
import type { ScriptBeat, ScriptChapter, ScriptScene, ScriptTaskMeta, ScriptYamlDocument } from "@/types"

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
  wrapYaml: boolean
  setWrapYaml: Dispatch<SetStateAction<boolean>>
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
  wrapYaml,
  setWrapYaml,
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
          >
            {view === "overview" ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    { label: "章节", value: summary.chapters },
                    { label: "场景", value: summary.scenes },
                    { label: "节拍", value: summary.beats },
                    { label: "角色", value: summary.characters },
                    { label: "地点", value: summary.settings },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[22px] border border-black/6 bg-slate-50 px-4 py-4">
                      <p className="text-xs text-slate-400">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
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
                  <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
                    <p className="text-xs text-slate-400">一致性质检</p>
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
            ) : null}

            {view === "yaml" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWrapYaml((value) => !value)}
                    className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    {wrapYaml ? "关闭换行" : "自动换行"}
                  </Button>
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
                <div className="rounded-[24px] border border-black/6 bg-slate-900 p-4">
                  <pre
                    className={cn(
                      "max-h-[560px] overflow-auto font-mono text-sm leading-6 text-slate-100",
                      wrapYaml ? "whitespace-pre-wrap wrap-break-word" : "whitespace-pre"
                    )}
                  >
                    {liveYaml}
                  </pre>
                </div>
              </div>
            ) : null}

            {view === "structure" ? (
              <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="max-h-[560px] overflow-y-auto rounded-[24px] border border-black/6 bg-slate-50 p-3">
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

                <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
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
                                          {beat.type}
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
                            {(["action", "dialogue", "inner", "exposition"] as const).map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() =>
                                  updateScriptBeat(
                                    selectedNode.chapterIndex,
                                    selectedNode.sceneIndex ?? 0,
                                    selectedNode.beatIndex ?? 0,
                                    (beat) => ({
                                      ...beat,
                                      type,
                                      dialogue:
                                        type === "dialogue" || type === "inner"
                                          ? beat.dialogue ?? { speaker: "", content: "" }
                                          : undefined,
                                    })
                                  )
                                }
                                className={cn(
                                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                  selectedBeatData.type === type
                                    ? "border-sky-200 bg-sky-50 text-sky-700"
                                    : "border-black/8 bg-white text-slate-500 hover:bg-slate-50"
                                )}
                              >
                                {type}
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

          <StudioPanel
            eyebrow="Registry"
            title="人物表与地点表"
            description="在这里维护全剧角色和地点注册表；改名时会自动同步场景视角、对白说话人和场景地点引用。"
            animateOnMount
            animationDelayMs={80}
            className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
          >
            {!editableDocument ? (
              <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-12 text-center text-sm text-slate-400">
                当前结果暂时无法编辑人物表和地点表。
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-black/6 bg-slate-50 p-1">
                    {([
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
                    ] as const).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setRegistryTab(item.key)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
                          registryView === item.key
                            ? "bg-slate-900 text-white"
                            : "text-slate-500 hover:bg-white hover:text-slate-900"
                        )}
                      >
                        <span>{item.label}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            registryView === item.key ? "bg-white/15 text-white" : "bg-white text-slate-400"
                          )}
                        >
                          {item.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={registryView === "characters" ? addCharacter : addSetting}
                    className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    {registryView === "characters" ? "新增角色" : "新增地点"}
                  </Button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="rounded-[24px] border border-black/6 bg-slate-50 p-3">
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

                  <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
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
                                  characterRenameOriginRef.current[activeRegistryIndex] = selectedCharacter.name
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
                                  requestRenameConfirm("characters", previousName, event.target.value)
                                  delete characterRenameOriginRef.current[activeRegistryIndex]
                                }}
                                placeholder="请输入角色名"
                                className={getFieldClassName(
                                  `dramatis_personae[${activeRegistryIndex}].name`,
                                  "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                )}
                              />
                              <ValidationMessage
                                message={getFieldError(`dramatis_personae[${activeRegistryIndex}].name`)}
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
                                message={getFieldError(`dramatis_personae[${activeRegistryIndex}].archetype`)}
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
                              message={getFieldError(`dramatis_personae[${activeRegistryIndex}].motivation`)}
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-slate-600">性格标签</Label>
                              <Input
                                value={selectedCharacter.traits.join("，")}
                                onChange={(event) =>
                                  updateScriptCharacter(activeRegistryIndex, (item) => ({
                                    ...item,
                                    traits: event.target.value
                                      .split(/[,，]/)
                                      .map((value) => value.trim())
                                      .filter(Boolean),
                                  }))
                                }
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
                                settingRenameOriginRef.current[activeRegistryIndex] = selectedSetting.name
                              }}
                              onChange={(event) =>
                                updateScriptSetting(activeRegistryIndex, (item) => ({
                                  ...item,
                                  name: event.target.value,
                                }))
                              }
                              onBlur={(event) => {
                                const previousName =
                                  settingRenameOriginRef.current[activeRegistryIndex] ?? selectedSetting.name
                                requestRenameConfirm("settings", previousName, event.target.value)
                                delete settingRenameOriginRef.current[activeRegistryIndex]
                              }}
                              placeholder="请输入地点名"
                              className={getFieldClassName(
                                `settings[${activeRegistryIndex}].name`,
                                "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                              )}
                            />
                            <ValidationMessage message={getFieldError(`settings[${activeRegistryIndex}].name`)} />
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
                            value={(selectedSetting.aliases ?? []).join("，")}
                            onChange={(event) =>
                              updateScriptSetting(activeRegistryIndex, (item) => ({
                                ...item,
                                aliases: event.target.value
                                  .split(/[,，]/)
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              }))
                            }
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
            )}
          </StudioPanel>

          <ConsistencyPanel consistency={consistency} />
        </>
      )}
    </div>
  )
}
