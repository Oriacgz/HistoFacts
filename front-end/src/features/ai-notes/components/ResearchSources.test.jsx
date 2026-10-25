// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect } from 'vitest';
import ResearchSources from './ResearchSources';
import ResearchProgress from './ResearchProgress';

it('renders fixture disclosure, safe text excerpts, source destination and progress', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<>
      <ResearchProgress progress={{stage:'reading',completed:2,total:5}} />
      <ResearchSources research={{run_id:'run1',sources:[{id:'S1',title:'Museum',url:'https://museum.example/',fixture:true,retrieved_at:'2026-10-23',passages:[{id:'S1P1',text:'<script>unsafe()</script>'}]}]}} />
    </>));
    expect(container.textContent).toContain('Test fixture sources');
    expect(container.textContent).toContain('2 of 5');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('a').getAttribute('rel')).toContain('noopener');
    expect(container.querySelector('[role=status]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
