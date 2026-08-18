import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FieldValue } from 'firebase-admin/firestore'
import { assertFirebase, db } from '../server/firebase-admin.js'
import { deriveSentencePairs } from '../server/sentences.js'

assertFirebase()
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const workspace = path.resolve(scriptDirectory, '..')
const originalDirectory = path.join(workspace, 'Cosafe Dataset Translation', 'CoSafe datasets Main')
const translatedDirectory = path.join(workspace, 'Cosafe Dataset Translation', 'Cosafe dataset Bengali 12B')

const filenames = (await import('node:fs/promises')).readdir(originalDirectory)
const jsonFiles = (await filenames).filter((filename) => filename.endsWith('.json')).sort()

function parseJsonLines(contents, filename) {
  return contents.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      const conversation = JSON.parse(line)
      if (!Array.isArray(conversation)) throw new Error('conversation must be an array')
      return conversation
    } catch (error) {
      throw new Error(`${filename}, line ${index + 1}: ${error.message}`)
    }
  })
}

function itemId(category, index) {
  const slug = category.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase()
  return `${slug}_${String(index + 1).padStart(3, '0')}`
}

let batch = db.batch()
let batchSize = 0
let total = 0
let sentenceTotal = 0

async function commitIfNeeded(force = false) {
  if (batchSize >= 400 || (force && batchSize)) {
    await batch.commit()
    batch = db.batch()
    batchSize = 0
  }
}

for (const filename of jsonFiles) {
  const [originalContents, translatedContents] = await Promise.all([
    readFile(path.join(originalDirectory, filename), 'utf8'),
    readFile(path.join(translatedDirectory, filename), 'utf8'),
  ])
  const originals = parseJsonLines(originalContents, filename)
  const translations = parseJsonLines(translatedContents, filename)
  if (originals.length !== translations.length) {
    throw new Error(`${filename}: original has ${originals.length} rows, translation has ${translations.length}`)
  }

  const category = path.basename(filename, '.json')
  for (let index = 0; index < originals.length; index += 1) {
    const id = itemId(category, index)
    const conversation = {
      category,
      sourceFile: filename,
      sourceIndex: index + 1,
      originalMessages: originals[index],
      translatedMessages: translations[index],
      importedAt: FieldValue.serverTimestamp(),
    }
    batch.set(db.collection('items').doc(id), conversation)
    batchSize += 1
    total += 1
    sentenceTotal += deriveSentencePairs(conversation, id).length
    await commitIfNeeded()
  }
  console.log(`Prepared ${filename}: ${originals.length} conversations`)
}

await commitIfNeeded(true)
await db.collection('settings').doc('dataset').set({
  conversationCount: total,
  sentenceCount: sentenceTotal,
  schemaVersion: 3,
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true })
console.log(`Imported ${total} paired conversations. ${sentenceTotal} aligned sentence units are derived on demand.`)
console.log('Open the admin Sample set and generate a new 500-sentence sample.')
