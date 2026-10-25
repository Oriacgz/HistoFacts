import { describe, expect, it } from 'vitest';
import { monuments, getMonument } from './data/monuments';
import { normalizeQuery, searchMonuments } from './searchMonuments';

describe('monument discovery', () => {
  it.each(['Taj Mahal', '  TAJ   MAHAL ', 'Taj', 'ताज महल'])('matches name/alias: %s', q => {
    expect(searchMonuments(monuments,q).map(m=>m.id)).toEqual(['taj-mahal']);
  });
  it('offers all candidates without silently selecting an ambiguous result', () => {
    expect(searchMonuments(monuments,'India')).toHaveLength(2);
  });
  it('supports partial names and keywords', () => {
    expect(searchMonuments(monuments,'pyram')[0].id).toBe('great-pyramid');
    expect(searchMonuments(monuments,'Delhi sandstone')[0].id).toBe('qutub-minar');
  });
  it('combines country and period filters', () => {
    expect(searchMonuments(monuments,'',{country:'India',period:'Medieval'}).map(m=>m.id)).toEqual(['qutub-minar']);
    expect(searchMonuments(monuments,'Taj',{country:'Egypt'})).toEqual([]);
  });
  it('handles empty and unavailable search honestly', () => {
    expect(searchMonuments(monuments,'  ')).toHaveLength(3);
    expect(searchMonuments(monuments,'Atlantis')).toEqual([]);
    expect(getMonument('invalid')).toBeUndefined();
  });
  it('normalizes unicode and whitespace', () => expect(normalizeQuery(' ＴＡＪ  ')).toBe('taj'));
});
