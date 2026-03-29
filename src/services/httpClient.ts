export class HttpError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

type RequestOptions = RequestInit & {
  body?: BodyInit | null
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestOptions): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : null

  if (!response.ok) {
    throw new HttpError(
      String(payload?.message ?? 'Falha na requisicao.'),
      response.status,
      typeof payload?.code === 'string' ? payload.code : undefined,
    )
  }

  return payload as T
}