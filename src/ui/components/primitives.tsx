import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'

/**
 * A number that counts to its new value instead of snapping.
 *
 * The animation only ever *overrides* the real value transiently: the render
 * falls back to the prop, so if the frame loop never runs — a backgrounded tab,
 * a throttled renderer, reduced-motion — the correct number is still on screen.
 * A decorative animation must not be able to make a readout wrong.
 */
export function AnimatedNumber({ value, duration = 280 }: { value: number; duration?: number }) {
  const [tween, setTween] = useState<number | null>(null)
  const previous = useRef(value)

  useEffect(() => {
    const start = previous.current
    previous.current = value
    const distance = value - start

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    // Skip large jumps: counting through them reads as lag, not as a cue.
    if (reduced || distance === 0 || Math.abs(distance) > 40 || document.hidden) {
      setTween(null)
      return
    }

    let frame = 0
    const began = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / duration)
      const eased = 1 - (1 - t) * (1 - t)
      if (t >= 1) {
        setTween(null)
        return
      }
      setTween(Math.round(start + distance * eased))
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
      setTween(null)
    }
  }, [value, duration])

  return <span className="tabular-nums">{tween ?? value}</span>
}

export function SectionHead({
  index,
  label,
  title,
  blurb,
  action,
  className,
}: {
  index?: string
  label?: string
  title?: ReactNode
  blurb?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        // Wraps so a heading with actions stacks rather than pushing them off
        // the right edge on a narrow screen.
        'flex flex-wrap items-baseline justify-between gap-x-6 gap-y-4',
        className,
      )}
    >
      <div className="min-w-0">
        {(index || label) && (
          <div className="mono text-muted flex items-baseline gap-3">
            {index && <span className="text-faint">{index}</span>}
            {label && <span>{label}</span>}
          </div>
        )}
        {title && <h2 className="display-sm mt-3">{title}</h2>}
        {blurb && <p className="text-muted mt-2 max-w-[62ch] text-[13.5px] leading-[1.55]">{blurb}</p>}
      </div>
      {/* Never squeezed by the heading, but capped at the row so a group of
          buttons wraps within it once the whole block is on its own line. */}
      {action && <div className="max-w-full shrink-0">{action}</div>}
    </div>
  )
}

/** A labelled figure. The workhorse of the instrument panel. */
export function Metric({
  label,
  value,
  sub,
  size = 'md',
  emphasis,
  title,
  wrap,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  emphasis?: boolean
  title?: string
  /** Let a text value wrap onto a second line instead of truncating. */
  wrap?: boolean
}) {
  const sizes = {
    sm: 'text-[17px]',
    md: 'text-[24px]',
    lg: 'text-[34px]',
    xl: 'text-[64px]',
  } as const
  return (
    <div className="min-w-0" title={title}>
      <div className="mono-sm text-muted">{label}</div>
      <div
        className={clsx(
          'readout mt-2',
          wrap ? 'leading-[1.15] text-balance' : 'truncate',
          sizes[size],
          emphasis && 'text-signal',
        )}
      >
        {value}
      </div>
      {sub && <div className="text-faint mt-1.5 text-[11.5px] leading-snug">{sub}</div>}
    </div>
  )
}

/**
 * Progressive disclosure for the "why this matters" material. Collapsed by
 * default so the default interface stays an instrument rather than a textbook.
 */
export function Disclosure({
  summary,
  children,
  className,
}: {
  summary: string
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="mono-sm text-faint hover:text-soft inline-flex items-center gap-2 transition-colors"
      >
        <span aria-hidden="true" className="inline-block w-2 text-center">
          {open ? '−' : '+'}
        </span>
        {summary}
      </button>
      {open && (
        <p id={id} className="text-muted af-enter mt-2 max-w-[58ch] text-[12.5px] leading-[1.6]">
          {children}
        </p>
      )}
    </div>
  )
}

/** Segmented control. Roving focus, arrow-key navigable, single tab stop. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: { value: T; label: string; title?: string }[]
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  // Roving tabindex: the group is a single tab stop and arrows move within it.
  // The handler sits on the buttons, which are the elements that take focus.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const next = options[(index + delta + options.length) % options.length]
    if (!next) return
    onChange(next.value)
    const buttons = e.currentTarget.parentElement?.querySelectorAll('button')
    buttons?.[(index + delta + options.length) % options.length]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="border-hair-strong inline-flex overflow-hidden rounded-full border"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.title}
            onKeyDown={onKeyDown}
            onClick={() => onChange(o.value)}
            className={clsx(
              'mono-sm border-hair-strong transition-colors first:border-l-0 border-l',
              size === 'sm' ? 'h-[26px] px-2.5' : 'h-[30px] px-3',
              active
                ? 'bg-[var(--ink)] text-[var(--paper)]'
                : 'text-muted hover:text-[var(--ink)]',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A thin horizontal proportion bar. No axis, no legend, no colour. */
export function Bar({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className={clsx('bg-[var(--hair-faint)] relative h-[3px] w-full', className)} aria-hidden="true">
      <div
        className="absolute inset-y-0 left-0 bg-[var(--ink)] transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function Tag({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={clsx(
        'mono-sm inline-flex h-[22px] items-center rounded-full border px-2.5',
        active
          ? 'border-[var(--signal)] text-signal bg-signal-soft'
          : 'border-hair-strong text-muted',
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({
  label,
  title,
  children,
  action,
}: {
  label: string
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="border-hair border-t py-20 text-center">
      <div className="mono text-faint">{label}</div>
      <p className="display-sm mx-auto mt-4 max-w-[24ch]">{title}</p>
      {children && (
        <p className="text-muted mx-auto mt-3 max-w-[46ch] text-[13.5px] leading-[1.6]">{children}</p>
      )}
      {action && <div className="mt-7 flex justify-center gap-4">{action}</div>}
    </div>
  )
}
