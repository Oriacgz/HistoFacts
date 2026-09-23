import { describe, it, expect } from 'vitest';
import {
  SCOPES,
  INDIA_CATEGORIES,
  WORLD_CATEGORIES,
  detectEventScope,
  classifyEventCategory,
  deriveShortDescription,
  getCategoryBadgeClass,
} from './historyTaxonomy';

describe('historyTaxonomy', () => {
  it('defines the required INDIA categories without Other or World Events', () => {
    expect(INDIA_CATEGORIES).not.toContain('Other');
    expect(INDIA_CATEGORIES).not.toContain('World Events');
    expect(INDIA_CATEGORIES).not.toContain('Milestones');
    expect(INDIA_CATEGORIES).toHaveLength(12);
  });

  it('defines the required WORLD categories without Other or World Events', () => {
    expect(WORLD_CATEGORIES).not.toContain('Other');
    expect(WORLD_CATEGORIES).not.toContain('World Events');
    expect(WORLD_CATEGORIES).not.toContain('Milestones');
    expect(WORLD_CATEGORIES).toHaveLength(13);
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
    it('extracts concise 1-2 line summary from existing event content', () => {
      const summary = deriveShortDescription(
        'Storming of the Bastille',
        'French revolutionaries stormed the medieval armory and political prison known as the Bastille, marking a key turning point in the French Revolution.',
        'Wars & Military',
        '1789'
      );
      expect(summary.length).toBeGreaterThan(20);
      expect(summary.length).toBeLessThanOrEqual(180);
      expect(summary.endsWith('.')).toBe(true);
      expect(summary).toContain('Bastille');
    });

    it('provides factual concise fallback when content is empty', () => {
      const summary = deriveShortDescription('Albert Einstein', '', 'Births', '1879');
      expect(summary).toBe('Birth of Albert Einstein in 1879.');
    });
  });

  describe('getCategoryBadgeClass', () => {
    it('returns style classes for categories', () => {
      expect(getCategoryBadgeClass('Politics & Governance')).toContain('indigo');
      expect(getCategoryBadgeClass('Wars & Military')).toContain('red');
    });
  });
});
