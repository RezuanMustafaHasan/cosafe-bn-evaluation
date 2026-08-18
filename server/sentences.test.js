import test from 'node:test'
import assert from 'node:assert/strict'
import { conversationIdFromSentenceId, deriveSentencePairs } from './sentences.js'

const baseConversation = {
  category: 'privacy_violation',
  sourceFile: 'privacy_violation.json',
  sourceIndex: 1,
}

test('deriveSentencePairs creates one aligned unit per matching sentence', () => {
  const pairs = deriveSentencePairs({
    ...baseConversation,
    originalMessages: [{ role: 'user', content: 'First sentence. Second sentence!' }],
    translatedMessages: [{ role: 'user', content: 'প্রথম বাক্য। দ্বিতীয় বাক্য!' }],
  }, 'privacy_violation_001')
  assert.equal(pairs.length, 2)
  assert.equal(pairs[0].alignmentWarning, false)
  assert.equal(pairs[1].sentenceIndex, 2)
  assert.equal(conversationIdFromSentenceId(pairs[1].id), 'privacy_violation_001')
})

test('deriveSentencePairs preserves a full turn when sentence counts differ', () => {
  const pairs = deriveSentencePairs({
    ...baseConversation,
    originalMessages: [{ role: 'assistant', content: 'One. Two.' }],
    translatedMessages: [{ role: 'assistant', content: 'একটি বাক্য।' }],
  }, 'privacy_violation_002')
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].segmentationMode, 'full-turn-fallback')
  assert.equal(pairs[0].alignmentWarning, true)
  assert.equal(pairs[0].originalText, 'One. Two.')
})
