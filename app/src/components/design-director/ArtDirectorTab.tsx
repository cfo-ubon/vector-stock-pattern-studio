import type { ArtDirectorRecommendation } from '../../design-director/analysis/artDirector';

interface Props {
  review: ArtDirectorRecommendation[] | null;
}

/** Section 7 — AI Art Director pre-generation review. Pure display of
 * already-computed recommendations, each carrying its own "why" — no
 * recommendation is generated in this file. */
export function ArtDirectorTab({ review }: Props) {
  if (!review) {
    return (
      <div className="design-director-tab art-director-tab">
        <p>Create a Collection Plan first (see the Collection Planner tab).</p>
      </div>
    );
  }

  return (
    <div className="design-director-tab art-director-tab">
      <h2>AI Art Director — Pre-Generation Review</h2>
      <ul className="art-director-list">
        {review.map((rec) => (
          <li key={rec.id} className={`art-director-item art-director-item--${rec.severity}`}>
            <strong>{rec.message}</strong>
            <p>{rec.why}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
