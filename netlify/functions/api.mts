// SPEC: "שרת API ל-Airtable (סעיף 19)". The same server/api.ts handle(), running as a Netlify Function for the public site.
// Read only: AIRTABLE_READONLY is forced to '1', so every write is refused here. The token stays in Netlify's environment.
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handle } from '../../server/api'
import type { ServerEnv } from '../../server/airtable'

export default async (request: Request, context: { ip?: string }) => {
  const url = new URL(request.url)
  const body = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text()
  const req = Readable.from(body ? [body] : []) as unknown as IncomingMessage
  Object.assign(req, {
    method: request.method,
    url: url.pathname + url.search,
    headers: Object.fromEntries(request.headers),
    socket: { remoteAddress: context?.ip ?? '' },
  })
  let status = 200
  let out = ''
  const headers = new Headers()
  const res = {
    statusCode: 200,
    setHeader: (k: string, v: string) => headers.set(k, v),
    end(this: { statusCode: number }, chunk?: string) { status = this.statusCode; out = chunk ?? '' },
  } as unknown as ServerResponse
  const env: ServerEnv = {
    AIRTABLE_TOKEN: process.env.AIRTABLE_TOKEN,
    AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID,
    AIRTABLE_LEADS_TABLE: process.env.AIRTABLE_LEADS_TABLE,
    AIRTABLE_ACTIVITIES_TABLE: process.env.AIRTABLE_ACTIVITIES_TABLE,
    AIRTABLE_OWNERS_TABLE: process.env.AIRTABLE_OWNERS_TABLE,
    AIRTABLE_TASKS_TABLE: process.env.AIRTABLE_TASKS_TABLE,
    AIRTABLE_READONLY: '1',
  }
  await handle(req, res, env)
  return new Response(out, { status, headers })
}

export const config = { path: '/api/*' }
