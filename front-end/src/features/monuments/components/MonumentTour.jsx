export default function MonumentTour({ steps, step, complete, enabled, onStart, onStep, onExit, onFinish }) {
  return <section className="monument-tour" aria-label="Guided monument tour">
    <div><span className="monument-eyebrow">A SHORT WALK THROUGH HISTORY</span><h3>Take a guided tour</h3>
      <p aria-live="polite">{step !== null ? `Stop ${step + 1} of ${steps.length}: ${steps[step].title}` : complete ? 'Tour complete. Keep exploring, or take another look.' : `${steps.length} architectural details. Your pace, your perspective.`}</p></div>
    {step === null ? <button className="monument-button" disabled={!enabled} onClick={onStart}>{complete?'Restart tour':'Start guided tour'}</button> :
      <div className="monument-tour-actions"><button className="monument-button secondary" disabled={step===0} onClick={()=>onStep(step-1)}>Previous stop</button>
        {step===steps.length-1 ? <button className="monument-button" onClick={onFinish}>Finish tour</button> : <button className="monument-button" onClick={()=>onStep(step+1)}>Next stop</button>}
        <button className="monument-button secondary" onClick={onExit}>Exit tour</button></div>}
  </section>;
}
