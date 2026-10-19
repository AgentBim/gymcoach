// Quick-start messages for the composer, from the mockup. {first} is the
// athlete's first name; context decides which set to offer.
export function templatesFor(kind, athlete, extra = {}) {
  const first = (athlete?.full_name || '').split(' ')[0] || 'there'
  const sets = {
    message: [
      ['Check in', `Hi ${first}, how are you feeling about this week so far?`],
      ['Great week', `Great work this week, ${first}. Keep it rolling.`],
      ['Heads up', `Heads up: I adjusted part of your week. Open your portal to see what moved.`],
    ],
    nudge: [
      ['Streak nudge', `${extra.workout || 'Today\'s session'} is waiting for you today.${extra.streak ? ` Keep the ${extra.streak}-day streak going!` : ''}`],
      ['Short', 'Quick reminder about today. You have got this.'],
      ['Move it?', `If today is not working, tell me and I will move ${extra.workout || 'it'} to tomorrow.`],
    ],
    missed: [
      ['Check in', `Hi ${first}, I noticed you missed some sessions. Everything okay? Happy to lighten this week if that helps.`],
      ['Fresh start', 'No stress about the missed days. Pick it back up today and we will rebuild from there.'],
      ['Call', 'Can we do a quick call tomorrow? I want to rework your week around your schedule.'],
    ],
    reply: [
      ['Thanks', `Thanks for the note, ${first}. Nice work.`],
      ['Ask more', 'Where exactly did you feel it, and does it hurt outside of that exercise?'],
      ['Adjust', 'Let us adjust that for now. I will update your week and you can tell me how it feels.'],
    ],
    inbox: [
      ['Nice', 'Love it. Tell me how it goes.'],
      ['Good work', 'Strong session. Keep the same loads next week.'],
      ['Check in', `How are you feeling, ${first}?`],
    ],
  }
  return (sets[kind] || sets.message).map(([label, text]) => ({ label, text }))
}
