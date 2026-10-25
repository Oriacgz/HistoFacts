// @vitest-environment happy-dom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import CreatePersonalizedQuiz from './CreatePersonalizedQuiz';
import {startPersonalizedQuizApi} from '../../../api/quiz';

vi.mock('../../../api/quiz',()=>({startPersonalizedQuizApi:vi.fn()}));
vi.mock('../components/ScoreRulesBadge',()=>({default:()=>null}));
vi.mock('../components/QuizGenerationProgress',()=>({default:()=>null}));
vi.mock('framer-motion',()=>{
  const element=tag=>({children,...props})=>{
    for(const key of ['initial','animate','exit','transition','whileHover','whileTap']) delete props[key];
    return createElement(tag,props,children);
  };
  return {motion:{div:element('div'),svg:element('svg')},AnimatePresence:({children})=>children};
});
let root,container;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
describe('prepared quiz topic',()=>{
  it('prefills without creating a quiz, then uses the reviewed topic only on submit',async()=>{
    const ready=vi.fn();startPersonalizedQuizApi.mockResolvedValue({questions:[],session_id:'prepared-test'});
    await act(async()=>root.render(<CreatePersonalizedQuiz initialTopic="Taj Mahal: history and architecture" onQuizReady={ready}/>));
    expect(container.querySelector('input[type="text"]').value).toBe('Taj Mahal: history and architecture');
    expect(startPersonalizedQuizApi).not.toHaveBeenCalled();
    await act(async()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(startPersonalizedQuizApi).toHaveBeenCalledWith({topic:'Taj Mahal: history and architecture',difficulty:'medium',file:null,signal:expect.any(AbortSignal)});
    expect(ready).toHaveBeenCalledOnce();
  });
  it('keeps the existing manual topic form empty by default',async()=>{
    await act(async()=>root.render(<CreatePersonalizedQuiz onQuizReady={vi.fn()}/>));
    expect(container.querySelector('input[type="text"]').value).toBe('');expect(startPersonalizedQuizApi).not.toHaveBeenCalled();
  });
  it('cancels without losing the topic and ignores a late response',async()=>{
    let resolve;
    startPersonalizedQuizApi.mockReturnValue(new Promise(done=>{resolve=done;}));
    const ready=vi.fn();
    await act(async()=>root.render(<CreatePersonalizedQuiz initialTopic="Taj Mahal" onQuizReady={ready}/>));
    await act(async()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    const signal=startPersonalizedQuizApi.mock.calls[0][0].signal;
    await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Cancel generation').click());
    expect(signal.aborted).toBe(true);
    expect(container.querySelector('input[type="text"]').value).toBe('Taj Mahal');
    await act(async()=>resolve({questions:[],session_id:'late'}));
    expect(ready).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Generation cancelled');
  });
  it('aborts the request on leaving the form',async()=>{
    startPersonalizedQuizApi.mockReturnValue(new Promise(()=>{}));
    await act(async()=>root.render(<CreatePersonalizedQuiz initialTopic="Taj Mahal" onQuizReady={vi.fn()}/>));
    await act(async()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    const signal=startPersonalizedQuizApi.mock.calls[0][0].signal;
    await act(async()=>root.render(null));expect(signal.aborted).toBe(true);
  });
});
