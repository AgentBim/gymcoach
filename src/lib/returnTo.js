// Accept only coach routes in this app; never navigate to a supplied origin.
export function coachReturnTo(value) {
  if (typeof value !== 'string' || !/^\/(today|plan|athletes|inbox)(?:[/?#]|$)/.test(value) || /[\\\u0000-\u0020]/.test(value)) return '/today'
  return value
}
