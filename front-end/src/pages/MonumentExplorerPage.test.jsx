// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import MonumentExplorerPage from './MonumentExplorerPage';

vi.mock('../features/monuments/components/MonumentViewer',()=>({default:({monument})=><div data-testid="viewer-stub">{monument.id}</div>}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{id:'page-test-user'}})}));
vi.mock('../features/monuments/useMonumentLearning',()=>({default:()=>({favorites:[],completions:[],ready:true,isPending:false,isError:false,favorite:{mutate:vi.fn()},tour:{mutate:vi.fn()}})}));
let root, container;
function Location(){return <output data-testid="url">{useLocation().search}</output>;}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();});
const render=async(path='/monuments')=>act(async()=>root.render(<MemoryRouter initialEntries={[path]}><MonumentExplorerPage/><Location/></MemoryRouter>));
const click=async(text)=>act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent.includes(text)).click());

describe('monument page URL state and fallback',()=>{
  it('does not mount the renderer until a model is selected',async()=>{
    await render();expect(container.querySelector('[data-testid="viewer-stub"]')).toBeNull();
    await click('Explore the Taj Mahal');expect(container.querySelector('output').textContent).toBe('?monument=taj-mahal');
    expect(container.textContent).toContain('Mughal Empire');
  });
  it('opens a deep link with the matching details',async()=>{
    await render('/monuments?monument=qutub-minar');expect(container.textContent).toContain('Delhi Sultanate');
    expect(container.querySelector('[data-testid="viewer-stub"]').textContent).toBe('qutub-minar');
  });
  it('recovers from an invalid monument ID',async()=>{
    await render('/monuments?monument=missing');expect(container.textContent).toContain('This monument is not in the collection');
    await click('Explore the Taj Mahal');expect(container.textContent).toContain('Mughal Empire');
  });
  it('reports unavailable models without hiding a selected monument',async()=>{
    await render('/monuments?q=Atlantis&monument=taj-mahal');expect(container.textContent).toContain('Model not available');
    expect(container.textContent).toContain('Mughal Empire');await click('Show the collection');
    expect(container.querySelector('output').textContent).toBe('?monument=taj-mahal');
  });
  it('handles clipboard denial with a manual copy field',async()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('Denied'))}});
    await render('/monuments?monument=taj-mahal');await click('Copy monument link');
    const input=container.querySelector('.monument-share-fallback input');
    expect(input.readOnly).toBe(true);expect(new URL(input.value).search).toBe('?monument=taj-mahal');
    expect(container.textContent).toContain('Copy this link manually');
  });
});
