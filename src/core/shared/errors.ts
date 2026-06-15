/** Stable machine-readable error codes shared across the core and adapters. */
export type ErrorCode =
  | 'EMPTY_INPUT'
  | 'INPUT_TOO_LONG'
  | 'INVALID_VOICE'
  | 'PROVIDER_UNAVAILABLE'
  | 'NOT_FOUND'

/** Base class for all domain errors. Carries a stable `code`. */
export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class EmptyInputError extends DomainError {
  constructor() {
    super('EMPTY_INPUT', 'Text must not be empty.')
  }
}

export class InputTooLongError extends DomainError {
  constructor(public readonly max: number) {
    super('INPUT_TOO_LONG', `Text exceeds the maximum of ${max} characters.`)
  }
}

export class InvalidVoiceError extends DomainError {
  constructor(public readonly voiceId: string) {
    super('INVALID_VOICE', `Unknown voice: "${voiceId}".`)
  }
}

export class ProviderUnavailableError extends DomainError {
  constructor(message = 'The text-to-speech provider is currently unavailable.') {
    super('PROVIDER_UNAVAILABLE', message)
  }
}

export class NotFoundError extends DomainError {
  constructor(public readonly id: string) {
    super('NOT_FOUND', `Generation not found: "${id}".`)
  }
}
