import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'

export interface Command {
  id: string
  label: string
  group: string
  hint?: string
  run: () => void
}

/**
 * Built on a native `<dialog>` opened with `showModal()`, which supplies focus
 * trapping, Escape-to-close, and background inertness without reimplementing
 * any of them. The component is mounted only while open, so its query and
 * selection state start fresh each time rather than being reset in an effect.
 */
export function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[]
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.group} ${c.label} ${c.hint ?? ''}`.toLowerCase().includes(q))
  }, [commands, query])

  const active = results[Math.min(index, Math.max(0, results.length - 1))]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    inputRef.current?.focus()
    // Clicking outside the panel lands on the dialog element itself.
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dialog) onClose()
    }
    dialog.addEventListener('click', onBackdrop)
    return () => {
      dialog.removeEventListener('click', onBackdrop)
      if (dialog.open) dialog.close()
    }
  }, [onClose])

  const choose = (command: Command | undefined) => {
    if (!command) return
    onClose()
    command.run()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Command palette"
      onClose={onClose}
      onCancel={onClose}
      className="panel af-enter m-0 w-full max-w-[520px] p-0 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop:bg-[color-mix(in_srgb,var(--paper)_65%,transparent)] backdrop:backdrop-blur-[2px]"
      style={{ marginInline: 'auto', marginTop: '12vh' }}
    >
      <input
        ref={inputRef}
        type="text"
        className="field !border-b-[var(--hair)] px-4 py-3.5 text-[14px]"
        placeholder="Search commands"
        value={query}
        aria-label="Search commands"
        role="combobox"
        aria-expanded="true"
        aria-controls="cmd-list"
        aria-activedescendant={active ? `cmd-${active.id}` : undefined}
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value)
          setIndex(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIndex((i) => Math.min(results.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIndex((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            choose(active)
          }
        }}
      />

      <ul
        id="cmd-list"
        role="listbox"
        aria-label="Commands"
        className="thin-scroll m-0 max-h-[46vh] list-none overflow-y-auto p-0"
      >
        {results.length === 0 && (
          <li className="text-faint px-4 py-5 text-[12.5px]">No matching command.</li>
        )}
        {results.map((c, i) => (
          <li key={c.id} role="none">
            <button
              type="button"
              id={`cmd-${c.id}`}
              role="option"
              aria-selected={c.id === active?.id}
              tabIndex={-1}
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(c)}
              className={clsx(
                'flex w-full cursor-pointer items-baseline justify-between gap-4 px-4 py-2.5 text-left text-[13px]',
                c.id === active?.id && 'bg-[var(--ink)] text-[var(--paper)]',
              )}
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span
                  className={clsx(
                    'mono-sm w-[62px] shrink-0',
                    c.id === active?.id ? 'opacity-70' : 'text-faint',
                  )}
                >
                  {c.group}
                </span>
                <span className="truncate">{c.label}</span>
              </span>
              {c.hint && (
                <span
                  className={clsx(
                    'mono-sm shrink-0',
                    c.id === active?.id ? 'opacity-70' : 'text-faint',
                  )}
                >
                  {c.hint}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  )
}
