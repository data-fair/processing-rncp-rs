import sax from 'sax'
import type { Readable } from 'node:stream'

/** A parsed XML element: a leaf is a string, a composite element is an object of children. */
export type FicheValue = string | FicheNode | (string | FicheNode)[]
export interface FicheNode { [key: string]: FicheValue }

interface Frame {
  name: string
  obj: FicheNode
  text: string
  hasChild: boolean
}

export interface StreamHandlers {
  /** Called once when <VERSION_FLUX> (direct child of <FICHES>) is read. */
  onVersion?: (version: string) => void
  /**
   * Called for each fully parsed <FICHE>. Return `false` to ask the source stream to pause
   * (back-pressure); the caller is responsible for resuming it (see process.ts).
   */
  onFiche: (fiche: FicheNode) => boolean | void
}

/**
 * Stream a (potentially huge) France Compétences XML export, emitting one plain object per
 * <FICHE> without ever holding the whole document in memory. Repeated child tags become arrays.
 */
export const streamFiches = (input: Readable, handlers: StreamHandlers): Promise<void> => {
  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: false, normalize: false })
    const stack: Frame[] = []

    const attach = (parent: FicheNode, key: string, value: FicheValue) => {
      const existing = parent[key]
      if (existing === undefined) parent[key] = value
      else if (Array.isArray(existing)) existing.push(value as string | FicheNode)
      else parent[key] = [existing, value] as (string | FicheNode)[]
    }

    parser.on('opentag', (tag) => {
      if (stack.length) stack[stack.length - 1].hasChild = true
      stack.push({ name: tag.name, obj: {}, text: '', hasChild: false })
    })
    parser.on('text', (t: string) => { if (stack.length) stack[stack.length - 1].text += t })
    parser.on('cdata', (t: string) => { if (stack.length) stack[stack.length - 1].text += t })
    parser.on('closetag', (name: string) => {
      const frame = stack.pop()
      if (!frame) return
      const value: FicheValue = frame.hasChild ? frame.obj : frame.text.trim()

      // A FICHE is emitted and deliberately NOT attached to its <FICHES> parent,
      // otherwise the root would accumulate every fiche and defeat streaming.
      if (name === 'FICHE') {
        const keepGoing = handlers.onFiche(frame.obj)
        if (keepGoing === false) input.pause()
        return
      }
      if (name === 'VERSION_FLUX' && handlers.onVersion && stack.length === 1) {
        handlers.onVersion(typeof value === 'string' ? value : '')
      }
      const parent = stack[stack.length - 1]
      if (parent) attach(parent.obj, name, value)
    })
    parser.on('error', reject)
    parser.on('end', () => resolve())
    input.on('error', reject)
    input.pipe(parser)
  })
}
