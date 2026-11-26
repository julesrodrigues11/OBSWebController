/**
 * State shared across the Scenes panel: which forms, confirmations and editors are open.
 * It lives in ScenesPanel (one of each at a time across the whole panel) and is passed down.
 */
export interface ScenesPanelState {
  /** Scene whose "add source" form is open. */
  adding: string | null
  setAdding: (scene: string | null) => void
  /** Scene whose name is being edited. */
  renaming: string | null
  setRenaming: (scene: string | null) => void
  /** Called when a rename finishes (newName null = cancelled). */
  finishRename: (oldName: string, newName: string | null) => void
  /** Open delete confirmation: `scene:<name>` or `item:<itemKey>`. */
  confirming: string | null
  setConfirming: (key: string | null) => void
  /** Items whose transform editor is open (itemKey). */
  openEditors: Set<string>
  toggleEditor: (key: string) => void
}
