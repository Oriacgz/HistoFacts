// @vitest-environment happy-dom
import {act,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import useMonumentLearning from './useMonumentLearning';
import {getMonumentLearning,setMonumentFavorite,completeMonumentTour} from '../../api/monuments';

const owner=vi.hoisted(()=>({id:'a'}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({user:owner.id?{id:owner.id}:null})}));
vi.mock('../../api/monuments',()=>({getMonumentLearning:vi.fn(),setMonumentFavorite:vi.fn(),completeMonumentTour:vi.fn()}));
let client,root,container,state;
function Harness(){const learning=useMonumentLearning();useEffect(()=>{state=learning;});return <output>{JSON.stringify({favorites:learning.favorites,completions:learning.completions,ready:learning.ready})}</output>;}
const flush=()=>act(async()=>await new Promise(resolve=>setTimeout(resolve,10)));
const render=async()=>{await act(async()=>root.render(<QueryClientProvider client={client}><Harness key={owner.id}/></QueryClientProvider>));await flush();};
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;owner.id='a';vi.clearAllMocks();client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});container=document.createElement('div');document.body.append(container);root=createRoot(container);getMonumentLearning.mockResolvedValue({favorites:[],completions:[]});});
afterEach(async()=>{await act(async()=>root.unmount());client.clear();container.remove();});

describe('account-scoped monument learning',()=>{
  it('refetches unknown account data when completion wins a race with initial loading',async()=>{
    let resolveOld;getMonumentLearning.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;})).mockResolvedValue({favorites:[{monument_id:'great-pyramid'}],completions:[{monument_id:'taj-mahal',tour_revision:1}]});
    completeMonumentTour.mockResolvedValue({monument_id:'taj-mahal',tour_revision:1});await render();expect(state.ready).toBe(false);
    await act(async()=>{await state.tour.mutateAsync({monumentId:'taj-mahal',tourRevision:1});});await flush();
    expect(state.favorites[0].monument_id).toBe('great-pyramid');expect(state.completions).toHaveLength(1);
    await act(async()=>resolveOld({favorites:[],completions:[]}));await flush();expect(state.completions).toHaveLength(1);
  });
  it('waits for server success before showing favorites',async()=>{
    await render();let resolve;setMonumentFavorite.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    await act(async()=>state.favorite.mutate({monumentId:'taj-mahal',saved:true}));expect(state.favorites).toEqual([]);
    await act(async()=>resolve({monument_id:'taj-mahal',created_at:'2026-10-17'}));await flush();
    expect(state.favorites[0].monument_id).toBe('taj-mahal');
  });
  it('does not show a failed write as saved and supports retry',async()=>{
    await render();setMonumentFavorite.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({monument_id:'taj-mahal'});
    await act(async()=>{await state.favorite.mutateAsync({monumentId:'taj-mahal',saved:true}).catch(()=>{});});await flush();
    expect(state.favorite.isError).toBe(true);expect(state.favorites).toEqual([]);
    await act(async()=>{await state.favorite.mutateAsync({monumentId:'taj-mahal',saved:true});});await flush();
    expect(state.favorites).toHaveLength(1);
  });
  it('isolates cached data and late mutation responses across accounts',async()=>{
    await render();let resolve;setMonumentFavorite.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    await act(async()=>state.favorite.mutate({monumentId:'taj-mahal',saved:true}));
    owner.id='b';await render();expect(state.favorites).toEqual([]);
    await act(async()=>resolve({monument_id:'taj-mahal'}));await flush();expect(state.favorites).toEqual([]);
    owner.id=null;await render();expect(state.favorites).toEqual([]);expect(state.ready).toBe(false);
  });
  it('deduplicates versioned completion responses in the account cache',async()=>{
    await render();completeMonumentTour.mockResolvedValue({monument_id:'taj-mahal',tour_revision:1,completed_at:'2026-10-17'});
    for(let i=0;i<2;i++)await act(async()=>{await state.tour.mutateAsync({monumentId:'taj-mahal',tourRevision:1});});
    await flush();expect(state.completions).toHaveLength(1);
    expect(completeMonumentTour).toHaveBeenCalledWith({monumentId:'taj-mahal',tourRevision:1,accountId:'a'});
  });
});
