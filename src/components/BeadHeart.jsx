// A perler-bead heart, 9 x 8 pegs. Beads drop onto the board once, row by row.
const ROWS = [
  '.##...##.',
  '####.####',
  '###+#####',
  '#########',
  '.#######.',
  '..####=..',
  '...###...',
  '....#....',
];

export default function BeadHeart({ size = 12, className = '' }) {
  return (
    <div
      className={`grid gap-[2px] ${className}`}
      style={{ gridTemplateColumns: `repeat(9, ${size}px)` }}
      aria-hidden="true"
    >
      {ROWS.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === '.' ? (
            <span key={`${x}-${y}`} style={{ width: size, height: size }} />
          ) : (
            <span
              key={`${x}-${y}`}
              className={`bead animate-bead-place ${c === '+' ? 'bead-shine' : c === '=' ? 'bead-deep' : ''}`}
              style={{ '--b': `${size}px`, animationDelay: `${(y * 9 + x) * 18}ms` }}
            />
          )
        )
      )}
    </div>
  );
}
