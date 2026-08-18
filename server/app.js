import cors from 'cors'
import express from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminAuth, assertFirebase, db } from './firebase-admin.js'
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
  const references = study.sampleIds.map((id) => db.collection('items').doc(id))
  const documents = await db.getAll(...references)
  const queue = documents.filter((doc) => doc.exists).map((doc, order) => {
    const item = doc.data()
    return { id: doc.id, order: order + 1, category: item.category, sourceIndex: item.sourceIndex }
  })
  response.json({ study: { ...study, sampleSize: queue.length }, queue, annotations: byItem })
}))

app.get('/api/items/:itemId', asyncRoute(async (request, response) => {
  const study = await currentStudy()
  if (!study.sampleIds.includes(request.params.itemId)) return response.status(404).json({ error: 'Sample not found.' })
  const document = await db.collection('items').doc(request.params.itemId).get()
  if (!document.exists) return response.status(404).json({ error: 'Dataset item not found.' })
  response.json({ id: document.id, ...document.data() })
}))

const annotationSchema = z.object({
  ratings: z.object({
    adequacy: z.number().int().min(1).max(5).nullable(),
    fluency: z.number().int().min(1).max(5).nullable(),
    semantic: z.number().int().min(1).max(5).nullable(),
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
  const references = study.sampleIds.map((id) => db.collection('items').doc(id))
  const documents = references.length ? await db.getAll(...references) : []
  response.json({
    study,
    items: documents.filter((document) => document.exists).map((document, index) => ({
      id: document.id,
      order: index + 1,
      category: document.data().category,
      sourceIndex: document.data().sourceIndex,
      preview: document.data().originalMessages?.[0]?.content || '',
    })),
  })
}))

app.post('/api/admin/sample/generate', requireAdmin, asyncRoute(async (request, response) => {
  const { count, seed } = z.object({ count: z.number().int().min(3).max(1400).default(500), seed: z.string().min(1).max(80) }).parse(request.body)
  const snapshot = await db.collection('items').get()
  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  if (items.length < count) return response.status(400).json({ error: `Only ${items.length} imported items are available.` })
  const sample = balancedSample(items, count, seed)
  await db.collection('settings').doc('study').set({
    sampleIds: sample.map((item) => item.id),
    targetSize: count,
    seed,
    method: 'category-balanced',
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
  const snapshot = await query.limit(100).get()
  response.json(snapshot.docs.map((doc) => ({
    id: doc.id,
    category: doc.data().category,
    sourceIndex: doc.data().sourceIndex,
    preview: doc.data().originalMessages?.[0]?.content || '',
  })))
}))

app.post('/api/admin/sample/items', requireAdmin, asyncRoute(async (request, response) => {
  const { itemId } = z.object({ itemId: z.string().min(1) }).parse(request.body)
  const item = await db.collection('items').doc(itemId).get()
  if (!item.exists) return response.status(404).json({ error: 'Dataset item not found.' })
  await db.collection('settings').doc('study').set({ sampleIds: FieldValue.arrayUnion(itemId), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  response.json({ ok: true })
}))

app.delete('/api/admin/sample/items/:itemId', requireAdmin, asyncRoute(async (request, response) => {
  await db.collection('settings').doc('study').set({ sampleIds: FieldValue.arrayRemove(request.params.itemId), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  response.json({ ok: true })
}))

app.get('/api/admin/stats', requireAdmin, asyncRoute(async (_request, response) => {
  const [study, usersSnapshot, annotationsSnapshot] = await Promise.all([
    currentStudy(),
    db.collection('users').where('role', '==', 'annotator').get(),
    db.collection('annotations').get(),
  ])
  const users = usersSnapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }))
  const annotations = annotationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  const progress = users.map((user) => {
    const own = annotations.filter((annotation) => annotation.userId === user.uid)
    const submitted = own.filter((annotation) => annotation.status === 'submitted').length
    return { uid: user.uid, displayName: user.displayName, email: user.email, submitted, drafts: own.length - submitted, total: study.sampleIds.length }
  })
  response.json({ sampleSize: study.sampleIds.length, progress, agreement: calculateAgreement(annotations, users.length) })
}))

app.get('/api/admin/comparison/:itemId', requireAdmin, asyncRoute(async (request, response) => {
  const [item, annotations] = await Promise.all([
    db.collection('items').doc(request.params.itemId).get(),
    db.collection('annotations').where('itemId', '==', request.params.itemId).get(),
  ])
  if (!item.exists) return response.status(404).json({ error: 'Dataset item not found.' })
  response.json({
    item: { id: item.id, ...item.data() },
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
