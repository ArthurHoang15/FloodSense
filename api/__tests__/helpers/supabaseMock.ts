import { vi } from 'vitest'

export type MockResult = { data: unknown; error: unknown }

const CHAIN_METHODS = [
  'select', 'insert', 'update', 'delete', 'upsert',
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'ilike', 'like', 'not', 'or', 'filter',
  'order', 'limit',
]

const TERMINAL_METHODS = ['single', 'maybeSingle']

function makeBuilder(result: MockResult): Record<string, unknown> {
  const proxy: Record<string, unknown> = {}

  for (const m of CHAIN_METHODS) {
    proxy[m] = vi.fn((..._args: unknown[]) => proxy)
  }

  for (const m of TERMINAL_METHODS) {
    proxy[m] = vi.fn((..._args: unknown[]) => Promise.resolve(result))
  }

  // Make the builder awaitable (Supabase queries resolve when awaited)
  proxy['then'] = (
    onFulfilled?: (v: MockResult) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected)

  proxy['catch'] = (onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).catch(onRejected)

  return proxy
}

export type SupabaseMock = {
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
  __setTableResult: (table: string, result: MockResult) => void
  __getRpcMock: () => ReturnType<typeof vi.fn>
  __resetAll: () => void
}

export function makeSupabaseMock(): SupabaseMock {
  const tableResults = new Map<string, MockResult>()
  const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })
  const fromMock = vi.fn((table: string) => {
    const result = tableResults.get(table) ?? { data: null, error: null }
    return makeBuilder(result)
  })

  return {
    from: fromMock,
    rpc: rpcMock,
    __setTableResult(table: string, result: MockResult) {
      tableResults.set(table, result)
    },
    __getRpcMock() {
      return rpcMock
    },
    __resetAll() {
      tableResults.clear()
      fromMock.mockClear()
      rpcMock.mockReset()
      rpcMock.mockResolvedValue({ data: null, error: null })
    },
  }
}
