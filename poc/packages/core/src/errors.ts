import type { DataFragment } from './types'

export class LoomError extends Error {
  constructor(message: string, public override cause?: unknown) {
    super(message)
    this.name = 'LoomError'
  }
}

export class PipelineError extends LoomError {
  constructor(
    message: string,
    public readonly passName: string,
    public readonly passIndex: number,
    cause?: unknown,
    public readonly snapshot?: ReadonlyArray<DataFragment>
  ) {
    super(message, cause)
    this.name = 'PipelineError'
  }
}

export class PipelineCancelledError extends PipelineError {
  constructor(passName: string, passIndex: number) {
    super(`Pipeline cancelled before pass "${passName}"`, passName, passIndex)
    this.name = 'PipelineCancelledError'
  }
}

export class PipelineValidationError extends LoomError {
  constructor(
    message: string,
    public readonly diagnostics?: ReadonlyArray<{ code: string; message: string }>
  ) {
    super(message)
    this.name = 'PipelineValidationError'
  }
}
