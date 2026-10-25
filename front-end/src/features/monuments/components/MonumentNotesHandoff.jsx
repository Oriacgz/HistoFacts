import {useState} from 'react';
import {Link} from 'react-router-dom';
import {getMonumentStudy} from '../studyHandoff';

export default function MonumentNotesHandoff({monumentId,onUsePrompt,onDismiss,busy,hasDraft}) {
  const study=getMonumentStudy(monumentId);
  const [accepted,setAccepted]=useState(false);
  if (!study) return null;
  return <section aria-label="Monument study prompt" className="m-4 sm:m-8 p-5 border border-histo-gold/40 rounded-md bg-histo-gold/10 text-histo-dark">
    <h2 className="font-display text-xl mb-2">Study {study.name}</h2>
    <p className="font-ui text-sm leading-relaxed mb-3">{study.notesPrompt}</p>
    <p className="font-ui text-xs leading-relaxed mb-3" role="status">{accepted?'The prompt is ready in the composer. Review it and send when ready.':busy?'Finish or stop the current response before preparing a new note.':hasDraft?'Using this prompt starts a new note and replaces the current draft and attachments. Your saved notes remain in the library.':'Prepare this prompt in a new note, then review it before sending.'}</p>
    <div className="flex flex-wrap gap-3 items-center font-ui text-xs">
      {!accepted&&<button type="button" disabled={busy} onClick={()=>{onUsePrompt(study.notesPrompt);setAccepted(true);}} className="px-4 py-3 rounded bg-histo-dark text-histo-paper disabled:opacity-50 cursor-pointer">Use in a new note</button>}
      <Link to={`/monuments?monument=${study.id}`} className="underline underline-offset-4">Back to monument</Link>
      <button type="button" onClick={onDismiss} className="px-3 py-3 border border-histo-dark/20 rounded cursor-pointer">Dismiss suggestion</button>
    </div>
  </section>;
}
