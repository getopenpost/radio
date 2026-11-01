// The Converge mark: four rounded petals separated by a cross with a diamond at
// its centre. One quadrant is rasterised onto whole pixels and mirrored, so the
// gaps stay open and symmetric at chip size instead of closing under sampling.

export function convergeMask(size, gap = 2) {
  const quadrant = Math.floor((size - gap) / 2);
  const inside = (u, v) => {
    if (u < 4 || v < 4 || u > 60 || v > 60 || u + v > 92) return false;
    if (u < 24 && v < 24) return (u - 24) ** 2 + (v - 24) ** 2 <= 400;
    return true;
  };
  const q = [];
  for (let y = 0; y < quadrant; y++) {
    q.push([]);
    for (let x = 0; x < quadrant; x++) {
      let hits = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) hits += inside(4 + ((x + (sx + 0.5) / 4) / quadrant) * 56, 4 + ((y + (sy + 0.5) / 4) / quadrant) * 56);
      }
      q[y].push(hits >= 8);
    }
  }
  const mask = Array.from({ length: size }, () => new Array(size).fill(false));
  for (let y = 0; y < quadrant; y++) {
    for (let x = 0; x < quadrant; x++) {
      if (!q[y][x]) continue;
      for (const my of [y, size - 1 - y]) for (const mx of [x, size - 1 - x]) mask[my][mx] = true;
    }
  }
  return mask;
}
