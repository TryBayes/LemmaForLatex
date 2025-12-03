import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import {
  EditorState,
  StateField,
  StateEffect,
  Range,
} from '@codemirror/state'

export interface AiPendingEdit {
  id: string
  docId: string
  oldContent: string
  newContent: string
  startLine: number
  onAccept: () => void
  onReject: () => void
}

export const setPendingEditsEffect = StateEffect.define<AiPendingEdit[]>()
export const clearPendingEditsEffect = StateEffect.define<void>()

const aiDiffTheme = EditorView.baseTheme({
  '.ol-cm-ai-insert-line': {
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
    borderLeft: '4px solid #2ea043',
    marginLeft: '-4px',
    paddingLeft: '8px',
    pointerEvents: 'none',
  },
  '.ol-cm-ai-actions-block': {
    marginLeft: '-4px',
    padding: '8px',
    backgroundColor: 'rgba(46, 160, 67, 0.1)',
    borderLeft: '4px solid #2ea043',
    display: 'flex',
    gap: '8px',
    marginBottom: '4px',
    pointerEvents: 'auto',
  },
  '.ol-cm-ai-action-btn': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.15s ease',
    gap: '6px',
    lineHeight: '1.4',
  },
  '.ol-cm-ai-accept-btn': {
    backgroundColor: '#238636',
    color: '#ffffff',
  },
  '.ol-cm-ai-reject-btn': {
    backgroundColor: '#d73a49',
    color: '#ffffff',
  },
})

class AiActionsWidget extends WidgetType {
  constructor(private edit: AiPendingEdit) { super() }
  eq(other: AiActionsWidget): boolean { return this.edit.id === other.edit.id }
  toDOM(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'ol-cm-ai-actions-block'
    const acceptBtn = document.createElement('button')
    acceptBtn.className = 'ol-cm-ai-action-btn ol-cm-ai-accept-btn'
    acceptBtn.innerHTML = '✓ Accept'
    acceptBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.edit.onAccept() }
    const rejectBtn = document.createElement('button')
    rejectBtn.className = 'ol-cm-ai-action-btn ol-cm-ai-reject-btn'
    rejectBtn.innerHTML = '✗ Reject'
    rejectBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.edit.onReject() }
    container.appendChild(acceptBtn)
    container.appendChild(rejectBtn)
    return container
  }
  ignoreEvent(): boolean { return false }
}

class DeleteMarkerWidget extends WidgetType {
  constructor(private deletedText: string) { super() }
  eq(other: DeleteMarkerWidget): boolean { return this.deletedText === other.deletedText }
  toDOM(): HTMLElement {
    const container = document.createElement('span')
    container.className = 'ol-cm-ai-deleted-content'
    const deletedSpan = document.createElement('span')
    deletedSpan.className = 'ol-cm-ai-deleted-text'
    const lines = this.deletedText.split('\n')
    const displayText = lines.length === 1 ? this.deletedText : lines[0] + ' (+' + (lines.length - 1) + ' more lines)'
    deletedSpan.textContent = displayText.length > 60 ? displayText.substring(0, 60) + '...' : displayText
    deletedSpan.title = 'Deleted:\n' + this.deletedText
    container.appendChild(deletedSpan)
    return container
  }
}

const pendingEditsField = StateField.define<AiPendingEdit[]>({
  create() { return [] },
  update(edits, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setPendingEditsEffect)) return effect.value
      if (effect.is(clearPendingEditsEffect)) return []
    }
    return edits
  },
})

function computeLineDiff(oldContent: string, newContent: string) {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  let startSame = 0
  while (startSame < oldLines.length && startSame < newLines.length && oldLines[startSame] === newLines[startSame]) startSame++
  let endSameOld = oldLines.length, endSameNew = newLines.length
  while (endSameOld > startSame && endSameNew > startSame && oldLines[endSameOld - 1] === newLines[endSameNew - 1]) { endSameOld--; endSameNew-- }
  const insertedLines: number[] = []
  for (let i = startSame; i < endSameNew; i++) insertedLines.push(i)
  const deletedLineContent: string[] = []
  for (let i = startSame; i < endSameOld; i++) deletedLineContent.push(oldLines[i])
  const deletedLines: { afterLine: number; lines: string[] }[] = []
  if (deletedLineContent.length > 0) deletedLines.push({ afterLine: startSame - 1, lines: deletedLineContent })
  return { insertedLines, deletedLines, firstChangeLine: startSame }
}

