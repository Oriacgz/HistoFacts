import { describe, it, expect } from 'vitest';
import {
  SCOPES,
  COUNTRY_CATEGORIES,
  INDIA_CATEGORIES,
  WORLD_CATEGORIES,
  getCategoriesForScope,
  getCountryFlag,
  doesEventMatchCountry,
  doesEventMatchScope,
  detectEventScope,
  classifyEventCategory,
  deriveShortDescription,
  getCategoryBadgeClass,
} from './historyTaxonomy';

describe('historyTaxonomy', () => {
  it('defines the required COUNTRY categories without Other or World Events', () => {
    expect(COUNTRY_CATEGORIES).not.toContain('Other');
    expect(COUNTRY_CATEGORIES).not.toContain('World Events');
    expect(COUNTRY_CATEGORIES).not.toContain('Milestones');
    expect(COUNTRY_CATEGORIES).toHaveLength(12);
  });

  it('defines the required INDIA categories as an alias of COUNTRY_CATEGORIES', () => {
    expect(INDIA_CATEGORIES).toEqual(COUNTRY_CATEGORIES);
    expect(INDIA_CATEGORIES).toHaveLength(12);
  });

  it('defines the required WORLD categories without Other or World Events', () => {
    expect(WORLD_CATEGORIES).not.toContain('Other');
    expect(WORLD_CATEGORIES).not.toContain('World Events');
    expect(WORLD_CATEGORIES).not.toContain('Milestones');
    expect(WORLD_CATEGORIES).toHaveLength(13);
  });

  describe('getCategoriesForScope', () => {
    it('returns WORLD_CATEGORIES for WORLD scope', () => {
      expect(getCategoriesForScope('WORLD')).toEqual(WORLD_CATEGORIES);
      expect(getCategoriesForScope('World')).toEqual(WORLD_CATEGORIES);
      expect(getCategoriesForScope(SCOPES.WORLD)).toEqual(WORLD_CATEGORIES);
      expect(getCategoriesForScope(null)).toEqual(WORLD_CATEGORIES);
    });

    it('returns COUNTRY_CATEGORIES (12 categories) for any country scope', () => {
      expect(getCategoriesForScope('India')).toEqual(COUNTRY_CATEGORIES);
      expect(getCategoriesForScope('Japan')).toEqual(COUNTRY_CATEGORIES);
      expect(getCategoriesForScope('France')).toEqual(COUNTRY_CATEGORIES);
      expect(getCategoriesForScope('United States')).toEqual(COUNTRY_CATEGORIES);
    });
  });

  describe('getCountryFlag', () => {
    it('generates correct flag emojis from ISO codes', () => {
      expect(getCountryFlag('IN')).toBe('🇮🇳');
      expect(getCountryFlag('JP')).toBe('🇯🇵');
      expect(getCountryFlag('FR')).toBe('🇫🇷');
      expect(getCountryFlag('US')).toBe('🇺🇸');
      expect(getCountryFlag('WORLD')).toBe('🌍');
    });

    it('falls back gracefully on missing or invalid codes', () => {
      expect(getCountryFlag('')).toBe('🌐');
      expect(getCountryFlag(null)).toBe('🌐');
      expect(getCountryFlag('XYZ')).toBe('🌐');
    });
  });

  describe('doesEventMatchScope and doesEventMatchCountry', () => {
    it('matches WORLD scope for any event', () => {
      expect(doesEventMatchScope({ title: 'Any Event', description: 'Anywhere' }, 'WORLD')).toBe(true);
      expect(doesEventMatchScope({ title: 'Any Event', description: 'Anywhere' }, SCOPES.WORLD)).toBe(true);
    });

    it('matches India scope using rich keywords and country field', () => {
      expect(doesEventMatchScope({ country: 'India', title: 'Test' }, 'India')).toBe(true);
      expect(doesEventMatchScope({ title: 'Mahatma Gandhi leads Salt March', description: 'Dandi satyagraha' }, 'India')).toBe(true);
      expect(doesEventMatchScope({ title: 'Storming of the Bastille', description: 'Paris revolution' }, 'India')).toBe(false);
    });

    it('matches Japan scope using demonyms, cities, and country name', () => {
      expect(doesEventMatchCountry({ country: 'Japan', title: 'Battle of Sekigahara' }, 'Japan')).toBe(true);
      expect(doesEventMatchCountry({ title: 'Tokugawa Ieyasu unites the realm in Edo', description: 'Japanese history' }, 'Japan')).toBe(true);
      expect(doesEventMatchCountry({ title: 'French Revolution begins', description: 'In Paris, France' }, 'Japan')).toBe(false);
    });

    it('matches France scope using demonyms, cities, and country name', () => {
      expect(doesEventMatchCountry({ country: 'France', title: 'Treaty of Versailles' }, 'France')).toBe(true);
      expect(doesEventMatchCountry({ title: 'Napoleon crowned emperor at Notre-Dame', description: 'French empire' }, 'France')).toBe(true);
      expect(doesEventMatchCountry({ title: 'ISRO Chandrayaan Launch', description: 'Sriharikota' }, 'France')).toBe(false);
    });
  });

  describe('detectEventScope', () => {
    it('detects Indian events by country or mentions', () => {
      expect(detectEventScope({ country: 'India', title: 'Test', description: 'Test' })).toBe(SCOPES.INDIA);
      expect(detectEventScope({ title: 'Indian Independence Day', description: 'Celebrated on 15 August' })).toBe(SCOPES.INDIA);
      expect(detectEventScope({ title: 'Battle of Plassey', description: 'Fought in Bengal by East India Company' })).toBe(SCOPES.INDIA);
      expect(detectEventScope({ title: 'ISRO Chandrayaan Launch', description: 'Launched from Sriharikota' })).toBe(SCOPES.INDIA);
      expect(detectEventScope({ title: 'Mahatma Gandhi leads Salt March', description: 'Satyagraha to Dandi' })).toBe(SCOPES.INDIA);
    });

    it('detects World events for non-Indian topics', () => {
      expect(detectEventScope({ title: 'Storming of the Bastille', description: 'French Revolution event in Paris' })).toBe(SCOPES.WORLD);
      expect(detectEventScope({ title: 'Apollo 11 Moon Landing', description: 'NASA astronauts landed on the moon' })).toBe(SCOPES.WORLD);
      expect(detectEventScope({ title: 'Fall of the Berlin Wall', description: 'East and West Germany reunified' })).toBe(SCOPES.WORLD);
    });
  });

  describe('classifyEventCategory', () => {
    it('never assigns Other or World Events', () => {
      const sampleEvents = [
        { title: 'Something unknown happened', description: 'A decree was signed' },
        { title: 'Random king crowned', description: 'Coronation took place in castle' },
      ];
      sampleEvents.forEach((ev) => {
        const catIndia = classifyEventCategory(ev, SCOPES.INDIA);
        const catWorld = classifyEventCategory(ev, SCOPES.WORLD);
        expect(INDIA_CATEGORIES).toContain(catIndia);
        expect(WORLD_CATEGORIES).toContain(catWorld);
        expect(catIndia).not.toBe('Other');
        expect(catWorld).not.toBe('Other');
      });
    });

    it('classifies military events under Wars & Military', () => {
      const ev = { title: 'Battle of Gettysburg', description: 'Confederate and Union troops engaged in fierce combat' };
      expect(classifyEventCategory(ev, SCOPES.WORLD)).toBe('Wars & Military');
    });

    it('classifies science events under Science & Technology', () => {
      const ev = { title: 'Discovery of Penicillin', description: 'Alexander Fleming discovered the antibiotic medicine in a laboratory' };
      expect(classifyEventCategory(ev, SCOPES.WORLD)).toBe('Science & Technology');
    });

    it('classifies Indian movements under Society & Movements', () => {
      const ev = { title: 'Non-Cooperation Movement', description: 'Mahatma Gandhi launched a nationwide satyagraha protest' };
      expect(classifyEventCategory(ev, SCOPES.INDIA)).toBe('Society & Movements');
    });

    it('classifies World human rights under Society & Human Rights', () => {
      const ev = { title: 'Civil Rights March on Washington', description: 'Demonstrators gathered for racial equality and civil rights' };
      expect(classifyEventCategory(ev, SCOPES.WORLD)).toBe('Society & Human Rights');
    });

    it('classifies World exploration under Exploration & Geography', () => {
      const ev = { title: 'South Pole Expedition', description: 'Roald Amundsen led the first polar expedition to reach the South Pole' };
      expect(classifyEventCategory(ev, SCOPES.WORLD)).toBe('Exploration & Geography');
    });

    it('classifies holidays properly per scope', () => {
      const ev = { title: 'International Day of Peace', description: 'An annual world observance promoting ceasefire' };
      expect(classifyEventCategory(ev, SCOPES.WORLD)).toBe('Holidays & Observances');
      expect(classifyEventCategory(ev, SCOPES.INDIA)).toBe('Festivals & Holidays');
    });
  });

  describe('deriveShortDescription', () => {
    it('uses Wikipedia extract to create distinct summary for births', () => {
      const summary = deriveShortDescription(
        'Autar Singh Paintal',
        'Autar Singh Paintal, Indian physiologist and academic (died 2004)',
        'Births',
        '1925',
        'Autar Singh Paintal was an Indian medical scientist who made pioneering discoveries in the area of neurosciences and respiratory sciences. He is the first Indian Physiologist to become the Fellow of the Royal Society, London.'
      );
      expect(summary).not.toBeNull();
      expect(summary.length).toBeGreaterThan(20);
      // Should NOT repeat the title or description verbatim
      expect(summary).not.toBe('Autar Singh Paintal, Indian physiologist and academic (died 2004)');
      expect(summary.toLowerCase()).not.toMatch(/^autar singh paintal/);
    });

    it('produces distinct summary for general historical events', () => {
      const summary = deriveShortDescription(
        'Storming of the Bastille',
        'French revolutionaries stormed the medieval armory and political prison known as the Bastille, marking a key turning point in the French Revolution.',
        'Wars & Military',
        '1789'
      );
      expect(summary).not.toBeNull();
      expect(summary.length).toBeGreaterThan(20);
      expect(summary.length).toBeLessThanOrEqual(180);
    });

    it('returns null when content is empty (insufficient data)', () => {
      const summary = deriveShortDescription('Albert Einstein', '', 'Births', '1879');
      expect(summary).toBeNull();
    });

    it('returns null when content is identical to title', () => {
      const summary = deriveShortDescription('Pope Liberius', 'Pope Liberius', 'Deaths', '366');
      expect(summary).toBeNull();
    });

    it('returns contextual description for births with profession info', () => {
      const summary = deriveShortDescription(
        'Vitellius',
        'Vitellius, Roman emperor (died 69)',
        'Births',
        '10s'
      );
      expect(summary).not.toBeNull();
      expect(summary.toLowerCase()).toContain('roman emperor');
    });

    it('returns contextual description for deaths with profession info', () => {
      const summary = deriveShortDescription(
        'Pepin the Short',
        'Pepin the Short, Frankish king (born 714)',
        'Deaths',
        '768'
      );
      expect(summary).not.toBeNull();
      expect(summary.toLowerCase()).toContain('frankish king');
    });
  });

  describe('getCategoryBadgeClass', () => {
    it('returns style classes for categories', () => {
      expect(getCategoryBadgeClass('Politics & Governance')).toContain('indigo');
      expect(getCategoryBadgeClass('Wars & Military')).toContain('red');
    });
  });
});
