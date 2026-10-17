# Night Oath · Champagne Gold

An independent selectable set built from fresh instances of the current Ruby
factories. Ruby sources, original geometry and gem optics are not patched.

- King: solid gold cross with ruby insets on both faces, crown seats and arch caps.
- Queen: six folded gold leaf seats with exposed ruby terminals.
- Bishop: tapered metal lips on both faces of the diagonal opening.
- Knight: a folded gold mane with three low ribs, plus solid champagne-gold
  eyes on both cheeks. A gently domed polish catches light
  across the filled, pointed eye shape, improving readability from a distance.
- Rook: gold merlons taken from the actual six-notch crown; the well stays open.
- Pawn: a shallow gold bowl below the original faceted head.

Neutral champagne gold pairs with both the existing ruby and sapphire palettes.
It uses a conductor material (`metalness: 1`, no emission), a dedicated HDR
studio captured into a 512px cubemap, mirror edges and a quieter polished base. Smooth
turned normals and softened bevels keep reflected light continuous. Fittings
are merged into one metal draw per chessman, with the five finishes carried by
vertex attributes, and shared across table instances by the existing cache.
Narrow light cards and low surface roughness preserve sharp, moving reflections;
the darker recesses retain depth without making the identifying metalwork dull.
Gem colors follow the shared fixed pairing: near-side ruby and far-side sapphire.
The board's lights and the metal finish remain independent.

Preview: `/pieces/night-oath/` · comparison: `/pieces/night-oath/collection.html`
· board: `/?pieces=night-oath`. Drag the comparison to inspect moving reflections.

Check: `node --test play/*.test.js pieces/ruby/*.test.js pieces/night-oath/*.test.js`
and `npm run build`.
