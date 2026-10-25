import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {apiFetch} from './client';
import {startPersonalizedQuizApi,QUIZ_REQUEST_TIMEOUT_MS} from './quiz';

vi.mock('./client',()=>({apiFetch:vi.fn()}));
beforeEach(()=>{vi.useFakeTimers();vi.resetAllMocks();});
afterEach(()=>{vi.useRealTimers();});
const pendingFetch = () => apiFetch.mockImplementation((url,{signal})=>new Promise((resolve,reject)=>{
  signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  if(signal.aborted) reject(new DOMException('Aborted','AbortError'));
}));

describe('bounded personalized quiz requests',()=>{
  it('aborts at the deadline and returns a readable timeout',async()=>{
    pendingFetch();
    const result=expect(startPersonalizedQuizApi({topic:'Taj Mahal',difficulty:'medium'})).rejects.toThrow('took too long');
    await vi.advanceTimersByTimeAsync(QUIZ_REQUEST_TIMEOUT_MS);await result;
    expect(apiFetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('forwards cancellation independently of timeout',async()=>{
    pendingFetch();const controller=new AbortController();
    const result=expect(startPersonalizedQuizApi({topic:'Taj Mahal',signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
    controller.abort();await result;expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans up a successful request and supports PDF cancellation',async()=>{
    apiFetch.mockResolvedValue({questions:[],session_id:'ok'});
    const file=new Blob(['%PDF-'],{type:'application/pdf'});
    await startPersonalizedQuizApi({file,difficulty:'easy'});
    expect(apiFetch.mock.calls[0][0]).toBe('/api/quiz/personalized/from-pdf');
    expect(apiFetch.mock.calls[0][1].body).toBeInstanceOf(FormData);
    expect(apiFetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(vi.getTimerCount()).toBe(0);
  });
});
