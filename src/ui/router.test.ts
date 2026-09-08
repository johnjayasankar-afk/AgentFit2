import { describe, expect, it } from 'vitest'
import { absoluteUrl, DEEP_TABS, formatRoute, HOME, parseRoute, routeFor, type Route } from './router'

describe('routes', () => {
  it('round-trips every kind', () => {
    const routes: Route[] = [
      { kind: 'workspace', id: null, tab: 'controls' },
      { kind: 'workspace', id: null, tab: 'decision' },
      { kind: 'workspace', id: 'abc-123', tab: 'controls' },
      { kind: 'workspace', id: 'abc-123', tab: 'risk' },
      { kind: 'library' },
      { kind: 'method' },
      { kind: 'brief' },
      { kind: 'compare', ids: ['a1', 'b2'] },
      { kind: 'shared', token: 'AbCdEf-_123', tab: 'controls' },
      { kind: 'shared', token: 'AbCdEf-_123', tab: 'plan' },
    ]
    for (const route of routes) {
      expect(parseRoute(formatRoute(route))).toEqual(route)
    }
  })

  it('every detail panel is addressable', () => {
    for (const tab of DEEP_TABS) {
      const route: Route = { kind: 'workspace', id: 'x1', tab: tab.id }
      expect(parseRoute(formatRoute(route))).toEqual(route)
    }
  })

  it('resolves an unknown address to the sheet rather than an error', () => {
    for (const hash of ['#/nonsense', '#/a', '#/a//', '#/compare', '', '#', '#/', '#/a/not a valid id']) {
      const route = parseRoute(hash)
      // `#/compare` alone is a valid empty comparison; everything else is home.
      if (hash === '#/compare') expect(route).toEqual({ kind: 'compare', ids: [] })
      else expect(route).toEqual(HOME)
    }
  })

  it('drops comparison ids that are not ids, and caps the list at four', () => {
    expect(parseRoute('#/compare/a,b,,c d,e')).toEqual({ kind: 'compare', ids: ['a', 'b', 'e'] })
    expect(parseRoute('#/compare/a,b,c,d,e,f')).toEqual({
      kind: 'compare',
      ids: ['a', 'b', 'c', 'd'],
    })
  })

  it('falls back to the default panel for an unknown tab', () => {
    expect(parseRoute('#/a/x1/nonsense')).toEqual({ kind: 'workspace', id: 'x1', tab: 'controls' })
    expect(parseRoute('#/t/nonsense')).toEqual(HOME)
  })

  it('opens a shared assessment on the panel the sender was reading', () => {
    expect(parseRoute('#/s/XYZ/risk')).toEqual({ kind: 'shared', token: 'XYZ', tab: 'risk' })
    expect(formatRoute({ kind: 'shared', token: 'XYZ', tab: 'risk' })).toBe('#/s/XYZ/risk')
    // The default panel is implied rather than written.
    expect(formatRoute({ kind: 'shared', token: 'XYZ', tab: 'controls' })).toBe('#/s/XYZ')
  })

  it('keeps a mangled share token whole rather than opening the wrong thing', () => {
    // base64url never produces a slash, so a second segment that is not a panel
    // means the link was broken in transit; the decoder should be the one to
    // reject it, loudly, rather than this quietly reading a prefix.
    expect(parseRoute('#/s/abc/def')).toEqual({ kind: 'shared', token: 'abc/def', tab: 'controls' })
  })

  it('writes the shortest address that means the same thing', () => {
    expect(formatRoute({ kind: 'workspace', id: null, tab: 'controls' })).toBe('#/')
    expect(formatRoute({ kind: 'workspace', id: 'x1', tab: 'controls' })).toBe('#/a/x1')
    expect(formatRoute({ kind: 'workspace', id: 'x1', tab: 'plan' })).toBe('#/a/x1/plan')
    expect(formatRoute({ kind: 'compare', ids: [] })).toBe('#/compare')
  })

  describe('the address of the current state', () => {
    const state = {
      view: 'workspace' as const,
      currentId: 'x1',
      isSaved: true,
      tab: 'controls' as const,
      compareIds: [] as string[],
    }

    it('names the assessment once it exists on the device', () => {
      expect(routeFor(state)).toEqual({ kind: 'workspace', id: 'x1', tab: 'controls' })
    })

    it('refuses to write an id nobody else could resolve', () => {
      // An unsaved assessment has an id, but it addresses nothing.
      expect(routeFor({ ...state, isSaved: false })).toEqual(HOME)
    })

    it('carries the comparison selection', () => {
      expect(routeFor({ ...state, view: 'compare', compareIds: ['a', 'b'] })).toEqual({
        kind: 'compare',
        ids: ['a', 'b'],
      })
    })
  })

  it('builds an absolute link against the page it is served from', () => {
    expect(
      absoluteUrl(
        { kind: 'shared', token: 'XYZ', tab: 'controls' },
        { origin: 'https://example.com', pathname: '/agentfit/' },
      ),
    ).toBe('https://example.com/agentfit/#/s/XYZ')
  })
})
