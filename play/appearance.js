// Absorption is defined in linear RGB; the filter retints the existing ruby
// optical depths, including the darker carved heads, without replacing them.
export const GEM_PALETTES = Object.freeze([
  { name: 'Ruby', swatch: '#752337', absorption: [.35, 12, 9], light: [1, .025, .055] },
  { name: 'Sapphire', swatch: '#354777', absorption: [4.5, 2.6, 1.15], light: [.12, .24, .65] },
].map(palette => Object.freeze({ ...palette,
  absorption: Object.freeze(palette.absorption),
  filter: Object.freeze(palette.absorption.map((value, channel) => value / [.35, 12, 9][channel])),
  light: Object.freeze(palette.light),
})));

// Fixed across every board and piece set. Legacy browser color preferences are
// no longer read: near-side gems are ruby, far-side gems are sapphire.
export function createAppearanceState() {
  const sides = {
    white: Object.freeze({ palette: GEM_PALETTES[0] }),
    black: Object.freeze({ palette: GEM_PALETTES[1] }),
  };
  return Object.freeze({ resolve(side) { return sides[side]; } });
}
