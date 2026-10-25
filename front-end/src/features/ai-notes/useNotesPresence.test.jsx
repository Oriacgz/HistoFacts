// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {apiFetch} from '../../api/client';
import useNotesPresence from './useNotesPresence';

let account={id:'viewer'},container,root,shown=true,focused=true;
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({user:account})}));
vi.mock('../../api/client',()=>({apiFetch:vi.fn()}));
function Probe(){useNotesPresence();return null;}
const statuses=()=>apiFetch.mock.calls.map(([,options])=>JSON.parse(options.body).active);
beforeEach(()=>{
  vi.useFakeTimers();account={id:'viewer'};shown=true;focused=true;
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  vi.spyOn(document,'visibilityState','get').mockImplementation(()=>shown?'visible':'hidden');
  vi.spyOn(document,'hasFocus').mockImplementation(()=>focused);
  apiFetch.mockReset().mockResolvedValue({status:'updated'});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();vi.restoreAllMocks();});

it('heartbeats only while visible and focused, then releases on route exit',async()=>{
  await act(async()=>root.render(<Probe/>));expect(statuses()).toEqual([true]);
  await act(async()=>vi.advanceTimersByTimeAsync(15000));expect(statuses()).toEqual([true,true]);
  shown=false;await act(async()=>document.dispatchEvent(new Event('visibilitychange')));expect(statuses().at(-1)).toBe(false);
  const calls=apiFetch.mock.calls.length;await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(apiFetch.mock.calls).toHaveLength(calls);
  shown=true;await act(async()=>document.dispatchEvent(new Event('visibilitychange')));expect(statuses().at(-1)).toBe(true);
  focused=false;await act(async()=>window.dispatchEvent(new Event('blur')));expect(statuses().at(-1)).toBe(false);
  await act(async()=>root.render(null));expect(statuses().at(-1)).toBe(false);expect(vi.getTimerCount()).toBe(0);
});

it('orders release after an in-flight heartbeat and binds requests to the account',async()=>{
  let resolve;apiFetch.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  await act(async()=>root.render(<Probe/>));
  await act(async()=>root.render(null));expect(apiFetch).toHaveBeenCalledTimes(1);
  await act(async()=>resolve({}));expect(statuses()).toEqual([true,false]);
  expect(apiFetch.mock.calls.every(([,options])=>options.expectedUserId==='viewer' && options.keepalive)).toBe(true);
});

it('starts presence for the new account on login change',async()=>{
  await act(async()=>root.render(<Probe/>));
  account={id:'second'};await act(async()=>root.render(<Probe/>));
  expect(apiFetch.mock.calls.at(-1)[1].expectedUserId).toBe('second');
  expect(statuses()).toEqual([true,false,true]);
});

it('gives separate mounted tabs independent presence identifiers',async()=>{
  await act(async()=>root.render(<><Probe/><Probe/></>));
  const ids=apiFetch.mock.calls.map(([,options])=>JSON.parse(options.body).tab_id);
  expect(new Set(ids).size).toBe(2);
});
