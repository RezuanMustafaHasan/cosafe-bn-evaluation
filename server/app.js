import cors from 'cors'
import express from 'express'
import { FieldPath, FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminAuth, assertFirebase, db } from './firebase-admin.js'
import { RATING_SCALE_VERSION } from './rating-scale.js'
import { conversationIdFromSentenceId, deriveSentencePairs } from './sentences.js'
import { balancedSample, calculateAgreement } from './study.js'

const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }))
app.use(express.json({ limit: '1mb' }))

const asyncRoute = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next)

async function authenticate(request, response, next) {
  try {
    assertFirebase()
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return response.status(401).json({ error: 'Authentication required.' })
    const decoded = await adminAuth.verifyIdToken(token, true)
    const profile = await db.collection('users').doc(decoded.uid).get()
    if (!profile.exists || profile.data().disabled) {
      return response.status(403).json({ error: 'This account is not active.' })
    }
    request.user = { uid: decoded.uid, email: decoded.email, ...profile.data(), role: decoded.role || profile.data().role }
    next()
  } catch (error) {
    response.status(401).json({ error: error.message || 'Invalid session.' })
  }
}

function requireAdmin(request, response, next) {
  if (request.user.role !== 'admin') return response.status(403).json({ error: 'Admin access required.' })
  next()
}

async function currentStudy() {
  const snapshot = await db.collection('settings').doc('study').get()
  return snapshot.exists ? snapshot.data() : { sampleIds: [], revision: 0, targetSize: 500 }
}

async function getDocuments(collectionName, ids, chunkSize = 200) {
  const documents = []
  for (let index = 0; index < ids.length; index += chunkSize) {
    const references = ids.slice(index, index + chunkSize).map((id) => db.collection(collectionName).doc(id))
    documents.push(...await db.getAll(...references))
  }
  return documents
}

async function getSentenceMap(ids) {
  const conversationIds = [...new Set(ids.map(conversationIdFromSentenceId).filter(Boolean))]
  const conversations = await getDocuments('items', conversationIds)
  const sentenceMap = new Map()
  for (const document of conversations) {
    if (!document.exists) continue
    for (const sentence of deriveSentencePairs(document.data(), document.id)) sentenceMap.set(sentence.id, sentence)
  }
  return sentenceMap
}

async function getSentence(itemId) {
  const conversationId = conversationIdFromSentenceId(itemId)
  if (!conversationId) return null
  const document = await db.collection('items').doc(conversationId).get()
  if (!document.exists) return null
  const conversation = document.data()
  const sentence = deriveSentencePairs(conversation, document.id).find((entry) => entry.id === itemId)
  return sentence ? {
    ...sentence,
    originalMessages: conversation.originalMessages || [],
    translatedMessages: conversation.translatedMessages || [],
  } : null
}

function isoDate(value) {
  return value?.toDate ? value.toDate().toISOString() : ''
}

app.get('/api/health', (_request, response) => response.json({ ok: true, firebase: Boolean(db) }))

app.use('/api', authenticate)

app.get('/api/me', asyncRoute(async (request, response) => {
  const { uid, email, displayName, role } = request.user
  response.json({ uid, email, displayName, role })
}))

app.get('/api/study', asyncRoute(async (request, response) => {
  const study = await currentStudy()
  const annotations = await db.collection('annotations').where('userId', '==', request.user.uid).get()
  const byItem = Object.fromEntries(annotations.docs.map((doc) => [doc.data().itemId, { id: doc.id, ...doc.data() }]))

  if (!study.sampleIds.length) return response.json({ study, queue: [], annotations: byItem })
  const sentenceMap = await getSentenceMap(study.sampleIds)
  const queue = study.sampleIds.map((id, order) => {
    const item = sentenceMap.get(id)
    return item ? { id, order: order + 1, category: item.category, sourceIndex: item.sourceIndex, turnIndex: item.turnIndex, sentenceIndex: item.sentenceIndex, role: item.role, alignmentWarning: item.alignmentWarning } : null
  }).filter(Boolean)
  response.json({ study: { ...study, sampleSize: queue.length }, queue, annotations: byItem })
}))

