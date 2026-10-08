import { describe, expect, it } from 'vitest';
import { resolveLobbyCode } from './resolveLobbyCode';

describe('same lobby code for every entry method', () => {
  it.each(['123456', ' 123456 ', 'https://histofacts.example/quiz?tab=lobby&join=123456',
    'https://histofacts.example/lobby/123456'])('resolves %s', (input) => {
    expect(resolveLobbyCode(input)).toBe('123456');
  });
  it.each(['', '12345', '1234567', 'not a URL 123456', 'javascript:123456',
    'https://histofacts.example/?join=1234567'])('rejects %s', (input) => {
    expect(resolveLobbyCode(input)).toBeNull();
  });
});
