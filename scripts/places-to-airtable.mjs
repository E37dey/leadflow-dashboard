// Real data: Google Maps places from Apify datasets -> Airtable (Owners + Leads). Safe to run twice.
// SPEC: "מקור נתונים: Airtable". Upsert on "ID" (M-<placeId>). With --replace, Google Maps leads that are no longer
// in the datasets are deleted, so Airtable mirrors the source. A local copy goes to .data/ (not in the repo).
//
// Needs a WRITE token for this base in AIRTABLE_TOKEN, for example:
//   node --env-file=<path-to-your-env-file> scripts/places-to-airtable.mjs --base appxPmVAUAsA7yIIm --datasets id1,id2,id3 --replace
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }
const BASE = arg('--base'), DATASETS = (arg('--datasets') ?? '').split(',').filter(Boolean), REPLACE = process.argv.includes('--replace')
const TOKEN = process.env.AIRTABLE_TOKEN ?? ''
if (!/^app[A-Za-z0-9]{14}$/.test(BASE ?? '')) { console.error('Missing --base appXXXXXXXXXXXXXX'); process.exit(1) }
if (!DATASETS.length) { console.error('Missing --datasets id1,id2'); process.exit(1) }
if (!TOKEN.startsWith('pat')) { console.error('Missing AIRTABLE_TOKEN (write token) in the environment'); process.exit(1) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function at(method, path, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(220) // under 5 requests per second
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
      method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) return json
    if ([429, 500, 502, 503].includes(res.status) && attempt < 3) { await sleep(1000 * 2 ** attempt); continue }
    throw new Error(`Airtable ${method} ${path} -> ${res.status} ${JSON.stringify(json.error ?? json).slice(0, 300)}`)
  }
}
async function upsert(table, fieldsList) {
  const ids = {}
  let created = 0, updated = 0
  for (let i = 0; i < fieldsList.length; i += 10) {
    const res = await at('PATCH', encodeURIComponent(table), { performUpsert: { fieldsToMergeOn: ['ID'] }, typecast: true, records: fieldsList.slice(i, i + 10).map((fields) => ({ fields })) })
    created += res.createdRecords?.length ?? 0
    updated += res.updatedRecords?.length ?? 0
    for (const r of res.records) ids[r.fields.ID] = r.id
  }
  console.log(`  ${table.padEnd(7)} ${String(fieldsList.length).padStart(4)} rows  (${created} created, ${updated} updated)`)
  return ids
}
async function allIds(table) {
  const out = []
  let offset
  do {
    const q = new URLSearchParams({ pageSize: '100', 'fields[]': 'ID' })
    if (offset) q.set('offset', offset)
    const res = await at('GET', `${encodeURIComponent(table)}?${q}`)
    out.push(...res.records.map((r) => ({ rec: r.id, id: r.fields.ID })))
    offset = res.offset
  } while (offset)
  return out
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
try {
  const maps = await vite.ssrLoadModule('/src/domain/maps.ts')
  const atm = await vite.ssrLoadModule('/src/domain/airtable.ts')

  // 1) read the Apify datasets (public by id, fields we use only)
  const items = []
  for (const d of DATASETS) {
    const res = await fetch(`https://api.apify.com/v2/datasets/${d}/items?clean=true&fields=${maps.APIFY_FIELDS.join(',')}`)
    if (!res.ok) throw new Error(`Apify dataset ${d} -> ${res.status}`)
    const rows = await res.json()
    console.log(`  dataset ${d}: ${rows.length} places`)
    items.push(...rows)
  }
  mkdirSync('.data', { recursive: true })
  writeFileSync('.data/places.json', JSON.stringify({ datasets: DATASETS, fetchedAt: new Date().toISOString(), items }, null, 1))

  // 2) map, drop unusable and duplicates. Count in, count out.
  const seen = new Set(), leads = []
  let skipped = 0, dupes = 0
  for (const it of items) {
    const l = maps.apifyToLead(it)
    if (!l) { skipped++; continue }
    if (seen.has(l.id)) { dupes++; continue }
    seen.add(l.id)
    leads.push(l)
  }
  console.log(`  places ${items.length} = leads ${leads.length} + duplicates ${dupes} + skipped ${skipped}`)
  if (items.length !== leads.length + dupes + skipped) throw new Error('count mismatch')
  if (leads.length > 950) throw new Error('over the free plan (1,000 records per base)')

  // 3) classify: unique / branch of a chain / suspected duplicate (fixed rules in src/domain/quality.ts)
  const quality = await vite.ssrLoadModule('/src/domain/quality.ts')
  const classified = quality.classifyPlaces(leads)
  const cls = {}
  for (const l of classified) cls[l.place.recordClass] = (cls[l.place.recordClass] ?? 0) + 1
  console.log('  classes', JSON.stringify(cls))
  for (const l of classified) if (l.place.recordClass === 'suspected_duplicate') console.log('    duplicate?', l.fullName, '->', l.place.duplicateOf)

  // 4) write
  const ownerRec = await upsert('Owners', [atm.ownerFields(maps.MAPS_OWNER)])
  await upsert('Leads', classified.map((l) => atm.leadFields(l, ownerRec[l.ownerId])))

  // 5) sync: remove Google Maps leads that are not in the source anymore
  if (REPLACE) {
    const stale = (await allIds('Leads')).filter((r) => typeof r.id === 'string' && r.id.startsWith('M-') && !seen.has(r.id))
    for (let i = 0; i < stale.length; i += 10) {
      const q = new URLSearchParams()
      stale.slice(i, i + 10).forEach((r) => q.append('records[]', r.rec))
      await at('DELETE', `Leads?${q}`)
    }
    console.log(`  removed ${stale.length} leads that are not in the source anymore`)
  }
  console.log(`done. ${leads.length} real places in Airtable.`)
} finally {
  await vite.close()
}
