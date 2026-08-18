const englishSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
const bengaliSegmenter = new Intl.Segmenter('bn', { granularity: 'sentence' })

function splitSentences(text, segmenter) {
  if (!text?.trim()) return []
  return [...segmenter.segment(text)].map((entry) => entry.segment.trim()).filter(Boolean)
}

export function sentenceId(conversationId, turnIndex, sentenceIndex) {
  return `${conversationId}_turn_${String(turnIndex + 1).padStart(2, '0')}_sentence_${String(sentenceIndex + 1).padStart(2, '0')}`
}

export function conversationIdFromSentenceId(id) {
  return id.match(/^(.*)_turn_\d+_sentence_\d+$/)?.[1] || null
}

export function deriveSentencePairs(conversation, conversationId) {
  const sentences = []
  const originalMessages = conversation.originalMessages || []
  const translatedMessages = conversation.translatedMessages || []
  const turnCount = Math.max(originalMessages.length, translatedMessages.length)

  for (let turnIndex = 0; turnIndex < turnCount; turnIndex += 1) {
    const original = originalMessages[turnIndex] || null
    const translated = translatedMessages[turnIndex] || null
    const originalSentences = splitSentences(original?.content || '', englishSegmenter)
    const translatedSentences = splitSentences(translated?.content || '', bengaliSegmenter)
    const sentenceCountsMatch = originalSentences.length > 0 && originalSentences.length === translatedSentences.length
    const pairs = sentenceCountsMatch
      ? originalSentences.map((originalText, sentenceIndex) => ({ originalText, translatedText: translatedSentences[sentenceIndex], sentenceIndex }))
      : [{ originalText: original?.content || '', translatedText: translated?.content || '', sentenceIndex: 0 }]

    for (const pair of pairs) {
      sentences.push({
        id: sentenceId(conversationId, turnIndex, pair.sentenceIndex),
        category: conversation.category,
        conversationId,
        sourceFile: conversation.sourceFile,
        sourceIndex: conversation.sourceIndex,
        turnIndex: turnIndex + 1,
        sentenceIndex: pair.sentenceIndex + 1,
        role: original?.role || translated?.role || 'unknown',
        originalText: pair.originalText,
        translatedText: pair.translatedText,
        segmentationMode: sentenceCountsMatch ? 'sentence-pair' : 'full-turn-fallback',
        alignmentWarning: !original || !translated || original.role !== translated.role || !sentenceCountsMatch,
        schemaVersion: 3,
      })
    }
  }
  return sentences
}
