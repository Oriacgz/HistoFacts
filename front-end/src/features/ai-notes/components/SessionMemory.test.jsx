// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
import { apiFetch } from '../../../api/client';
import SessionMemory from './SessionMemory';
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('../../../api/client', () => ({ apiFetch: vi.fn() }));

it('does not flash the previous session memory or apply its late response', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let resolveA;
  apiFetch.mockImplementation(path => path.includes('/a/') ? new Promise(resolve => { resolveA = resolve; }) : Promise.resolve({root_id:'b',version:2,enabled:true,status:'compacted',window:{used:75000,limit:150000},summary:[{turn_id:'b-turn',role:'user',text:'Private B memory'}]}));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<SessionMemory sessionId="a" />); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve,10)); });
    await act(async () => { root.render(<SessionMemory sessionId="b" />); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve,10)); });
    await act(async () => { resolveA({root_id:'a',version:7,enabled:true,status:'compacted',summary:[{turn_id:'a-turn',role:'user',text:'Private A memory'}]}); });
    expect(container.textContent).toContain('50%');
    expect(container.querySelector('[role=progressbar]').getAttribute('aria-valuemax')).toBe('150000');
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).not.toContain('Private A memory');
    expect(apiFetch.mock.calls.every(([, options]) => options.expectedUserId === 'owner')).toBe(true);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it('keeps reset, disable and export actions in the profile memory manager', async () => {
  apiFetch.mockImplementation(path => path === '/api/notes/sessions'
    ? Promise.resolve([{root_id:'b',title:'Session B'}])
    : Promise.resolve({root_id:'b',version:1,enabled:true,status:'compacted',summary:[]}));
  const container=document.createElement('div');document.body.append(container);
  const root=createRoot(container);
  try {
    await act(async () => root.render(<SessionMemory manager />));
    await act(async () => { const select=container.querySelector('select');select.value='b';select.dispatchEvent(new Event('change',{bubbles:true})); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve,10)); });
    expect(container.textContent).toContain('Reset memory');
    expect(container.textContent).toContain('Disable memory');
    expect(container.textContent).toContain('Export memory');
  } finally { await act(async () => root.unmount());container.remove(); }
});

it('disables memory without resetting and saves per-session mode and compaction options', async () => {
  let enabled=true;
  const previousConfirm=window.confirm;
  const confirm=vi.fn();window.confirm=confirm;
  apiFetch.mockImplementation((path,options={})=>{
    if(path==='/api/notes/sessions') return Promise.resolve([{root_id:'b',title:'Session B'}]);
    if(options.method==='PATCH') { const change=JSON.parse(options.body);if('enabled' in change) enabled=change.enabled; }
    return Promise.resolve({root_id:'b',enabled,session_enabled:enabled,status:'ready',summary:[],policy:{auto_compact:true,mode:'balanced'}});
  });
  const container=document.createElement('div');document.body.append(container);
  const root=createRoot(container);
  try {
    await act(async()=>root.render(<SessionMemory manager />));
    await act(async()=>{const select=container.querySelector('select');select.value='b';select.dispatchEvent(new Event('change',{bubbles:true}));});
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
    await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='Disable memory').click());
    expect(apiFetch.mock.calls.some(([path,options])=>path.endsWith('/context/settings') && options.method==='PATCH' && JSON.parse(options.body).enabled===false)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Enable memory');
    await act(async()=>{const mode=container.querySelectorAll('select')[1];mode.value='detailed';mode.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(apiFetch.mock.calls.some(([,options])=>options?.method==='PATCH' && JSON.parse(options.body).mode==='detailed')).toBe(true);
    await act(async()=>container.querySelector('input[type=checkbox]').click());
    expect(apiFetch.mock.calls.some(([,options])=>options?.method==='PATCH' && JSON.parse(options.body).auto_compact===false)).toBe(true);
  } finally {window.confirm=previousConfirm;await act(async()=>root.unmount());container.remove();}
});
