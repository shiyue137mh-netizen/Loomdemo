export type Mutation =
  | { readonly op: 'add'; readonly fragmentId: string; readonly index: number }
  | { readonly op: 'remove'; readonly fragmentId: string; readonly index: number }
  | {
      readonly op: 'update'
      readonly fragmentId: string
      readonly beforeContent: string
      readonly afterContent: string
    }
  | {
      readonly op: 'move'
      readonly fragmentId: string
      readonly fromIndex: number
      readonly toIndex: number
    }
