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

// Cafe tracks sound like an afternoon at a coffee shop with homework.
const CAFE_TREATS = [
  'Cold Brew', 'Oat Milk', 'Cinnamon', 'Honey', 'Mocha', 'Espresso', 'Matcha', 'Caramel', 'Vanilla', 'Hazelnut',
  'Chai', 'Cocoa', 'Maple', 'Almond', 'Flat White', 'Croissant', 'Biscotti', 'Brown Sugar', 'Cortado', 'Lemon Cake',
];
const CAFE_WORK = [
  'Notes', 'Chapters', 'Drafts', 'Margins', 'Revisions', 'Homework', 'Deadlines', 'Bookmarks', 'Highlights',
  'Footnotes', 'Flashcards', 'Pages', 'Sketches', 'Errands', 'Ideas', 'Index Cards', 'Lists', 'Outlines', 'Essays',
];

export function makeTitle(rng, style) {
  if (style === 'cafe') {
    const treat = rng.pick(CAFE_TREATS);
    const work = rng.pick(CAFE_WORK);
    return rng.chance(0.3) ? `${work} and ${treat}` : `${treat} ${work}`;
  }
  const first = rng.pick(FIRST);
  let second = rng.pick(SECOND);
  if (rng.chance(0.15)) return `${second}s of ${rng.pick(SECOND)}`.replace(/ss of/, 's of');
  return `${first} ${second}`;
}
