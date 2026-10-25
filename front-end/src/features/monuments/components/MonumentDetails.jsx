export default function MonumentDetails({ monument: m }) {
  return <section className="monument-details" aria-label={`${m.name} historical information`}>
    <div><p className="monument-eyebrow">THE STORY BEHIND THE STONE</p><h2>{m.name}</h2><p className="monument-summary">{m.summary}</p></div>
    <dl><div><dt>Location</dt><dd>{m.location}</dd></div><div><dt>Historical context</dt><dd>{m.civilization}</dd></div><div><dt>Period</dt><dd>{m.date}</dd></div></dl>
    <p className="monument-date-note">{m.dateNote}</p>
    <div className="monument-source-row">{m.sources.map(s=><a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a>)}</div>
    <details className="monument-credits"><summary>About this model & credits</summary>
      <p><strong>{m.representation}.</strong> {m.disclaimer}</p>
      <p>Original model and poster: {m.attribution.creator} · Revision {m.attribution.revision} · <a href={m.attribution.licenseUrl} target="_blank" rel="noopener noreferrer">{m.attribution.license} license</a>.</p>
      <p>Reproducible source: <code>{m.attribution.source}</code>. Historical source links describe the real monument, not the accuracy of this model.</p>
    </details>
  </section>;
}
