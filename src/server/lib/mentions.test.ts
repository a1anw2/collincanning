import { describe, expect, it } from 'vitest';
import { buildMentionLookup, matchMentionedAgentIds } from './mentions.js';

describe('mentions', () => {
  const agents = [
    { id: 'id-ceo', role: 'CEO', displayName: 'Jordan Ellis' },
    { id: 'id-cfo', role: 'CFO', displayName: 'Sam Rivera' },
  ];

  it('matches display names and first names', () => {
    const lookup = buildMentionLookup(agents);
    expect(matchMentionedAgentIds('Hey @Jordan Ellis — thoughts?', lookup)).toEqual(['id-ceo']);
    expect(matchMentionedAgentIds('@Sam what do you think?', lookup)).toEqual(['id-cfo']);
  });

  it('still matches role as fallback', () => {
    const lookup = buildMentionLookup(agents);
    expect(matchMentionedAgentIds('@CEO legacy', lookup)).toEqual(['id-ceo']);
  });

  it('prefers longer name over first name prefix', () => {
    const lookup = buildMentionLookup([
      { id: 'a', role: 'A', displayName: 'Jordan Ellis' },
      { id: 'b', role: 'B', displayName: 'Jordan Park' },
    ]);
    expect(matchMentionedAgentIds('@Jordan Park agreed', lookup)).toEqual(['b']);
  });
});