function buildDiffDecorations(state: EditorState, edits: AiPendingEdit[]): DecorationSet {
  const decorations: Range<Decoration>[] = []
  for (const edit of edits) {
    const diff = computeLineDiff(edit.oldContent, edit.newContent)
    for (const lineIdx of diff.insertedLines) {
      const lineNum = lineIdx + 1
      if (lineNum <= state.doc.lines) {
        const line = state.doc.line(lineNum)
        decorations.push(Decoration.line({ class: 'ol-cm-ai-insert-line' }).range(line.from))
      }
    }
    for (const deleted of diff.deletedLines) {
      const afterLineNum = deleted.afterLine + 1
      if (afterLineNum >= 1 && afterLineNum <= state.doc.lines) {
        const line = state.doc.line(afterLineNum)
        decorations.push(Decoration.widget({ widget: new DeleteMarkerWidget(deleted.lines.join('\n')), side: 1, block: true }).range(line.to))
      }
    }
    const firstInsertedLine = diff.insertedLines[0]
    if (firstInsertedLine !== undefined) {
      const lineNum = diff.insertedLines[diff.insertedLines.length - 1] + 1
      if (lineNum <= state.doc.lines) {
        const line = state.doc.line(lineNum)
        decorations.push(Decoration.widget({ widget: new AiActionsWidget(edit), side: 1, block: true }).range(line.to))
      }
    } else if (diff.firstChangeLine < state.doc.lines) {
      const lineNum = Math.max(1, diff.firstChangeLine)
      const line = state.doc.line(lineNum)
      decorations.push(Decoration.widget({ widget: new AiActionsWidget(edit), side: 1, block: true }).range(line.to))
    }
  }
  decorations.sort((a, b) => a.from - b.from)
  return Decoration.set(decorations, true)
}

const diffDecorationsField = StateField.define<DecorationSet>({
  create(state) { return buildDiffDecorations(state, state.field(pendingEditsField)) },
  update(decorations, tr) {
    if (tr.docChanged || tr.state.field(pendingEditsField) !== tr.startState.field(pendingEditsField)) {
      return buildDiffDecorations(tr.state, tr.state.field(pendingEditsField))
    }
    return decorations.map(tr.changes)
  },
  provide: f => EditorView.decorations.from(f)
})

const preventUserEditingPendingLines = EditorState.transactionFilter.of((tr) => {
  const edits = tr.startState.field(pendingEditsField)
  if (edits.length === 0) return tr
  if (tr.isUserEvent('ai.edit') || tr.isUserEvent('ai.revert')) return tr
  const protectedRanges: { from: number; to: number }[] = []
  for (const edit of edits) {
    const diff = computeLineDiff(edit.oldContent, edit.newContent)
    let minLine = Infinity, maxLine = 0
    for (const lineIdx of diff.insertedLines) {
      const lineNum = lineIdx + 1
      if (lineNum < minLine) minLine = lineNum
      if (lineNum > maxLine) maxLine = lineNum
    }
    if (minLine !== Infinity && maxLine > 0) {
      const startLine = Math.max(1, minLine - 1)
      if (startLine <= tr.startState.doc.lines && maxLine <= tr.startState.doc.lines) {
        protectedRanges.push({ from: tr.startState.doc.line(startLine).from, to: tr.startState.doc.line(maxLine).to })
      }
    }
  }
  if (protectedRanges.length === 0) return tr
  if (tr.docChanged && (tr.isUserEvent('input') || tr.isUserEvent('delete') || tr.isUserEvent('undo') || tr.isUserEvent('redo'))) {
    let blocked = false
    tr.changes.iterChanges((fromA, toA) => {
      for (const range of protectedRanges) if (fromA <= range.to && toA >= range.from) blocked = true
    })
    if (blocked) return []
  }
  return tr
})

const preventClickOnProtectedLines = EditorView.domEventHandlers({
  mousedown(event, view) {
    const edits = view.state.field(pendingEditsField)
    if (edits.length === 0) return false
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return false
    for (const edit of edits) {
      const diff = computeLineDiff(edit.oldContent, edit.newContent)
      for (const lineIdx of diff.insertedLines) {
        const lineNum = lineIdx + 1
        if (lineNum <= view.state.doc.lines) {
          const line = view.state.doc.line(lineNum)
          if (pos >= line.from && pos <= line.to) { event.preventDefault(); return true }
        }
      }
    }
    return false
  }
})

export function aiDiff() {
  return [pendingEditsField, diffDecorationsField, aiDiffTheme, preventUserEditingPendingLines, preventClickOnProtectedLines]
}

export function updatePendingEdits(view: EditorView, edits: AiPendingEdit[]) {
  view.dispatch({ effects: setPendingEditsEffect.of(edits) })
}

export function clearPendingEdits(view: EditorView) {
  view.dispatch({ effects: clearPendingEditsEffect.of(undefined) })
}

export default aiDiff
