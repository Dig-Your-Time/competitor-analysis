import { createContext, useContext } from 'react'

// lets any view trigger the "edit our game" slide-over without prop drilling
export const EditorCtx = createContext(() => {})
export const useEditor = () => useContext(EditorCtx)

// small pencil affordance shown next to our own game wherever it appears
export function EditOurGame({ className = '' }) {
  const openEditor = useEditor()
  return (
    <button
      className={'editcue ' + className}
      title="Edit our game (in-session what-if)"
      onClick={(e) => { e.stopPropagation(); openEditor() }}
    >
      ✎
    </button>
  )
}
