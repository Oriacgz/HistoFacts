import {describe,expect,it} from 'vitest';
import {getMonumentStudy} from './studyHandoff';

describe('prepared monument learning context',()=>{
  it('uses catalogue names rather than arbitrary URL input',()=>{
    expect(getMonumentStudy('taj-mahal').quizTopic).toBe('Taj Mahal: history and architecture');
    expect(getMonumentStudy('taj-mahal').notesPrompt).toContain('cite reliable sources');
    expect(getMonumentStudy('<script>')).toBeNull();expect(getMonumentStudy(null)).toBeNull();
  });
});
