// Colour harmony for menswear, scored -2 (clash) .. +2 (classic pairing).

const NEUTRALS = new Set(['black', 'white', 'cream', 'grey', 'navy', 'beige', 'blue']);

const pairs = (list) => new Set(list.map(([a, b]) => [a, b].sort().join('+')));

const CLASSIC = pairs([
  ['navy', 'beige'], ['navy', 'white'], ['navy', 'grey'], ['navy', 'cream'], ['navy', 'light_blue'], ['navy', 'pink'],
  ['navy', 'yellow'], ['navy', 'brown'], ['navy', 'olive'],
  ['light_blue', 'beige'], ['light_blue', 'grey'], ['light_blue', 'white'], ['light_blue', 'blue'], ['light_blue', 'brown'],
  ['white', 'blue'], ['white', 'black'], ['white', 'beige'], ['white', 'olive'], ['white', 'grey'], ['white', 'brown'],
  ['white', 'green'], ['white', 'maroon'],
  ['black', 'grey'], ['black', 'beige'], ['black', 'olive'], ['black', 'cream'], ['black', 'maroon'],
  ['olive', 'beige'], ['olive', 'cream'], ['olive', 'brown'],
  ['brown', 'cream'], ['brown', 'blue'], ['brown', 'beige'],
  ['beige', 'green'], ['beige', 'maroon'], ['beige', 'pink'],
  ['maroon', 'grey'], ['maroon', 'cream'], ['maroon', 'navy'],
  ['pink', 'grey'], ['pink', 'blue'],
  ['green', 'cream'], ['green', 'black'], ['green', 'blue'],
  ['cream', 'blue'], ['grey', 'purple'], ['grey', 'yellow'], ['purple', 'beige'], ['yellow', 'blue'],
]);

const CLASH = pairs([
  ['navy', 'black'], ['red', 'pink'], ['green', 'red'], ['orange', 'pink'], ['maroon', 'red'], ['purple', 'yellow'],
  ['orange', 'purple'], ['brown', 'black'],
]);

export function colorScore(a, b) {
  if (!a || !b || a === 'multi' || b === 'multi') return 0;
  if (a === b) {
    if (a === 'blue') return -1; // double denim / blue on blue rarely works
    return NEUTRALS.has(a) ? 0 : -2; // tonal neutrals are fine, matching brights look like a uniform
  }
  const key = [a, b].sort().join('+');
  if (CLASSIC.has(key)) return 2;
  if (CLASH.has(key)) return -2;
  if (NEUTRALS.has(a) || NEUTRALS.has(b)) return 1;
  return -1;
}

const LOUD = new Set(['print', 'checks', 'stripes', 'embroidered']);
export const isLoud = (pattern) => LOUD.has(pattern);
