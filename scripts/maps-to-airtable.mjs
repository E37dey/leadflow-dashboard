// Real leads: Google Maps businesses collected with Apify -> Airtable (Owners + Leads). Safe to run twice (upsert on "ID").
// SPEC: "מקור נתונים: Airtable". The data file is local only (.data/ is in .gitignore): business contact data is not published.
//
// Needs a WRITE token for this base in AIRTABLE_TOKEN, for example:
//   node --env-file=<path-to-your-env-file> scripts/maps-to-airtable.mjs --base appxPmVAUAsA7yIIm --file .data/maps-leads.json
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }
const BASE = arg('--base'), FILE = arg('--file') ?? '.data/maps-leads.json'
const TOKEN = process.env.AIRTABLE_TOKEN ?? ''
if (!/^app[A-Za-z0-9]{14}$/.test(BASE ?? '')) { console.error('Missing --base appXXXXXXXXXXXXXX'); process.exit(1) }
if (!TOKEN.startsWith('pat')) { console.error('Missing AIRTABLE_TOKEN (write token) in the environment'); process.exit(1) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function call(method, table, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(220)
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`, {
      method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) return json
    if ([429, 500, 502, 503].includes(res.status) && attempt < 3) { await sleep(1000 * 2 ** attempt); continue }
    throw new Error(`Airtable ${method} ${table} -> ${res.status} ${JSON.stringify(json.error ?? json).slice(0, 300)}`)
  }
}
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
  const maps = await vite.ssrLoadModule('/src/domain/maps.ts')
  const at = await vite.ssrLoadModule('/src/domain/airtable.ts')
  const places = maps.rowsToPlaces(JSON.parse(readFileSync(FILE, 'utf8')))
  const seen = new Set()
  const leads = []
  let skipped = 0
  for (const p of places) {
    const l = maps.placeToLead(p)
    if (!l || seen.has(l.id)) { skipped++; continue }
    seen.add(l.id)
    leads.push(l)
  }
  // Count in, count out.
  console.log(`  places in file ${places.length}, leads ${leads.length}, skipped ${skipped}`)
  if (places.length !== leads.length + skipped) throw new Error('count mismatch')

  const ownerRec = await upsert('Owners', [at.ownerFields(maps.MAPS_OWNER)])
  await upsert('Leads', leads.map((l) => at.leadFields(l, ownerRec[l.ownerId])))
  console.log(`done. ${leads.length} real leads in Airtable.`)
} finally {
  await vite.close()
}
