import 'dotenv/config'
import { FieldValue } from 'firebase-admin/firestore'
import { assertFirebase, db } from '../server/firebase-admin.js'
import {
  mapRatingsToThreePoint,
  RATING_SCALE_MIGRATION,
  RATING_SCALE_VERSION,
} from '../server/rating-scale.js'

const apply = process.argv.includes('--apply')

assertFirebase()

const snapshot = await db.collection('annotations').get()
const pending = snapshot.docs.filter((document) => document.data().ratingScaleVersion !== RATING_SCALE_VERSION)
const summary = {
  mode: apply ? 'apply' : 'dry-run',
  scanned: snapshot.size,
  alreadyMigrated: snapshot.size - pending.length,
  toMigrate: pending.length,
  submitted: pending.filter((document) => document.data().status === 'submitted').length,
  drafts: pending.filter((document) => document.data().status === 'draft').length,
}

console.log(JSON.stringify(summary, null, 2))

if (!apply) {
  console.log('Dry run only. Re-run with --apply to update Firestore.')
  process.exit(0)
}

for (let start = 0; start < pending.length; start += 400) {
  const batch = db.batch()
  for (const document of pending.slice(start, start + 400)) {
    const annotation = document.data()
    const legacyRatings5 = annotation.legacyRatings5 || annotation.ratings || {}
    batch.set(document.ref, {
      legacyRatings5,
      ratings: mapRatingsToThreePoint(legacyRatings5),
      ratingScaleVersion: RATING_SCALE_VERSION,
      ratingScaleMigration: RATING_SCALE_MIGRATION,
      ratingScaleMigratedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  }
  await batch.commit()
}

console.log(`Migrated ${pending.length} annotation documents to the three-point scale.`)
