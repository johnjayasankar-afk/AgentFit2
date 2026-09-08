import { useLayoutEffect, useRef } from 'react'

/**
 * A textarea that grows to fit its content.
 *
 * The generated pilot fields and mitigations routinely run longer than the two
 * or three rows they were given, leaving the text clipped behind a scrollbar a
 * few pixels tall. Content the product wrote itself should not have to be
 * scrolled to be read.
 *
 * Height is set from `scrollHeight` after every render rather than tracked in
 * state, so it stays correct when the value changes from outside — a reset to
 * the generated text, an undo, or restoring a revision.
 */
export function AutoTextarea({
  value,
  onChange,
  minRows = 2,
  maxRows = 24,
  className,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  minRows?: number
  maxRows?: number
  className?: string
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange' | 'rows' | 'className'
>) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const styles = getComputedStyle(el)
    const line = Number.parseFloat(styles.lineHeight) || 18
    const padding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)

    // Collapse first so shrinking works, then measure.
    el.style.height = 'auto'
    const min = line * minRows + padding
    const max = line * maxRows + padding
    el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight))}px`
    // Only scroll once the cap is genuinely reached.
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  })

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      className={className}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  )
}
