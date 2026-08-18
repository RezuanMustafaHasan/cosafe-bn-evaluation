import { auth, isDemoMode } from './firebase.js'
import { demoAnnotations, demoItems, demoSentences, demoUsers } from '../data/demo.js'

const delay = (milliseconds = 180) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const demoState = {
  items: [...demoSentences],
  conversations: [...demoItems],
  users: [...demoUsers],
  annotations: [...demoAnnotations],
  seed: 'cosafe-thesis-2026',
}

function demoUser(role) {
  return role === 'admin'
    ? { uid: 'admin-1', displayName: 'Dr. Samira Hossain', email: 'admin@example.com', role: 'admin' }
    : { uid: 'ann-1', displayName: 'Nusrat Jahan', email: 'nusrat@example.com', role: 'annotator' }
}

function stats() {
  const progress = demoState.users.map((user) => {
    const own = demoState.annotations.filter((annotation) => annotation.userId === user.uid)
    const submitted = own.filter((annotation) => annotation.status === 'submitted').length
    return { ...user, submitted, drafts: own.length - submitted, total: demoState.items.length }
  })
  return {
    sampleSize: demoState.items.length,
    progress,
    agreement: { completeItems: 3, kappa: { adequacy: 0.71, fluency: 0.64, semantic: 0.79 } },
  }
}

async function mockRequest(method, path, body) {
  await delay()
  const currentUser = demoUser(localStorage.getItem('cosafe-demo-role') || 'admin')
  if (path === '/me') return currentUser
  if (path === '/study') {
    const own = demoState.annotations.filter((annotation) => annotation.userId === currentUser.uid)
    return {
      study: { sampleSize: demoState.items.length, targetSize: 500, seed: demoState.seed, revision: 1 },
      queue: demoState.items.map((item, index) => ({ id: item.id, order: index + 1, category: item.category, sourceIndex: item.sourceIndex, turnIndex: item.turnIndex, role: item.role })),
      annotations: Object.fromEntries(own.map((annotation) => [annotation.itemId, annotation])),
    }
  }
  if (path.startsWith('/items/')) return structuredClone(demoState.items.find((item) => item.id === path.split('/').at(-1)))
  if (method === 'PUT' && path.startsWith('/annotations/')) {
    const itemId = path.split('/').at(-1)
    const existing = demoState.annotations.findIndex((annotation) => annotation.userId === currentUser.uid && annotation.itemId === itemId)
    const next = { ...body, id: `${currentUser.uid}_${itemId}`, itemId, userId: currentUser.uid, annotatorName: currentUser.displayName }
    if (existing >= 0) demoState.annotations[existing] = next
    else demoState.annotations.push(next)
    return { ok: true }
  }
  if (path === '/admin/users' && method === 'GET') return structuredClone(demoState.users)
  if (path === '/admin/users' && method === 'POST') {
    const user = { uid: `ann-${Date.now()}`, role: 'annotator', disabled: false, ...body }
    delete user.password
    demoState.users.push(user)
    return user
  }
  if (path.startsWith('/admin/users/') && method === 'PATCH') {
    const user = demoState.users.find((entry) => entry.uid === path.split('/').at(-1))
    Object.assign(user, body)
    return { ok: true }
  }
  if (path === '/admin/stats') return stats()
  if (path === '/admin/sample') return {
    study: { sampleIds: demoState.items.map((item) => item.id), targetSize: 500, seed: demoState.seed, method: 'category-balanced', revision: 1 },
    items: demoState.items.map((item, index) => ({ id: item.id, order: index + 1, category: item.category, sourceIndex: item.sourceIndex, turnIndex: item.turnIndex, role: item.role, originalText: item.originalText, translatedText: item.translatedText })),
  }
  if (path === '/admin/sample/generate' && method === 'POST') {
    demoState.seed = body.seed
    demoState.items = [...demoSentences]
    return { ok: true, count: Math.min(body.count, demoState.items.length) }
  }
  if (path === '/admin/items/search') return demoSentences.map((item) => ({ id: item.id, category: item.category, sourceIndex: item.sourceIndex, turnIndex: item.turnIndex, originalText: item.originalText, translatedText: item.translatedText }))
  if (path === '/admin/sample/items' && method === 'POST') return { ok: true }
  if (path.startsWith('/admin/sample/items/') && method === 'DELETE') {
    const itemId = path.split('/').at(-1)
    demoState.items = demoState.items.filter((item) => item.id !== itemId)
    return { ok: true }
  }
  if (path === '/admin/sample' && method === 'DELETE') {
    const removed = demoState.items.length
    demoState.items = []
    return { ok: true, removed }
  }
  if (path.startsWith('/admin/dataset')) {
    const query = new URLSearchParams(path.split('?')[1] || '')
    const page = Number(query.get('page') || 1)
    const pageSize = Number(query.get('pageSize') || 20)
    const start = (page - 1) * pageSize
    return { page, pageSize, total: demoState.conversations.length, items: structuredClone(demoState.conversations.slice(start, start + pageSize)) }
  }
  if (path === '/admin/updates') {
    const updates = demoState.items.flatMap((item, order) => demoState.users.map((user) => {
      const annotation = demoState.annotations.find((entry) => entry.itemId === item.id && entry.userId === user.uid)
      return { ...item, order: order + 1, itemId: item.id, userId: user.uid, annotatorName: user.displayName, annotatorEmail: user.email, status: annotation?.status || 'not-started', ratings: annotation?.ratings || { adequacy: null, fluency: null, semantic: null }, issueTags: annotation?.issueTags || [], notes: annotation?.notes || '', updatedAt: annotation ? new Date().toISOString() : '' }
    }))
    return { sampleSize: demoState.items.length, annotatorCount: demoState.users.length, updates }
  }
  if (path.startsWith('/admin/comparison/')) {
    const itemId = path.split('/').at(-1)
    return {
      item: structuredClone(demoSentences.find((item) => item.id === itemId)),
      annotations: structuredClone(demoState.annotations.filter((annotation) => annotation.itemId === itemId)),
    }
  }
  throw new Error(`Demo endpoint not implemented: ${method} ${path}`)
}

async function request(method, path, body) {
  if (isDemoMode) return mockRequest(method, path, body)
  const token = await auth?.currentUser?.getIdToken()
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed.')
  return payload
}

async function download(path) {
  if (isDemoMode) {
    const header = 'sample_order,item_id,status,adequacy,fluency,semantic_preservation\n'
    const rows = demoState.annotations.map((entry, index) => `${index + 1},${entry.itemId},${entry.status},${entry.ratings.adequacy || ''},${entry.ratings.fluency || ''},${entry.ratings.semantic || ''}`)
    return new Blob([header, ...rows.map((row) => `\n${row}`)], { type: 'text/csv' })
  }
  const token = await auth?.currentUser?.getIdToken()
  const response = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || 'The download could not be prepared.')
  }
  return response.blob()
}

export const api = {
  demoUser,
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  download,
}
