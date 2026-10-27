import { useEffect, type RefObject } from 'react'

// Ctrl/Cmd + K để focus vào ô input được truyền vào
export function useFocusShortcut(
  inputRef: RefObject<HTMLInputElement | null>,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [inputRef, enabled])
}
