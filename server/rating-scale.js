export const RATING_SCALE_VERSION = 3
export const RATING_CATEGORIES = [1, 2, 3]
export const RATING_SCALE_MIGRATION = '1-2_to_1__3_to_2__4-5_to_3'

export function mapRatingToThreePoint(rating) {
  if (rating === null || rating === undefined) return null
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new TypeError(`Rating must be an integer from 1 to 5; received ${rating}.`)
  }
  if (rating <= 2) return 1
  if (rating === 3) return 2
  return 3
}

export function mapRatingsToThreePoint(ratings = {}) {
  return Object.fromEntries(
    ['adequacy', 'fluency', 'semantic'].map((criterion) => [
      criterion,
      mapRatingToThreePoint(ratings[criterion]),
    ]),
  )
}
