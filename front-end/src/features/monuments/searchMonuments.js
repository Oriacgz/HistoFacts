export function normalizeQuery(value = '') {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function searchMonuments(catalogue, query = '', { country = '', period = '' } = {}) {
  const q = normalizeQuery(query);
  return catalogue.filter(m => (!country || m.country === country) && (!period || m.period === period))
    .map(monument => {
      const names = [monument.name, ...monument.aliases].map(normalizeQuery);
      const text = normalizeQuery([monument.name, ...monument.aliases, monument.country, monument.civilization, ...monument.tags].join(' '));
      const score = !q ? 1 : names.includes(q) ? 4 : names.some(n => n.startsWith(q)) ? 3 : q.split(' ').every(word => text.includes(word)) ? 2 : 0;
      return { monument, score };
    }).filter(r => r.score).sort((a,b) => b.score - a.score || a.monument.name.localeCompare(b.monument.name)).map(r => r.monument);
}
