/// <reference types="vitest/config" />
import { existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Connect, Plugin } from 'vite'

type Handler = (req: IncomingMessage, res: ServerResponse, env: Record<string, string>) => Promise<void>

/**
 * SPEC: "שרת API ל-Airtable (סעיף 19)". Serves /api/* from server/api.ts inside `npm run dev` and `npm run preview`.
 * AIRTABLE_* variables are read on the server only (from the shell or from .env.local). Vite never sends them
 * to the browser: only VITE_* variables reach client code.
 */
function leadflowApi(): Plugin {
  let env: Record<string, string> = {}
  const mount = (attach: Connect.Server['use'], load: () => Promise<{ handle: Handler }>) =>
    attach(async (req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next()
      try {
        await (await load()).handle(req, res, env)
      } catch (e) {
        next(e)
      }
    })
  return {
    name: 'leadflow-api',
    configResolved(c) {
      env = loadEnv(c.mode, c.root, 'AIRTABLE_')
    },
    configureServer(server) {
      mount(server.middlewares.use.bind(server.middlewares), () => server.ssrLoadModule('/server/api.ts') as Promise<{ handle: Handler }>)
    },
    configurePreviewServer(server) {
      const file = resolve('dist-server/api.js')
      if (!existsSync(file)) {
        server.config.logger.warn('[leadflow-api] dist-server/api.js is missing: run npm run build first. /api is off.')
        return
      }
      mount(server.middlewares.use.bind(server.middlewares), () => import(pathToFileURL(file).href))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/leadflow-dashboard/',
  plugins: [react(), leadflowApi()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
})
