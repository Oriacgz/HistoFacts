// @vitest-environment happy-dom
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMonument, monuments } from '../data/monuments';
import MonumentViewer from './MonumentViewer';

vi.mock('@google/model-viewer', () => ({}));
let container, root;
const taj = getMonument('taj-mahal');
const stage = () => container.querySelector('[data-testid="monument-stage"]');
const el = () => container.querySelector('model-viewer');
const button = text => [...container.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
const click = async text => act(async()=>button(text).click());
const event = async (name, detail) => act(async()=>el().dispatchEvent(new CustomEvent(name,{detail})));
const render = async (m=taj, strict=false) => act(async()=>root.render(strict?<StrictMode><MonumentViewer key={m.id} monument={m}/></StrictMode>:<MonumentViewer key={m.id} monument={m}/>));

beforeAll(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  customElements.define('model-viewer', class extends HTMLElement {jumpCameraToGoal=vi.fn();});
});
beforeEach(()=>{vi.useFakeTimers();container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();vi.restoreAllMocks();});

describe('viewer lifecycle and educational interactions',()=>{
  it.each(monuments)('opens every numbered point and its matching camera for $name',async monument=>{
    await render(monument);await event('load');
    expect(container.querySelectorAll('model-viewer button')).toHaveLength(8);
    for (const [index, point] of monument.hotspots.entries()) {
      await click(String(index+1));
      const card=stage().querySelector('.monument-point-card');
      expect(card.textContent).toContain(point.title);
      expect(card.textContent).toContain(point.text);
      expect(el().cameraTarget).toBe(point.target);
      expect(el().cameraOrbit).toBe(point.orbit);
      expect(Boolean(card.querySelector('.monument-point-context'))).toBe(Boolean(point.contextOnly));
      expect(card.querySelector('a').href).toBe(monument.sources.find(s=>s.id===point.sourceId).url);
    }
  });
  it('reveals the clicked point inside the stage, replaces it, and allows dismissal',async()=>{
    await render();await event('load');expect(stage().querySelector('.monument-point-card')).toBeNull();
    await click('1');const first=stage().querySelector('.monument-point-card');
    expect(first.textContent).toContain(taj.hotspots[0].text);
    await click('2');const second=stage().querySelector('.monument-point-card');
    expect(second).not.toBe(first);expect(second.textContent).toContain(taj.hotspots[1].text);
    await act(async()=>second.querySelector('button').click());expect(stage().querySelector('.monument-point-card')).toBeNull();
    await click('1');await click('Reset view');expect(stage().querySelector('.monument-point-card')).toBeNull();
  });
  it('reports completion only after the user finishes every tour stop',async()=>{
    const complete=vi.fn();await act(async()=>root.render(<MonumentViewer monument={taj} onTourComplete={complete}/>));
    await event('load');await click('Start guided tour');expect(complete).not.toHaveBeenCalled();
    await click('Next stop');await click('Next stop');expect(complete).not.toHaveBeenCalled();
    await click('Finish tour');expect(complete).toHaveBeenCalledTimes(1);
  });
  it('loads only the selected asset and enables controls after native load',async()=>{
    await render();expect(el().getAttribute('src')).toBe(taj.model);expect(button('Reset view').disabled).toBe(true);
    await event('progress',{totalProgress:.5});expect(container.querySelector('progress').value).toBe(50);
    await event('load');expect(stage().dataset.status).toBe('ready');expect(button('Reset view').disabled).toBe(false);
    expect(el().hasAttribute('ar')).toBe(false);
  });
  it('recovers from an error with a fresh model session',async()=>{
    const retryMonument={...taj,id:'retry-test'};
    await render(retryMonument);const old=el();await event('error');expect(stage().dataset.status).toBe('error');
    expect(container.textContent).toContain('3D preview unavailable');
    await click('Retry model');expect(el()).not.toBe(old);expect(stage().dataset.status).toBe('loading');
    expect(el().getAttribute('src')).toBe(`${taj.model}?retry=1`);
    await event('load');expect(stage().dataset.status).toBe('ready');
    await act(async()=>root.render(null));await render(retryMonument);
    expect(el().getAttribute('src')).toBe(`${taj.model}?retry=1`);
  });
  it('does not leave a stalled asset loading forever',async()=>{
    await render();await act(async()=>vi.advanceTimersByTime(30000));expect(stage().dataset.status).toBe('error');
  });
  it('ignores old asset events after rapid monument switching',async()=>{
    await render();const old=el();await render(getMonument('qutub-minar'));
    await act(async()=>{old.dispatchEvent(new Event('load'));old.dispatchEvent(new Event('error'));});
    expect(stage().dataset.status).toBe('loading');expect(el().getAttribute('src')).toContain('qutub-minar');
    await event('load');expect(stage().dataset.status).toBe('ready');
  });
  it('survives StrictMode effect cleanup and removes its source on unmount',async()=>{
    await render(taj,true);expect(el().getAttribute('src')).toBe(taj.model);await event('load');
    const old=el();await act(async()=>root.render(null));expect(old.hasAttribute('src')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('focuses an annotation and resets the camera and rotation',async()=>{
    await render();await event('load');await click('Auto rotate');expect(el().hasAttribute('auto-rotate')).toBe(true);
    await click('01The central dome');expect(el().cameraTarget).toBe(taj.hotspots[0].target);
    expect(el().hasAttribute('auto-rotate')).toBe(false);expect(container.textContent).toContain(taj.hotspots[0].text);
    await click('Reset view');expect(el().cameraOrbit).toBe(taj.camera.orbit);expect(el().jumpCameraToGoal).toHaveBeenCalled();
  });
  it('runs a complete user-driven tour and allows restart',async()=>{
    await render();await event('load');await click('Start guided tour');expect(container.textContent).toContain('Stop 1 of 3');
    expect(button('Previous stop').disabled).toBe(true);await click('Next stop');expect(el().cameraTarget).toBe(taj.hotspots[1].target);
    await click('Previous stop');expect(container.textContent).toContain('Stop 1 of 3');await click('Next stop');await click('Next stop');
    await click('Finish tour');expect(container.textContent).toContain('Tour complete');expect(el().cameraTarget).toBe(taj.camera.target);
    await click('Restart tour');expect(container.textContent).toContain('Stop 1 of 3');await click('Exit tour');expect(button('Start guided tour')).toBeDefined();
  });
  it('manual annotations cancel a running tour',async()=>{
    await render();await event('load');await click('Start guided tour');await click('02Four minarets');
    expect(button('Start guided tour')).toBeDefined();expect(el().cameraTarget).toBe(taj.hotspots[1].target);
  });
  it('jumps directly to viewpoints when reduced motion is requested',async()=>{
    const media=new EventTarget();media.matches=true;vi.spyOn(window,'matchMedia').mockReturnValue(media);
    await render();await event('load');await click('01The central dome');expect(el().jumpCameraToGoal).toHaveBeenCalled();
  });
});
