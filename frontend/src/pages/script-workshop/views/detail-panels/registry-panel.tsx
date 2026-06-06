import { Trash2 } from "lucide-react"
import { SegmentedToolbar } from "@/components/script-workshop/segmented-toolbar"
import { ValidationMessage } from "@/components/script-workshop/validation-message"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RegistryTab } from "@/lib/script-workshop"
import { cn } from "@/lib/utils"
import type { DetailViewProps } from "./detail-view-types"
import {
  detailCardEnterClass,
  formatInlineList,
  getDetailCardAnimationDelay,
  parseInlineList,
} from "./detail-view-utils"

type RegistryPanelProps = Pick<
  DetailViewProps,
  | "editableDocument"
  | "setRegistryTab"
  | "registryView"
  | "activeRegistryIndex"
  | "setSelectedCharacterIndex"
  | "setSelectedSettingIndex"
  | "selectedCharacter"
  | "selectedSetting"
  | "addCharacter"
  | "addSetting"
  | "deleteCharacter"
  | "deleteSetting"
  | "updateScriptCharacter"
  | "updateScriptSetting"
  | "characterRenameOriginRef"
  | "settingRenameOriginRef"
  | "requestRenameConfirm"
  | "getFieldClassName"
  | "getFieldError"
>

export function RegistryPanel({
  editableDocument,
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
  getFieldClassName,
  getFieldError,
}: RegistryPanelProps) {
  if (!editableDocument) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-12 text-center text-sm text-slate-400">
        当前结果暂时无法编辑人物表和地点表。
      </div>
    )
  }

  return (
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
                          characterRenameOriginRef.current[activeRegistryIndex] ?? selectedCharacter.name
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
                        const normalized = formatInlineList(parseInlineList(event.target.value))
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
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">地点编辑</p>
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
                    const normalized = formatInlineList(parseInlineList(event.target.value))
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
}
