import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import published from '@ragbaz/common/schemas/collection-view' with { type: 'json' }

test('the shared collection contract keeps source identity, capabilities and association separate', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/collection-view.schema.json', import.meta.url)))
  assert.deepEqual(schema, published)
  assert.equal(schema.properties.schema.const, 'ragbaz.collection-view.v1')
  assert.deepEqual(schema.properties.representation.enum, ['concrete', 'aggregate', 'virtual'])
  for (const kind of ['factory', 'artifact']) assert(schema.$defs[kind].required.includes('source_id'))
  assert.deepEqual(schema.$defs.ref.required, ['source_id', 'id'])
  for (const capability of ['stores', 'produces', 'computes']) assert.deepEqual(schema.$defs.source.properties.capabilities.properties[capability].type, ['boolean', 'null'])
  assert(schema.$defs.artifact.properties.relationship.enum.includes('attester'))
  assert(schema.$defs.artifact.required.includes('association_verified'))
  const walk = node => {
    if (!node || typeof node !== 'object') return
    if (node.$ref) {
      assert(node.$ref.startsWith('#/$defs/'))
      assert(schema.$defs[node.$ref.slice('#/$defs/'.length)])
    }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else walk(value)
  }
  walk(schema)
})
