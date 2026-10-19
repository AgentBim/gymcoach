// How an athlete said a session felt (workout_feedback.emoji_rating).
const FEEL = {
  easy: { label: 'Too easy', tone: 'blue' },
  good: { label: 'Good', tone: 'teal' },
  hard: { label: 'Challenging', tone: 'amber' },
  veryhard: { label: 'Very hard', tone: 'coral' },
}
export function feelOf(emoji) {
  return FEEL[emoji] || null
}
