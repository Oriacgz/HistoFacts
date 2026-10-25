// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import NoteThread from './NoteThread';
import { printHandwrittenNote } from '../utils/pdfGenerator';
vi.mock('../utils/pdfGenerator', () => ({ printHandwrittenNote: vi.fn() }));

it('passes cited source links and retrieval dates into the printable handwritten HTML', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<NoteThread chain={[{id:'note',title:'Ashoka',prompt:'Ashoka?',content:'Ashoka supported Buddhism. [S1]\n\n### Sources\n- [S1] [Museum](https://museum.example/ashoka) — retrieved 2026-10-24'}]} onCopyNote={vi.fn()} />));
    const button = [...container.querySelectorAll('button')].find(element => element.textContent.includes('Download PDF'));
    await act(async () => button.click());
    const printed = printHandwrittenNote.mock.calls[0][0];
    expect(printed.title).toBe('Ashoka');
    expect(printed.htmlContent).toContain('https://museum.example/ashoka');
    expect(printed.htmlContent).toContain('2026-10-24');
    expect(printed.htmlContent).toContain('Sources');
  } finally { await act(async () => root.unmount()); container.remove(); }
});
