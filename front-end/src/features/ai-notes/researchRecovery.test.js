// @vitest-environment happy-dom
import { beforeEach, it, expect, vi } from 'vitest';
import { apiFetch } from '../../api/client';
import { pendingResearch, runRecoverableResearch } from './researchRecovery';

vi.mock('../../api/client',()=>({apiFetch:vi.fn()}));
const payload = {topic:'Ashoka',research_mode:'web',research_depth:'standard'};
beforeEach(()=>{localStorage.clear();apiFetch.mockReset();});

it('recovers a commit whose saved-note event was lost without a second generation',async()=>{
  const saved = {id:'saved-note',content:'Cited answer'};
  const send = vi.fn().mockRejectedValue(new TypeError('Connection lost after commit'));
  apiFetch.mockResolvedValue({state:'complete',note:saved});
  const onNoteSaved = vi.fn();
  await runRecoverableResearch({owner:'one',root:null,payload,send,onNoteSaved});
  expect(send).toHaveBeenCalledTimes(1);
  expect(onNoteSaved).toHaveBeenCalledWith(saved,{});
  expect(pendingResearch('one',null)).toBeNull();
  expect(apiFetch.mock.calls[0][1].expectedUserId).toBe('one');
});

it('retains the UUID on unknown status and reuses it if the server confirms no run',async()=>{
  apiFetch.mockRejectedValue(Object.assign(new Error('Unavailable'),{status:503}));
  const failedSend = vi.fn().mockRejectedValue(new TypeError('Network down'));
  await expect(runRecoverableResearch({owner:'one',root:'root',payload,send:failedSend})).rejects.toThrow('Network down');
  const firstId = pendingResearch('one','root').requestId;
  apiFetch.mockRejectedValue(Object.assign(new Error('Not found'),{status:404}));
  const retry = vi.fn(async(next,{onNoteSaved})=>{onNoteSaved({id:'saved'},{});});
  await runRecoverableResearch({owner:'one',root:'root',payload,send:retry});
  expect(retry.mock.calls[0][0].research_request_id).toBe(firstId);
  expect(pendingResearch('one','root')).toBeNull();
});

it('recovers a previous success before retrying, even when composer text changed',async()=>{
  apiFetch.mockRejectedValue(new Error('offline'));
  await expect(runRecoverableResearch({owner:'one',root:null,payload,send:vi.fn().mockRejectedValue(new Error('offline'))})).rejects.toThrow();
  apiFetch.mockResolvedValue({state:'complete',note:{id:'committed'}});
  const send=vi.fn(), saved=vi.fn();
  await runRecoverableResearch({owner:'one',root:null,payload:{...payload,topic:'New topic'},send,onNoteSaved:saved});
  expect(send).not.toHaveBeenCalled();
  expect(saved).toHaveBeenCalledWith({id:'committed'},{retained_prompt:'New topic'});
});

it('cancels the owned run on Stop and keeps its ID until cancellation is confirmed',async()=>{
  const controller = new AbortController();
  apiFetch.mockResolvedValue({state:'cancelled'});
  const send = vi.fn(async(next,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));
  const operation=runRecoverableResearch({owner:'one',root:null,payload,send,signal:controller.signal});
  await Promise.resolve();
  controller.abort();
  await expect(operation).rejects.toMatchObject({name:'AbortError'});
  expect(apiFetch.mock.calls.some(([path,options])=>path.endsWith('/cancel') && options.expectedUserId==='one')).toBe(true);
  expect(pendingResearch('one',null)).not.toBeNull();
  expect(pendingResearch('two',null)).toBeNull();
});
