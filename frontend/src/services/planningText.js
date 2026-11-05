const COUNTED_DAYS = [
  ['poniedziałek', 'poniedziałki', 'poniedziałków'],
  ['wtorek', 'wtorki', 'wtorków'],
  ['środę', 'środy', 'śród'],
  ['czwartek', 'czwartki', 'czwartków'],
  ['piątek', 'piątki', 'piątków'],
  ['sobotę', 'soboty', 'sobót'],
  ['niedzielę', 'niedziele', 'niedziel'],
];

const hour = value => `${String(value).padStart(2, '0')}:00`;

function countedDay(weekday, count) {
  const ending = count % 10;
  const lastTwo = count % 100;
  const form = count === 1 ? 0 : ending >= 2 && ending <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? 1 : 2;
  return `${count} ${COUNTED_DAYS[weekday][form]}`;
}

export function patternHistoryText(pattern) {
  return `Analiza objęła ${countedDay(pattern.weekday, pattern.observed_days)} z co najmniej jednym zapisanym treningiem. W ${pattern.hits} z nich między pierwszym a ostatnim treningiem była wolna przerwa ${hour(pattern.start_hour)}–${hour(pattern.end_hour)}.`;
}
