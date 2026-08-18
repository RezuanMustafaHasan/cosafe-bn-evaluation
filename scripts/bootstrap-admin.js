import 'dotenv/config'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, assertFirebase, db } from '../server/firebase-admin.js'

assertFirebase()
const [email, password, ...nameParts] = process.argv.slice(2)
const displayName = nameParts.join(' ') || 'Study administrator'

if (!email || !password || password.length < 8) {
  console.error('Usage: npm run firebase:admin -- admin@example.com secure-password "Admin name"')
  process.exit(1)
}

let user
try {
  user = await adminAuth.getUserByEmail(email)
  await adminAuth.updateUser(user.uid, { password, displayName, disabled: false })
} catch (error) {
  if (error.code !== 'auth/user-not-found') throw error
  user = await adminAuth.createUser({ email, password, displayName })
}

await adminAuth.setCustomUserClaims(user.uid, { role: 'admin' })
await db.collection('users').doc(user.uid).set({
  email,
  displayName,
  role: 'admin',
  disabled: false,
  createdAt: FieldValue.serverTimestamp(),
}, { merge: true })

console.log(`Admin ready: ${email} (${user.uid})`)
