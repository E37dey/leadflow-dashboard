// Seed the LEADFLOW Airtable base with the demo data. Safe to run twice (upsert on the "ID" field).
// SPEC: "מקור נתונים: Airtable". The dashboard itself only reads; this script is the one writer.
//
// Needs a WRITE token (data.records:read, data.records:write, schema.bases:read) for this base only,
// in the AIRTABLE_TOKEN environment variable. It is never stored in the repo. For example:
//   node --env-file=<path-to-your-env-file> scripts/upload-airtable.mjs --base appxPmVAUAsA7yIIm
import { createServer } from 'vite'

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }
const BASE = arg('--base') ?? process.env.LEADFLOW_BASE_ID
const TOKEN = process.env.AIRTABLE_TOKEN ?? ''
if (!/^app[A-Za-z0-9]{14}$/.test(BASE ?? '')) { console.error('Missing --base appXXXXXXXXXXXXXX'); process.exit(1) }
if (!TOKEN.startsWith('pat')) { console.error('Missing AIRTABLE_TOKEN (write token) in the environment'); process.exit(1) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function call(method, path, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(220) // stay under 5 requests per second
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(path)}`, {
      method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) return json
    if ([429, 500, 502, 503].includes(res.status) && attempt < 3) { await sleep(1000 * 2 ** attempt); continue }
    throw new Error(`Airtable ${method} ${path} -> ${res.status} ${JSON.stringify(json.error ?? json).slice(0, 300)}`)
  }
}

/** Upsert in chunks of 10 on the ID field. Returns { appId: airtableRecordId }. */
async function upsert(table, fieldsList) {
  const ids = {}
  let created = 0, updated = 0
  for (let i = 0; i < fieldsList.length; i += 10) {
    const res = await call('PATCH', table, { performUpsert: { fieldsToMergeOn: ['ID'] }, typecast: true, records: fieldsList.slice(i, i + 10).map((fields) => ({ fields })) })
    created += res.createdRecords?.length ?? 0
    updated += res.updatedRecords?.length ?? 0
    for (const r of res.records) ids[r.fields.ID] = r.id
  }
  console.log(`  ${table.padEnd(7)} ${String(fieldsList.length).padStart(4)} rows  (${created} created, ${updated} updated)`)
  return ids
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
try {
  const { createFixture } = await vite.ssrLoadModule('/src/data/fixture.ts')
  const at = await vite.ssrLoadModule('/src/domain/airtable.ts')
  const fx = createFixture()

  const ownerRec = await upsert('Owners', fx.owners.map((o) => at.ownerFields(o)))
  const leadRec = await upsert('Leads', fx.leads.map((l) => at.leadFields(l, ownerRec[l.ownerId])))
  await upsert('Tasks', fx.tasks.map((t) => at.taskFields(t, t.leadId ? leadRec[t.leadId] : undefined)))

  // Count in, count out: what is in Airtable must equal the demo data.
  const n = Object.keys(leadRec).length
  if (n !== fx.leads.length) throw new Error(`lead count mismatch: ${n} vs ${fx.leads.length}`)
  const open = fx.leads.filter((l) => ['new', 'contacted', 'qualified', 'proposal'].includes(l.stage)).reduce((s, l) => s + l.estimatedValueILS, 0)
  console.log(`done. ${fx.owners.length} owners, ${n} leads, ${fx.tasks.length} tasks. Open pipeline ₪${open.toLocaleString('en-US')}.`)
} finally {
  await vite.close()
}
