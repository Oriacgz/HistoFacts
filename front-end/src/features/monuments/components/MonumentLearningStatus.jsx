export default function MonumentLearningStatus({learning,monument}) {
  const {favorite,tour}=learning;
  const saved=learning.favorites.some(row=>row.monument_id===monument.id);
  const completed=learning.completions.some(row=>row.monument_id===monument.id && row.tour_revision===monument.tour_revision);
  const tourHere=tour.variables?.monumentId===monument.id;
  return <div className="monument-learning-actions">
    <button className="monument-button secondary" disabled={!learning.ready||favorite.isPending} aria-pressed={saved}
      onClick={()=>favorite.mutate({monumentId:monument.id,saved:!saved})}>{favorite.isPending?'Saving…':saved?'Remove from saved':'Save monument'}</button>
    <span className="monument-learning-badge" role="status">{completed?'✓ Tour completion saved':tourHere&&tour.isPending?'Saving tour completion…':'Complete the tour to save your progress.'}</span>
    {favorite.isError && <p role="alert">Could not update saved monuments. {favorite.error.message} Try the save button again.</p>}
    {tourHere&&tour.isError && <p role="alert">Your tour finished, but its completion was not saved. {tour.error.message} <button className="monument-button secondary" onClick={()=>tour.mutate({monumentId:monument.id,tourRevision:monument.tour_revision})}>Retry saving completion</button></p>}
  </div>;
}
