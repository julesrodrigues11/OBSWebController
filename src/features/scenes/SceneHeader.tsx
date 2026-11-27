import { ChevronIcon, ListIcon, MonitorIcon, PencilIcon, PlusIcon, TrashIcon } from '../../components/icons'
import { useConnection, type SceneInfo } from '../../store/connection'
import { useProtection } from '../../store/live'
import { useScenePreview } from '../../store/scenePreview'
import { useScenes } from '../../store/scenes'
import { useUi } from '../../store/ui'
import type { ScenesPanelState } from './panelState'
import { RenameField } from './RenameField'

interface Props {
  scene: SceneInfo
  open: boolean
  live: boolean
  onToggle: () => void
  ui: ScenesPanelState
}

/** A scene's header row: name (or rename field), count, rename, add, show-in-Sources, delete, Go live. */
export function SceneHeader({ scene, open, live, onToggle, ui }: Props) {
  const name = scene.sceneName
  const sceneCount = useConnection((s) => s.scenes.length)
  const goLive = useConnection((s) => s.goLive)
  const itemCount = useScenes((s) => s.items[name]?.length ?? 0)
  const scope = useUi((s) => s.scope)
  const setScope = useUi((s) => s.setScope)
  const previewing = useScenePreview((s) => s.open && s.scene === name)
  const showPreview = useScenePreview((s) => s.show)
  const { on: showMode, sceneLocked } = useProtection()
  const locked = sceneLocked(name) // show mode: this is the live scene, or nested in it
  const renaming = ui.renaming === name && !locked
  const canDelete = !live && !locked && sceneCount > 1
  const lockedTitle = 'Show mode: this scene is on air and protected'

  return (
    <div className="scene__head">
      {renaming ? (
        <div className="scene__toggle scene__toggle--editing">
          <ChevronIcon open={open} />
          <RenameField name={name} onDone={(n) => ui.finishRename(name, n)} />
        </div>
      ) : (
        <button
          className="scene__toggle"
          onClick={onToggle}
          onDoubleClick={(e) => { e.preventDefault(); if (!locked) ui.setRenaming(name) }}
          aria-expanded={open}
          title="Click to collapse/expand · double-click to rename"
        >
          <ChevronIcon open={open} />
          <span className="scene__name">{name}</span>
          <span className="muted scene__count">{itemCount}</span>
        </button>
      )}
      <button
        className={`icon-button ${renaming ? 'is-active' : 'is-off'}`}
        onClick={() => ui.setRenaming(renaming ? null : name)}
        disabled={locked}
        title={locked ? lockedTitle : 'Rename this scene'}
      >
        <PencilIcon />
      </button>
      <button
        className={`icon-button ${ui.adding === name ? 'is-active' : 'is-off'}`}
        onClick={() => ui.setAdding(ui.adding === name ? null : name)}
        disabled={locked}
        title={locked ? lockedTitle : 'Add a source to this scene'}
      >
        <PlusIcon />
      </button>
      <button
        className={`icon-button ${previewing ? 'is-active' : 'is-off'}`}
        onClick={() => showPreview(name)}
        title="Preview this scene (without putting it on air)"
      >
        <MonitorIcon />
      </button>
      <button
        className={`icon-button ${scope.mode === 'scene' && scope.scene === name ? 'is-active' : 'is-off'}`}
        onClick={() => setScope({ mode: 'scene', scene: name })}
        title="Show only this scene's sources in the Sources panel"
      >
        <ListIcon />
      </button>
      <button
        className="icon-button icon-button--danger is-off"
        onClick={() => ui.setConfirming(`scene:${name}`)}
        disabled={!canDelete}
        title={live ? 'This scene is live: switch to another scene before deleting it' : locked ? lockedTitle : sceneCount <= 1 ? 'OBS needs at least one scene' : 'Delete this scene'}
      >
        <TrashIcon />
      </button>
      {live ? (
        <span className="badge badge--live">LIVE</span>
      ) : (
        <button
          className="button--golive"
          // In show mode, switching scenes asks first (see SceneSection).
          onClick={() => (showMode ? ui.setConfirming(`golive:${name}`) : void goLive(name))}
          title="Switch the live (Program) scene to this one"
        >
          Go live
        </button>
      )}
    </div>
  )
}
