// What the plane's banner says: short encouragements in the voice of a friend
// working beside you, plus lines for the hour, the day of the week, the turn
// of a month, the season and a few holidays, so the sky seems to know what
// day it is. Only the pixel font's characters: A-Z, 0-9 and . , ! ? ' -
import { localTime, seasonOf } from './clock.js';

export const PHRASES = [
  'KEEP GOING', 'ONE THING AT A TIME', 'YOU GOT THIS', 'SMALL STEPS DAILY', 'STAY CURIOUS', 'DEEP WORK MODE',
  'DONE IS BETTER THAN PERFECT', 'DRINK SOME WATER', 'STRETCH YOUR LEGS', 'TAKE A DEEP BREATH', 'SHIP IT',
  'PROGRESS, NOT PERFECTION', 'BUILD SOMETHING GOOD', 'FOCUS ON THE NEXT STEP', 'ALMOST THERE', 'BE KIND TO YOURSELF',
  'THE WORK IS THE REWARD', 'KEEP IT SIMPLE', 'POST IT, THEN POLISH IT', 'ONE MORE PAGE',
  'OPEN THE FILE. THAT IS STEP ONE', 'ONE TASK, FULL ATTENTION', 'SMALL WINS ADD UP', 'SHOW UP, EVEN SLOWLY',
  'THE HARD PART IS STARTING', 'FUTURE YOU SAYS THANKS', 'FOCUS NOW, FREE LATER', 'NO RUSH, JUST PROGRESS',
  'YOUR PACE IS THE RIGHT PACE', 'LESS SCROLLING, MORE BUILDING', 'PHONE FACE DOWN, LET\'S WORK',
  'TODAY IS THE DAY FOR THAT ONE TASK', 'EFFORT TODAY, EASE TOMORROW', 'BRICK BY BRICK',
  'MAKE IT WORK, THEN MAKE IT GOOD', 'MESSY FIRST DRAFTS ARE ALLOWED', 'TWENTY MINUTES, THEN A BREAK',
  'STEADY BEATS FAST', 'YOU\'RE DOING BETTER THAN YOU THINK', 'CONSISTENCY IS QUIET MAGIC', 'BREATHE, THEN BEGIN',
  'GOOD THINGS TAKE REPS', 'LET\'S WORK SIDE BY SIDE', 'TRY BEFORE YOU DOUBT', 'DOUBT LESS, DRAFT MORE',
  'DISTRACTIONS CAN WAIT', 'SAVE YOUR WORK, THEN KEEP GOING', 'START UGLY, FINISH PROUD', 'TODAY COUNTS',
  'REST IS PART OF THE PLAN', 'ONE CHECKBOX AT A TIME', 'KEEP GOING, YOU\'RE CLOSE', 'QUIET FOCUS, LOUD RESULTS',
  'DREAM BIG, START SMALL', 'WORK NOW, WANDER LATER', 'FOCUS ON, NOTIFICATIONS OFF', 'THE FOX BELIEVES IN YOU',
  'NOBODY GETS IT RIGHT THE FIRST TIME', 'A LITTLE BETTER THAN YESTERDAY', 'FINISH WHAT YOU STARTED',
  'GOOD ENOUGH IS A GREAT START', 'PICK ONE, THEN GO', 'THE PLAN IS TO BEGIN',
];

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

const HOURS = [
  [5, 11, ['GOOD MORNING, LET\'S BEGIN', 'COFFEE FIRST, THEN THE HARD PART', 'FRESH DAY, FRESH PAGE', 'START WITH THE EASY WIN', 'MORNING MINDS BUILD BIG THINGS']],
  [12, 14, ['LUNCH, THEN BACK TO IT', 'HALF THE DAY DONE, NICE']],
  [14, 18, ['SECOND WIND, LET\'S GO', 'STAY WITH IT A LITTLE LONGER', 'AFTERNOON FOCUS, NO RUSH', 'ONE MORE PUSH BEFORE SUNSET']],
  [18, 23, ['WRAP UP ONE LAST THING', 'GOOD WORK TODAY', 'EASY EVENING, STEADY HANDS', 'WRITE DOWN TOMORROW\'S FIRST STEP']],
  [23, 29, ['LATE SHIFT, QUIET MIND', 'THE NIGHT IS YOURS', 'SLEEP IS PART OF THE WORK', 'ONE MORE, THEN REST', 'NIGHT OWLS SHIP TOO']],
];