app.get('/api/items/:itemId', asyncRoute(async (request, response) => {
  const study = await currentStudy()
  if (!study.sampleIds.includes(request.params.itemId)) return response.status(404).json({ error: 'Sample not found.' })
  const sentence = await getSentence(request.params.itemId)
  if (!sentence) return response.status(404).json({ error: 'Dataset sentence not found.' })
  response.json(sentence)
}))

const annotationSchema = z.object({
  ratings: z.object({
    adequacy: z.number().int().min(1).max(3).nullable(),
    fluency: z.number().int().min(1).max(3).nullable(),
    semantic: z.number().int().min(1).max(3).nullable(),
  }),
  issueTags: z.array(z.string().max(40)).max(10).default([]),
  notes: z.string().max(2000).default(''),
  status: z.enum(['draft', 'submitted']),
})

app.put('/api/annotations/:itemId', asyncRoute(async (request, response) => {
  const study = await currentStudy()
  if (!study.sampleIds.includes(request.params.itemId)) return response.status(404).json({ error: 'Sample not found.' })
  const parsed = annotationSchema.parse(request.body)
  if (parsed.status === 'submitted' && Object.values(parsed.ratings).some((rating) => rating === null)) {
    return response.status(400).json({ error: 'All three ratings are required before submission.' })
  }

  const documentId = `${request.user.uid}_${request.params.itemId}`
  const reference = db.collection('annotations').doc(documentId)
  const existing = await reference.get()
  const annotation = {
    ...parsed,
    itemId: request.params.itemId,
    userId: request.user.uid,
    annotatorName: request.user.displayName || request.user.email,
    studyRevision: study.revision || 1,
    ratingScaleVersion: RATING_SCALE_VERSION,
    updatedAt: FieldValue.serverTimestamp(),
    ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    ...(parsed.status === 'submitted' ? { submittedAt: FieldValue.serverTimestamp() } : {}),
  }
  await reference.set(annotation, { merge: true })
  response.json({ ok: true, id: documentId })
}))

app.get('/api/admin/users', requireAdmin, asyncRoute(async (_request, response) => {
  const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get()
  response.json(snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })))
}))

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80),
  role: z.enum(['annotator', 'admin']).default('annotator'),
})

app.post('/api/admin/users', requireAdmin, asyncRoute(async (request, response) => {
  const input = userSchema.parse(request.body)
  const record = await adminAuth.createUser({ email: input.email, password: input.password, displayName: input.displayName })
  await adminAuth.setCustomUserClaims(record.uid, { role: input.role })
  await db.collection('users').doc(record.uid).set({
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    disabled: false,
    createdAt: FieldValue.serverTimestamp(),
  })
  response.status(201).json({ uid: record.uid, email: input.email, displayName: input.displayName, role: input.role })
}))

app.patch('/api/admin/users/:uid', requireAdmin, asyncRoute(async (request, response) => {
  const input = z.object({ disabled: z.boolean().optional(), displayName: z.string().min(2).max(80).optional() }).parse(request.body)
  await adminAuth.updateUser(request.params.uid, input)
  await db.collection('users').doc(request.params.uid).set(input, { merge: true })
  response.json({ ok: true })
}))

app.get('/api/admin/sample', requireAdmin, asyncRoute(async (_request, response) => {
  const study = await currentStudy()
  const sentenceMap = await getSentenceMap(study.sampleIds)
  response.json({
    study,
    items: study.sampleIds.map((id, index) => {
      const sentence = sentenceMap.get(id)
      return sentence ? { ...sentence, order: index + 1 } : null
    }).filter(Boolean),
  })
}))

app.post('/api/admin/sample/generate', requireAdmin, asyncRoute(async (request, response) => {
  const { count, seed } = z.object({ count: z.number().int().min(3).max(1400).default(500), seed: z.string().min(1).max(80) }).parse(request.body)
  const snapshot = await db.collection('items').get()
  const items = snapshot.docs.flatMap((doc) => deriveSentencePairs(doc.data(), doc.id))
  if (items.length < count) return response.status(400).json({ error: `Only ${items.length} imported items are available.` })
  const sample = balancedSample(items, count, seed)
  await db.collection('settings').doc('study').set({
    sampleIds: sample.map((item) => item.id),
    targetSize: count,
    seed,
    method: 'category-balanced',
    sampleType: 'sentence-turn',
    revision: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.user.uid,
  }, { merge: true })
  response.json({ ok: true, count: sample.length })
}))

