// Score on the fixed bead-size ramp: a bigger bead is a better-loved show.
const scoreBeadSize = (score) => (score >= 85 ? 12 : score >= 75 ? 9 : 6);

export default function ScoreBead({ score, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 tabular ${className}`} title={`Score ${score}`}>
      <span className="inline-flex w-3 justify-center">
        <span className="bead" style={{ '--b': `${scoreBeadSize(score)}px` }} />
      </span>
      {score}
    </span>
  );
}
