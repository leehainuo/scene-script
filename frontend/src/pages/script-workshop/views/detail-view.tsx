import { ScriptDetailHeader } from "@/pages/script-workshop/components/detail-header"
import { EmptyDetailState } from "./detail-panels/empty-detail-state"
import { SummaryPanel } from "./detail-panels/summary-panel"
import { RegistryPanel } from "./detail-panels/registry-panel"
import { ConsistencyPanel } from "./detail-panels/consistency-panel"
import { YamlPanel } from "./detail-panels/yaml-panel"
import { StructurePanel } from "./detail-panels/structure-panel"
import type { DetailViewProps } from "./detail-panels/detail-view-types"

export function DetailView(props: DetailViewProps) {
  const {
    activeResult,
    activeTaskMeta,
    activeStatus,
    taskProgressMessage,
    hasUnsavedChanges,
    view,
    setView,
    summary,
    consistency,
    editableDocument,
  } = props

  return (
    <div className="mx-auto max-w-[1040px] space-y-6">
      {!activeResult ? (
        <EmptyDetailState
          activeTaskMeta={activeTaskMeta}
          activeStatus={activeStatus}
          taskProgressMessage={taskProgressMessage}
        />
      ) : (
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
            <SummaryPanel
              activeResult={activeResult}
              summary={summary}
              consistency={consistency}
            />
          ) : null}

          {view === "registry" ? (
            <RegistryPanel
              editableDocument={props.editableDocument}
              setRegistryTab={props.setRegistryTab}
              registryView={props.registryView}
              activeRegistryIndex={props.activeRegistryIndex}
              setSelectedCharacterIndex={props.setSelectedCharacterIndex}
              setSelectedSettingIndex={props.setSelectedSettingIndex}
              selectedCharacter={props.selectedCharacter}
              selectedSetting={props.selectedSetting}
              addCharacter={props.addCharacter}
              addSetting={props.addSetting}
              deleteCharacter={props.deleteCharacter}
              deleteSetting={props.deleteSetting}
              updateScriptCharacter={props.updateScriptCharacter}
              updateScriptSetting={props.updateScriptSetting}
              characterRenameOriginRef={props.characterRenameOriginRef}
              settingRenameOriginRef={props.settingRenameOriginRef}
              requestRenameConfirm={props.requestRenameConfirm}
              getFieldClassName={props.getFieldClassName}
              getFieldError={props.getFieldError}
            />
          ) : null}

          {view === "consistency" ? (
            <ConsistencyPanel consistency={consistency} />
          ) : null}

          {view === "yaml" ? (
            <YamlPanel
              liveYaml={props.liveYaml}
              handleCopyYaml={props.handleCopyYaml}
              handleDownloadYaml={props.handleDownloadYaml}
            />
          ) : null}

          {view === "structure" ? (
            <StructurePanel
              semanticTree={props.semanticTree}
              selectedNode={props.selectedNode}
              selectedNodeId={props.selectedNodeId}
              setSelectedNodeId={props.setSelectedNodeId}
              editableDocument={props.editableDocument}
              selectedChapterData={props.selectedChapterData}
              selectedSceneData={props.selectedSceneData}
              selectedBeatData={props.selectedBeatData}
              updateScriptChapter={props.updateScriptChapter}
              updateScriptScene={props.updateScriptScene}
              updateScriptBeat={props.updateScriptBeat}
              moveBeatInScene={props.moveBeatInScene}
              draggedBeatId={props.draggedBeatId}
              setDraggedBeatId={props.setDraggedBeatId}
              dragOverBeatId={props.dragOverBeatId}
              setDragOverBeatId={props.setDragOverBeatId}
              getFieldClassName={props.getFieldClassName}
              getFieldError={props.getFieldError}
              characterNames={props.characterNames}
              settingNames={props.settingNames}
              currentPovOptions={props.currentPovOptions}
              currentLocationOptions={props.currentLocationOptions}
              currentSpeakerOptions={props.currentSpeakerOptions}
              sceneRewriteInstruction={props.sceneRewriteInstruction}
              setSceneRewriteInstruction={props.setSceneRewriteInstruction}
              isSceneRewriting={props.isSceneRewriting}
              handleRewriteScene={props.handleRewriteScene}
            />
          ) : null}
        </ScriptDetailHeader>
      )}
    </div>
  )
}
