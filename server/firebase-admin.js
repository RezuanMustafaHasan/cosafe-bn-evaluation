import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function credentialsFromEnvironment() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) return null
  return { projectId, clientEmail, privateKey }
}

const credentials = credentialsFromEnvironment()
const firebaseApp = getApps()[0] || (credentials
  ? initializeApp({ credential: cert(credentials) })
  : null)

export const adminAuth = firebaseApp ? getAuth(firebaseApp) : null
export const db = firebaseApp ? getFirestore(firebaseApp) : null

export function assertFirebase() {
  if (!adminAuth || !db) {
    const error = new Error('Firebase Admin is not configured on the server.')
    error.status = 503
    throw error
  }
}
