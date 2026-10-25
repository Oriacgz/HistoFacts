import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, RefreshCw, ShieldCheck, ChevronDown, Download, RotateCcw, Trash2, Layers3 } from 'lucide-react';
import './SessionMemory.css';
import { apiFetch } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';

export default function SessionMemory({ sessionId, generating = false, manager = false, draft = '', streamingText = '' }) {
  const { user } = useAuth();
  const owner = user?.id;
  const [sessions, setSessions] = useState([]);
  const [moreSessions, setMoreSessions] = useState(false);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(manager);
  const current = useRef(null);
  const root = manager ? selected : sessionId;
  const scope = `${owner}:${root}`;
  const serverBusy = result?.scope === scope && ['generating', 'compacting'].includes(result.data.status);
  useEffect(() => { current.current = scope; }, [scope]);
  const load = useCallback(async () => {
    if (!owner || !root || String(root).startsWith('temp-')) return;
    const requested = `${owner}:${root}`;
    try {
      const data = await apiFetch(`/api/notes/sessions/${root}/context`, { expectedUserId: owner });
      if (current.current === requested) { setResult({ scope: requested, data }); setError(''); }
    } catch (err) { if (current.current === requested) setError(err.message); }
  }, [owner, root]);
  useEffect(() => {
    let active = true;
    if (manager && owner) apiFetch('/api/notes/sessions', { expectedUserId: owner })
      .then(data => { if (active) { setSessions(data); setMoreSessions(data.length === 100); } }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [manager, owner]);
  useEffect(() => {
    const initial = setTimeout(load, 0);
    const timer = (generating || serverBusy || open || !manager) ? setInterval(load, generating || serverBusy ? 1200 : 5000) : null;
    window.addEventListener('focus', load);
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener('focus', load); };
  }, [load, generating, serverBusy, open, manager]);
  const data = result?.scope === scope ? result.data : null;
  async function action(kind, body) {
    const requested = scope;
    if (kind === 'delete' && !window.confirm('Delete this conversation and all its saved memory? This cannot be undone.')) return;
    if (kind === 'reset' && !window.confirm('Clear saved context for this session? Original notes remain readable, but earlier turns will no longer enter future prompts until you rebuild.')) return;
    if (kind === 'rebuild' && !window.confirm('Rebuild from the original conversation, including turns excluded by a previous memory reset?')) return;
    setBusy(true); setError('');
    try {
      await apiFetch(kind === 'delete' ? `/api/notes/sessions/${root}` : `/api/notes/sessions/${root}/context/${kind}`, {
        method: kind === 'delete' ? 'DELETE' : kind === 'settings' ? 'PATCH' : 'POST', expectedUserId: owner, body: JSON.stringify(body || {}),
      });
      if (current.current === requested) {
        if (kind === 'delete') { setSessions(previous => previous.filter(item => item.root_id !== root)); setSelected(''); setResult(null); }
        else await load();
      }
    } catch (err) { if (current.current === requested) setError(err.message); }
    finally { if (current.current === requested) setBusy(false); }
  }
  const pending = busy || data?.status === 'compacting';
  if (!manager) {
    const cap = data?.window?.limit || 150000;
    const live = new TextEncoder().encode(`${draft}${streamingText}`).length;
    const used = data?.enabled === false ? 0 : Math.min(cap, Math.max(0, (data?.window?.used || 0) + live));
    const fraction = used / cap;
    const label = error ? `Memory status unavailable: ${error}` : data?.enabled === false ? 'Session memory disabled' : pending ? 'Compacting session memory' : `Session memory: ${used.toLocaleString()} / ${cap.toLocaleString()} estimated tokens`;
    return <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-histo-copper"
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={cap} aria-valuenow={used}
      aria-valuetext={pending ? 'Compacting' : `${Math.round(fraction * 100)}% used`} aria-busy={pending}
      title={data?.enabled === false ? 'Session memory is disabled. Manage it in Profile Settings.' : `${label}. ${data?.policy?.auto_compact === false ? 'Automatic compaction is paused; recent context stays bounded. Compact manually in Profile Settings.' : 'Automatically compacts at 150K.'} The model prompt is separately bounded to its loaded capacity. Manage memory in Profile Settings.`}>
      <svg className={`h-9 w-9 -rotate-90 ${pending ? 'motion-safe:animate-spin' : ''}`} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.15" />
        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="87.965" strokeDashoffset={87.965 * (1 - (pending ? .72 : fraction))} className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500" />
      </svg>
      <span className="absolute text-[8px] font-ui font-semibold tabular-nums">{data?.enabled === false ? 'OFF' : pending ? '···' : `${Math.round(fraction * 100)}%`}</span>
    </div>;
  }
  const status = pending ? 'Updating memory' : data?.status === 'generating' ? 'Generating' : data?.enabled === false ? 'Paused' : data?.status === 'degraded' ? 'Recovered' : data?.version ? `Saved · v${data.version}` : 'Ready';
  return <section className="session-memory-panel" aria-label="AI Notes Memory">
    {manager && <><header className="memory-heading"><div className="memory-heading-icon"><Database size={21} aria-hidden="true" /></div><div><h3>AI Notes Memory</h3><p>A separate memory for every conversation.</p></div><span className="memory-private"><ShieldCheck size={13} aria-hidden="true" />Only you</span></header>
      <label className="memory-field">Conversation<div className="memory-select"><select value={selected} onChange={event => { setSelected(event.target.value); setBusy(false); }}><option value="">Choose a conversation</option>{sessions.map(s => <option key={s.root_id} value={s.root_id}>{s.title} · v{s.version || 0} · {s.status || 'ready'}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></div></label>
      {moreSessions && <button type="button" className="border rounded px-3 py-2" onClick={async () => {
        try {
          const next=await apiFetch(`/api/notes/sessions?offset=${sessions.length}`,{expectedUserId:owner});
          if (current.current.startsWith(`${owner}:`)) { setSessions(previous=>[...previous,...next.filter(item=>!previous.some(old=>old.root_id===item.root_id))]);setMoreSessions(next.length===100); }
        } catch (err) { setError(err.message); }
      }}>Load more conversations</button>}</>}
    {root && <button type="button" className="memory-status" aria-expanded={open} onClick={() => setOpen(!open)}>
      {pending ? <RefreshCw className="h-4 w-4 motion-safe:animate-spin" /> : <Database className="h-4 w-4" />}
      <span>Session overview</span><span role="status" className="memory-status-badge">{status}</span><ChevronDown size={15} className={open ? 'memory-chevron-open' : ''} aria-hidden="true" />
    </button>}
    {open && root && <div className="memory-details">
      <div className="memory-stats"><div><span>Turns compacted</span><strong>{data?.covered_ids?.length || 0}</strong></div><div><span>Saved summary</span><strong>{data ? `${(new TextEncoder().encode(JSON.stringify(data.summary || [])).length / 1024).toFixed(1)} KB` : '—'}</strong></div><div><span>Last updated</span><strong className="memory-date">{data?.updated_at ? new Date(data.updated_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '—'}</strong>{data?.updated_at && <small>{new Date(data.updated_at).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</small>}</div></div>
      {data?.session_enabled && data?.enabled === false && <p className="text-xs">Memory is paused for your account. Enable “Use saved session memory” in preferences to resume it.</p>}
      {data?.last_usage && <p>Estimated context: {data.last_usage.used.toLocaleString()} / {data.last_usage.limit.toLocaleString()} · {data.last_usage.recent_pairs} recent exchanges included{data.last_usage.history_reduced ? ' · older history reduced to fit' : ''}</p>}
      <p className="memory-note">{data?.retrieval_mode === 'dense' ? 'Dense + keyword recall' : 'Keyword recall'}<span aria-hidden="true"> · </span>Compaction uses no study credits.</p>
      {data?.dense_unavailable && <p className="text-xs">Dense recall is unavailable; lexical recall remains active.</p>}
      {data && <div className="memory-preferences">
        <label className="memory-toggle-row"><span><strong>Automatic compaction</strong><small>Organize older turns when the session buffer reaches 150K.</small></span><input aria-label="Automatically compact this session at 150K" type="checkbox" checked={data.policy?.auto_compact !== false} disabled={pending || generating} onChange={event=>action('settings',{auto_compact:event.target.checked})} /></label>
        <div className="memory-mode-row"><div><strong>Memory detail</strong><p>Choose how much context to keep.</p></div><label className="memory-select"><span className="sr-only">Memory mode</span><select value={data.policy?.mode || 'balanced'} disabled={pending || generating} onChange={event=>action('settings',{mode:event.target.value})}><option value="minimal">Minimal</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select><ChevronDown size={15} aria-hidden="true" /></label></div>
        <p className="memory-note">Rebuild to apply a new summary size. This does not change the model’s capacity.</p>
      </div>}
      <div className="memory-summary"><div className="memory-summary-heading"><h4><Layers3 size={16} aria-hidden="true" />Saved context</h4><span>{data?.summary?.length || 0} excerpts</span></div><p className="memory-note">Conversation excerpts, not independently verified facts.</p>
      <ul aria-label="Saved conversation excerpts">{data?.summary?.map((r, i) => <li key={`${r.turn_id}-${i}`}><div className="memory-excerpt-meta"><span>{r.role === 'user' ? 'You' : 'Assistant'}</span><span title={`Source turn ${r.turn_id}`}>Turn {r.turn_index != null ? r.turn_index + 1 : r.turn_id.slice(0, 8)}</span></div><p>{r.text}</p></li>)}</ul>
      {data && !data.summary?.length && <div className="memory-empty"><Database size={23} aria-hidden="true" /><p>No compacted memory yet.</p><small>Older turns will appear here after compaction.</small></div>}</div>
      <div className="memory-actions">
        <button type="button" disabled={pending || !data?.enabled || generating} onClick={() => action('compact')} className="memory-button memory-button-primary"><Layers3 size={15} aria-hidden="true" />Compact now</button>
        <button type="button" disabled={pending || !data?.enabled || generating} onClick={() => action('rebuild')} className="memory-button"><RefreshCw size={15} aria-hidden="true" />Rebuild from notes</button>
        <button type="button" disabled={pending || generating || !data} onClick={() => action('settings', { enabled: !(data?.session_enabled ?? data?.enabled) })} className="memory-button">{(data?.session_enabled ?? data?.enabled) ? 'Disable' : 'Enable'} memory</button>
        <button type="button" disabled={!data} className="memory-button" onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = `session-memory-${root}.json`; anchor.click(); URL.revokeObjectURL(url);
        }}><Download size={15} aria-hidden="true" />Export memory</button>
      </div>
      <footer className="memory-danger"><div><strong>Reset or remove</strong><p>Reset keeps your notes. Deleting a conversation removes them.</p></div><div><button type="button" disabled={pending || generating} onClick={() => action('reset')} className="memory-button"><RotateCcw size={14} aria-hidden="true" />Reset memory</button><button type="button" disabled={pending || generating} onClick={() => action('delete')} className="memory-button memory-button-danger"><Trash2 size={14} aria-hidden="true" />Delete conversation</button></div></footer>
    </div>}
    {!root && <div className="memory-empty"><Layers3 size={26} aria-hidden="true" /><p>Select a conversation to explore its memory.</p><small>Your saved context stays private, even when you share a note.</small></div>}
    {error && <p role="alert" className="text-red-600 mt-2">{error}</p>}
  </section>;
}
