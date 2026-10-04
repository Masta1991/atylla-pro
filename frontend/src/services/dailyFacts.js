import facts from '../data/dailyFacts.json';

const DAY = 86400000;
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
});
const byDate = new Map(facts.map(fact => [fact.date, fact]));
const firstDate = facts[0].date;
const lastDate = facts[facts.length - 1].date;
const cycleStart = Date.parse(`${lastDate}T00:00:00Z`) + DAY;

export function warsawDateKey(now = new Date()) {
  const parts = Object.fromEntries(dateFormatter.formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getDailyFact(now = new Date()) {
  const day = warsawDateKey(now);
  // One-day preview explicitly requested for release day; expires at Warsaw midnight.
  if (day === '2026-10-04') return facts[1];
  const timestamp = Date.parse(`${day}T00:00:00Z`);
  if (day < firstDate || new Date(timestamp).getUTCDay() === 0) return null;
  if (day <= lastDate) return byDate.get(day) || null;

  // Count calendar days in UTC, not elapsed local hours (DST days are 23/25h).
  const elapsed = Math.round((timestamp - cycleStart) / DAY);
  const weeks = Math.floor(elapsed / 7);
  let index = weeks * 6;
  const startWeekday = new Date(cycleStart).getUTCDay();
  for (let i = 0; i < elapsed % 7; i++) {
    if ((startWeekday + i) % 7 !== 0) index++;
  }
  return facts[index % facts.length];
}

export function millisecondsUntilNextFactDay(now = new Date()) {
  const current = warsawDateKey(now);
  // Find the next Warsaw midnight, including summer/winter time transitions.
  let low = now.getTime(), high = low + 27 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (warsawDateKey(new Date(middle)) === current) low = middle;
    else high = middle;
  }
  return high - now.getTime();
}