const WEEKDAYS = {
  1: ['NEW WEEK, CLEAN SLATE', 'MONDAY, ONE STEP AT A TIME', 'SET THE TONE FOR THE WEEK'],
  3: ['HALFWAY THROUGH THE WEEK, KEEP THE PACE', 'MIDWEEK, STILL HERE, STILL GOING'],
  5: ['FINISH THE WEEK STRONG', 'FRIDAY, CLOSE THE LOOPS', 'ONE LAST PUSH, THEN THE WEEKEND'],
  6: ['WEEKEND PROJECTS COUNT TOO', 'SATURDAY, BUILD FOR FUN'],
  0: ['SLOW SUNDAY, SOFT FOCUS', 'SUNDAY RESET, GENTLE START'],
};

const SEASONS = {
  autumn: ['COZY SEASON, DEEP FOCUS', 'AUTUMN IS FOR FOCUS AND REST', 'SWEATER WEATHER, STEADY WORK', 'FALLING LEAVES, RISING GOALS'],
  winter: ['WARM DRINK, WARM MIND', 'SHORT DAYS, LONG FOCUS', 'COLD OUTSIDE, CALM INSIDE', 'BLANKET ON, BRAIN ON'],
  spring: ['SPRING CLEAN YOUR TO-DO LIST', 'NEW LEAVES, NEW HABITS', 'LONGER DAYS, BIGGER IDEAS'],
  summer: ['SUMMER HOURS, STILL SHOWING UP', 'STAY COOL, STAY FOCUSED', 'SUNNY DAYS, STEADY WORK'],
};

/** Lines for the date and hour in `timeZone`, most specific first. */
export function phrasesFor(date, timeZone = 'Europe/Lisbon') {
  const t = localTime(date, timeZone);
  const month = MONTHS[t.month - 1];
  const daysInMonth = new Date(Date.UTC(t.year, t.month, 0)).getUTCDate();
  const weekday = new Date(Date.UTC(t.year, t.month - 1, t.day)).getUTCDay();
  const special = [];
  if (t.month === 10 && t.day >= 24) special.push('SPOOKY SEASON, STEADY FOCUS', 'NO TRICKS, JUST GOOD WORK', 'FINISH A TASK, EARN A TREAT');
  if (t.month === 12 && t.day >= 20 && t.day <= 26) special.push('COZY DAYS, GENTLE GOALS', 'HAPPY HOLIDAYS FROM THE FOX', 'REST WELL, YOU EARNED IT');
  if ((t.month === 12 && t.day === 31) || (t.month === 1 && t.day <= 3)) special.push('NEW YEAR, START SMALL', 'HAPPY NEW YEAR, ONE STEP AT A TIME');
  if (t.day <= 3) special.push(`HELLO ${month}, LET'S MAKE IT COUNT`, `NEW MONTH, NEW PAGE`);
  if (t.day >= daysInMonth - 1) special.push(`FINISH ${month} STRONG`, `LAST DAYS OF ${month}, KEEP GOING`);
  const hour = t.hours < 5 ? t.hours + 24 : t.hours;
  const timely = HOURS.filter(([from, to]) => hour >= from && hour < to).flatMap(([, , lines]) => lines);
  return { special, timely: [...timely, ...(WEEKDAYS[weekday] ?? []), ...SEASONS[seasonOf(t.month)]] };
}

/** One banner line: often something about today, otherwise from the general list. */
export function pickPhrase(rng, date, timeZone) {
  const { special, timely } = phrasesFor(date, timeZone);
  const roll = rng.float(0, 1);
  if (special.length && roll < 0.35) return rng.pick(special);
  if (roll < 0.6) return rng.pick(timely);
  return rng.pick(PHRASES);
}