app.get('/api/admin/items/search', requireAdmin, asyncRoute(async (request, response) => {
  const category = String(request.query.category || '')
  let query = db.collection('items')
  if (category) query = query.where('category', '==', category)
  const snapshot = await query.limit(30).get()
  response.json(snapshot.docs.flatMap((doc) => deriveSentencePairs(doc.data(), doc.id)).slice(0, 100))
}))

app.post('/api/admin/sample/items', requireAdmin, asyncRoute(async (request, response) => {
  const { itemId } = z.object({ itemId: z.string().min(1) }).parse(request.body)
  const item = await getSentence(itemId)
  if (!item) return response.status(404).json({ error: 'Dataset sentence not found.' })
  await db.collection('settings').doc('study').set({ sampleIds: FieldValue.arrayUnion(itemId), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  response.json({ ok: true })
}))

app.delete('/api/admin/sample/items/:itemId', requireAdmin, asyncRoute(async (request, response) => {
  await db.collection('settings').doc('study').set({ sampleIds: FieldValue.arrayRemove(request.params.itemId), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  response.json({ ok: true })
}))

app.delete('/api/admin/sample', requireAdmin, asyncRoute(async (request, response) => {
  const study = await currentStudy()
  await db.collection('settings').doc('study').set({
    sampleIds: [],
    targetSize: study.targetSize || 500,
    sampleType: 'sentence-turn',
    revision: FieldValue.increment(1),
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: request.user.uid,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  response.json({ ok: true, removed: study.sampleIds.length })
}))

app.get('/api/admin/dataset', requireAdmin, asyncRoute(async (request, response) => {
  const page = Math.max(1, Number(request.query.page) || 1)
  const pageSize = Math.min(50, Math.max(5, Number(request.query.pageSize) || 20))
  const category = String(request.query.category || '')
  let query = db.collection('items')
  if (category) query = query.where('category', '==', category)
  const [countSnapshot, documents] = await Promise.all([
    query.count().get(),
    query.orderBy(FieldPath.documentId()).offset((page - 1) * pageSize).limit(pageSize).get(),
  ])
  response.json({
    page,
    pageSize,
    total: countSnapshot.data().count,
    items: documents.docs.map((document) => ({ id: document.id, ...document.data() })),
  })
}))

app.get('/api/admin/updates', requireAdmin, asyncRoute(async (_request, response) => {
  const [study, usersSnapshot, annotationsSnapshot] = await Promise.all([
    currentStudy(),
    db.collection('users').where('role', '==', 'annotator').get(),
    db.collection('annotations').get(),
  ])
  const users = usersSnapshot.docs.map((document) => ({ uid: document.id, ...document.data() }))
  const annotations = annotationsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
  const annotationMap = new Map(annotations.map((annotation) => [`${annotation.userId}_${annotation.itemId}`, annotation]))
  const sentences = await getSentenceMap(study.sampleIds)
  const updates = []
  study.sampleIds.forEach((itemId, order) => {
    const sentence = sentences.get(itemId)
    if (!sentence) return
    users.forEach((user) => {
      const annotation = annotationMap.get(`${user.uid}_${itemId}`)
      updates.push({
        itemId,
        order: order + 1,
        category: sentence.category,
        sourceIndex: sentence.sourceIndex,
        turnIndex: sentence.turnIndex,
        sentenceIndex: sentence.sentenceIndex,
        role: sentence.role,
        originalText: sentence.originalText,
        translatedText: sentence.translatedText,
        userId: user.uid,
        annotatorName: user.displayName,
        annotatorEmail: user.email,
        status: annotation?.status || 'not-started',
        ratings: annotation?.ratings || { adequacy: null, fluency: null, semantic: null },
        issueTags: annotation?.issueTags || [],
        notes: annotation?.notes || '',
        updatedAt: isoDate(annotation?.updatedAt),
      })
    })
  })
  response.json({ sampleSize: study.sampleIds.length, annotatorCount: users.length, updates })
}))

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

app.get('/api/admin/export.csv', requireAdmin, asyncRoute(async (_request, response) => {
  const [study, usersSnapshot, annotationsSnapshot] = await Promise.all([
    currentStudy(),
    db.collection('users').where('role', '==', 'annotator').get(),
    db.collection('annotations').get(),
  ])
  const users = usersSnapshot.docs.map((document) => ({ uid: document.id, ...document.data() }))
  const annotations = annotationsSnapshot.docs.map((document) => document.data())
  const annotationMap = new Map(annotations.map((annotation) => [`${annotation.userId}_${annotation.itemId}`, annotation]))
  const sentences = await getSentenceMap(study.sampleIds)
  const header = ['sample_order', 'item_id', 'category', 'conversation_row', 'turn', 'sentence_in_turn', 'alignment_warning', 'role', 'english', 'bengali', 'annotator_name', 'annotator_email', 'status', 'rating_scale', 'adequacy', 'fluency', 'semantic_preservation', 'legacy_adequacy_5', 'legacy_fluency_5', 'legacy_semantic_preservation_5', 'issue_tags', 'notes', 'updated_at', 'submitted_at']
  const rows = [header.map(csvCell).join(',')]
  study.sampleIds.forEach((itemId, order) => {
    const sentence = sentences.get(itemId)
    if (!sentence) return
    users.forEach((user) => {
      const annotation = annotationMap.get(`${user.uid}_${itemId}`)
      rows.push([
        order + 1, itemId, sentence.category, sentence.sourceIndex, sentence.turnIndex, sentence.sentenceIndex, sentence.alignmentWarning, sentence.role,
        sentence.originalText, sentence.translatedText, user.displayName, user.email,
        annotation?.status || 'not-started', annotation?.ratingScaleVersion || '', annotation?.ratings?.adequacy, annotation?.ratings?.fluency,
        annotation?.ratings?.semantic, annotation?.legacyRatings5?.adequacy, annotation?.legacyRatings5?.fluency,
        annotation?.legacyRatings5?.semantic, annotation?.issueTags?.join('|') || '', annotation?.notes || '',
        isoDate(annotation?.updatedAt), isoDate(annotation?.submittedAt),
      ].map(csvCell).join(','))
    })
  })
  response.setHeader('Content-Type', 'text/csv; charset=utf-8')
  response.setHeader('Content-Disposition', `attachment; filename="cosafe-annotation-update-${new Date().toISOString().slice(0, 10)}.csv"`)
  response.send(`\uFEFF${rows.join('\n')}`)
}))

app.get('/api/admin/stats', requireAdmin, asyncRoute(async (_request, response) => {
  const [study, usersSnapshot, annotationsSnapshot] = await Promise.all([
    currentStudy(),
    db.collection('users').where('role', '==', 'annotator').get(),
    db.collection('annotations').get(),
  ])
  const users = usersSnapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }))
  const activeIds = new Set(study.sampleIds)
  const annotations = annotationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((annotation) => activeIds.has(annotation.itemId))
  const progress = users.map((user) => {
    const own = annotations.filter((annotation) => annotation.userId === user.uid)
    const submitted = own.filter((annotation) => annotation.status === 'submitted').length
    return { uid: user.uid, displayName: user.displayName, email: user.email, submitted, drafts: own.length - submitted, total: study.sampleIds.length }
  })
  response.json({ sampleSize: study.sampleIds.length, progress, agreement: calculateAgreement(annotations, users.length) })
}))

app.get('/api/admin/comparison/:itemId', requireAdmin, asyncRoute(async (request, response) => {
  const [item, annotations] = await Promise.all([
    getSentence(request.params.itemId),
    db.collection('annotations').where('itemId', '==', request.params.itemId).get(),
  ])
  if (!item) return response.status(404).json({ error: 'Dataset sentence not found.' })
  response.json({
    item,
    annotations: annotations.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  })
}))

app.use((error, _request, response, _next) => {
  const status = error.status || (error instanceof z.ZodError ? 400 : 500)
  const message = error instanceof z.ZodError ? error.issues[0]?.message : error.message
  if (status >= 500) console.error(error)
  response.status(status).json({ error: message || 'Unexpected server error.' })
})

export default app
