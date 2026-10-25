// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import MonumentNotesHandoff from './MonumentNotesHandoff';

let root,container;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const render=props=>act(async()=>root.render(<MemoryRouter><MonumentNotesHandoff monumentId="taj-mahal" {...props}/></MemoryRouter>));
describe('notes handoff confirmation',()=>{
  it('leaves the composer untouched until the user chooses the prompt',async()=>{
    const usePrompt=vi.fn();await render({onUsePrompt:usePrompt,onDismiss:vi.fn(),hasDraft:true});
    expect(usePrompt).not.toHaveBeenCalled();expect(container.textContent).toContain('replaces the current draft');
    await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Use in a new note').click());
    expect(usePrompt).toHaveBeenCalledOnce();expect(usePrompt.mock.calls[0][0]).toContain('Taj Mahal');
    expect(container.textContent).toContain('Review it and send when ready');
  });
  it('does not interrupt an active response',async()=>{
    const usePrompt=vi.fn();await render({onUsePrompt:usePrompt,onDismiss:vi.fn(),busy:true});
    expect(container.querySelector('button').disabled).toBe(true);expect(usePrompt).not.toHaveBeenCalled();
  });
  it('ignores unknown monument handoffs',async()=>{
    await render({monumentId:'unknown',onUsePrompt:vi.fn(),onDismiss:vi.fn()});expect(container.textContent).toBe('');
  });
});
