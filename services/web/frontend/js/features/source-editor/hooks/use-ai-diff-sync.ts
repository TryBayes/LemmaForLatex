import { useEffect, useContext } from 'react'
import { CodeMirrorViewContext } from '../components/codemirror-context'
import { usePendingEditsContextOptional } from '@/features/ai-assistant/context/pending-edits-context'
import { 
  setPendingEditsEffect, 
  clearPendingEditsEffect,
  AiPendingEdit 
} from '../extensions/ai-diff'

/**
 * Hook that synchronizes pending AI edits from React context
 * to the CodeMirror editor's AI diff extension.
 * 
 * When pending edits change in the context, this hook:
 * 1. Dispatches effects to update decorations
 * 2. Applies/Reverts content changes locally so undo/redo works
 */
export function useAiDiffSync() {
  const view = useContext(CodeMirrorViewContext)
  const pendingEditsContext = usePendingEditsContextOptional()

  useEffect(() => {
    if (!view || !pendingEditsContext) {
      return
    }

    const { 
      allEdits, 
      pendingEdits, 
      acceptEdit, 
      rejectEdit,
      markAsSynced 
    } = pendingEditsContext

    // 1. Handle Content Changes (Apply/Revert)
    // We check 'allEdits' to catch both new pending edits (to apply)
    // and recently rejected edits (to revert)
    allEdits.forEach(edit => {
      // Case A: New pending edit that hasn't been synced (applied) yet
      if (edit.status === 'pending' && !edit.synced) {
        const currentContent = view.state.doc.toString()
        // Only apply if content matches expectation to avoid conflicts
        if (currentContent.includes(edit.oldContent)) {
          const transaction = view.state.update({
            changes: {
              from: 0, 
              to: view.state.doc.length,
              insert: currentContent.replace(edit.oldContent, edit.newContent)
            },
            // Add to history so user can Undo
            userEvent: 'ai.edit' 
          })
          view.dispatch(transaction)
          markAsSynced(edit.id)
        }
      }
      
      // Case B: Rejected edit that needs to be reverted (and hasn't been synced yet)
      // When rejectEdit is called, it sets status='rejected' and synced=false
      if (edit.status === 'rejected' && !edit.synced) {
        const currentContent = view.state.doc.toString()
        // Only revert if content matches the "new" content (what we changed it to)
        if (currentContent.includes(edit.newContent)) {
          const transaction = view.state.update({
            changes: {
              from: 0, 
              to: view.state.doc.length,
              insert: currentContent.replace(edit.newContent, edit.oldContent)
            },
            // Add to history
            userEvent: 'ai.revert'
          })
          view.dispatch(transaction)
          markAsSynced(edit.id)
        }
      }
    })

    // 2. Update Decorations (only for currently pending edits)
    const cmEdits: AiPendingEdit[] = pendingEdits.map(edit => ({
      id: edit.id,
      docId: edit.docId,
      oldContent: edit.oldContent,
      newContent: edit.newContent,
      startLine: edit.startLine,
      onAccept: () => acceptEdit(edit.id),
      onReject: () => rejectEdit(edit.id),
    }))

    if (cmEdits.length > 0) {
      view.dispatch({
        effects: setPendingEditsEffect.of(cmEdits),
      })
    } else {
      view.dispatch({
        effects: clearPendingEditsEffect.of(undefined),
      })
    }
  }, [view, pendingEditsContext])
}

export default useAiDiffSync
