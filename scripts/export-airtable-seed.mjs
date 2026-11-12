// Writes the demo data as Airtable fields (by field name) to stdout, for seeding the base.
// Usage: node scripts/export-airtable-seed.mjs > seed.json   (links are given as the app ids; resolve them to record ids when uploading)
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
try {
  const { createFixture } = await vite.ssrLoadModule('/src/data/fixture.ts')
  const at = await vite.ssrLoadModule('/src/domain/airtable.ts')
  const fx = createFixture()
  const out = {
    owners: fx.owners.map((o) => at.ownerFields(o)),
    leads: fx.leads.map((l) => ({ ownerId: l.ownerId, fields: at.leadFields(l, undefined) })),
    tasks: fx.tasks.map((t) => ({ leadId: t.leadId, fields: at.taskFields(t, undefined) })),
  }
  process.stdout.write(JSON.stringify(out))
} finally {
  await vite.close()
}
