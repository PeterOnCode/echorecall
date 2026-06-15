import { randomUUID } from 'node:crypto'

/** Generate an opaque, collision-free identifier for a generation. */
export function newId(): string {
  return randomUUID()
}
