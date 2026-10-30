// Calm, evocative track titles from a seed.
const FIRST = [
  'Quiet', 'Late', 'Low', 'Slow', 'Deep', 'Amber', 'Soft', 'Still', 'Distant', 'Warm', 'Hollow', 'Midnight',
  'Paper', 'Glass', 'Copper', 'Velvet', 'Silent', 'Pale', 'Drifting', 'Faded', 'Northern', 'Hidden', 'Gentle',
  'Second', 'Last', 'Open', 'Blue', 'Grey', 'Ember', 'Lunar', 'Inner', 'Long', 'Small', 'Night', 'Morning',
];
const SECOND = [
  'Current', 'Ledger', 'Harbor', 'Signal', 'Draft', 'Orbit', 'Tide', 'Archive', 'Margin', 'Lantern', 'Transit',
  'Meridian', 'Field', 'Window', 'River', 'Engine', 'Outline', 'Hours', 'Weather', 'Static', 'Garden', 'Pulse',
  'Notes', 'Corridor', 'Shoreline', 'Circuit', 'Atlas', 'Season', 'Thread', 'Rooms', 'Lights', 'Fog', 'Avenue',
  'Echo', 'Interval', 'Patterns', 'Satellite', 'Workshop', 'Platform', 'Postcard', 'Reply', 'Schedule',
];

export function makeTitle(rng) {
  const first = rng.pick(FIRST);
  let second = rng.pick(SECOND);
  if (rng.chance(0.15)) return `${second}s of ${rng.pick(SECOND)}`.replace(/ss of/, 's of');
  return `${first} ${second}`;
}
