import { GripVertical, Wand2 } from "lucide-react"
import { TreeNode } from "@/components/script-workshop/tree-node"
import { ValidationMessage } from "@/components/script-workshop/validation-message"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BEAT_TYPE_OPTIONS, getBeatTypeLabel } from "@/lib/script-workshop"
import { cn } from "@/lib/utils"
import type { DetailViewProps } from "./detail-view-types"
import { detailCardEnterClass, getDetailCardAnimationDelay } from "./detail-view-utils"

type StructurePanelProps = Pick<
  DetailViewProps,
  | "semanticTree"
  | "selectedNode"
  | "selectedNodeId"
  | "setSelectedNodeId"
  | "editableDocument"
  | "selectedChapterData"
  | "selectedSceneData"
  | "selectedBeatData"
  | "updateScriptChapter"
  | "updateScriptScene"
  | "updateScriptBeat"
  | "moveBeatInScene"
  | "draggedBeatId"
  | "setDraggedBeatId"
  | "dragOverBeatId"
  | "setDragOverBeatId"
  | "getFieldClassName"
  | "getFieldError"
  | "characterNames"
  | "settingNames"
  | "currentPovOptions"
  | "currentLocationOptions"
  | "currentSpeakerOptions"
  | "sceneRewriteInstruction"
  | "setSceneRewriteInstruction"
  | "isSceneRewriting"
  | "handleRewriteScene"
>

export function StructurePanel({
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
  characterNames,
  settingNames,
  currentPovOptions,
  currentLocationOptions,
  currentSpeakerOptions,
  sceneRewriteInstruction,
  setSceneRewriteInstruction,
  isSceneRewriting,
  handleRewriteScene,
}: StructurePanelProps) {
  return (
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
                onSelect={(currentNode) => setSelectedNodeId(currentNode.id)}
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
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{selectedNode.label}</h3>
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
                        updateScriptScene(selectedNode.chapterIndex, selectedNode.sceneIndex ?? 0, (scene) => ({
                          ...scene,
                          title: event.target.value,
                        }))
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
                        updateScriptScene(selectedNode.chapterIndex, selectedNode.sceneIndex ?? 0, (scene) => ({
                          ...scene,
                          location: event.target.value,
                        }))
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
                        updateScriptScene(selectedNode.chapterIndex, selectedNode.sceneIndex ?? 0, (scene) => ({
                          ...scene,
                          time: event.target.value,
                        }))
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
                        updateScriptScene(selectedNode.chapterIndex, selectedNode.sceneIndex ?? 0, (scene) => ({
                          ...scene,
                          pov: event.target.value,
                        }))
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
                      updateScriptScene(selectedNode.chapterIndex, selectedNode.sceneIndex ?? 0, (scene) => ({
                        ...scene,
                        goal: event.target.value,
                      }))
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
                        updateScriptScene(selectedNode.chapterIndex, selectedNode.sceneIndex ?? 0, (scene) => ({
                          ...scene,
                          mood: event.target.value,
                        }))
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
                      updateScriptScene(selectedNode.chapterIndex, selectedNode.sceneIndex ?? 0, (scene) => ({
                        ...scene,
                        outcome: event.target.value,
                      }))
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
  )
}
