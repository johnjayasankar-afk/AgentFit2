/* AgentFit, in the Labs material.
 *
 * The app renders its own DOM, so labs-ui watches for new nodes and dresses
 * those too: a view that mounts later still gets the material. Everything here
 * is off under reduced motion, and the lens is Chromium only.
 */
// @ts-expect-error: labs-ui is plain JavaScript, shared across every Labs product
import { initLabsUI } from './labs-ui.js'

export function startLabsUI() {
  return initLabsUI({
    observe: true,
    glass: [
      { sel: 'header.sticky', spec: 1, lens: [13, 52, 9, 1.95], vars: { '--gl-tint': '.5', '--gl-tint-dark': '.56' } },
      { sel: '.panel', lens: [12, 34, 8, 1.7], vars: { '--gl-tint': '.62', '--gl-tint-dark': '.5' } },
      { sel: '[role="dialog"]', spec: 1, overlay: 1, lens: [16, 55, 12, 1.8], vars: { '--gl-tint': '.66', '--gl-tint-dark': '.62' } },
      { sel: '[role="radiogroup"]', spec: 1, lens: [8, 23, 4, 1.7], vars: { '--gl-tint': '.4', '--gl-tint-dark': '.42' } },
      { sel: '.btn-quiet', flat: 1, vars: { '--gl-tint': '.44', '--gl-tint-dark': '.4' } },
    ],
    headings: '.display, .display-sm',
  })
}
