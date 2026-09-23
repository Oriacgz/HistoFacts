/**
 * Historical Calendar Taxonomy & Presentation Utilities
 *
 * Scopes: INDIA | WORLD
 * Categories: 12 (India) & 13 (World) — Strictly NO "Other" or "World Events".
 */

export const SCOPES = {
  INDIA: 'INDIA',
  WORLD: 'WORLD',
};

export const INDIA_CATEGORIES = [
  'Politics & Governance',
  'Wars & Military',
  'Society & Movements',
  'Culture & Arts',
  'Religion & Philosophy',
  'Science & Technology',
  'Economy & Trade',
  'Sports',
  'Festivals & Holidays',
  'Disasters & Environment',
  'Births',
  'Deaths',
];

export const WORLD_CATEGORIES = [
  'Politics & Governance',
  'Wars & Military',
  'Society & Human Rights',
  'Culture & Arts',
  'Religion & Philosophy',
  'Science & Technology',
  'Economy & Trade',
  'Sports',
  'Exploration & Geography',
  'Disasters & Environment',
  'Holidays & Observances',
  'Births',
  'Deaths',
];

// Indian geographical, historical, cultural, and political markers
const INDIA_REGEX = new RegExp(
  '\\b(' +
    // Geographic names (States, cities, historical regions, rivers)
    'india|indian|bharat|hindustan|delhi|mumbai|bombay|calcutta|kolkata|madras|chennai|' +
    'bengal|punjab|kashmir|hyderabad|mysore|karnataka|kerala|tamil\\s*nadu|gujarat|' +
    'rajasthan|bihar|odisha|orissa|assam|maharashtra|uttar\\s*pradesh|madhya\\s*pradesh|' +
    'haryana|himachal|goa|agra|jaipur|pune|lucknow|varanasi|benaras|benares|lahore|peshawar|' +
    'patna|kanpur|nagpur|ahmedabad|cochin|kochi|indus|ganges|ganga|yamuna|brahmaputra|' +
    // Dynasties & Empires
    'mughal|maratha|chola|maurya|gupta|ashoka|harsha|vijayanagara|delhi\\s*sultanate|' +
    'east\\s*india\\s*company|british\\s*raj|pala\\s*dynasty|rashtrakuta|satavahana|chalukya|' +
    'pallava|rajput|sikh\\s*empire|ahom|hoysala|pandya|sepoy|bahmani|nizam|peshwa|' +
    // Notable leaders & historical figures
    'gandhi|nehru|subhas\\s*chandra\\s*bose|bhagat\\s*singh|ambedkar|sardar\\s*patel|vallabhbhai|' +
    'tagore|swami\\s*vivekananda|ramakrishna|shivaji|akbar|babur|aurangzeb|shah\\s*jahan|' +
    'chandragupta|tipu\\s*sultan|ranjit\\s*singh|rani\\s*lakshmibai|jhansi|lal\\s*bahadur\\s*shastri|' +
    'indira\\s*gandhi|atal\\s*bihari\\s*vajpayee|abdul\\s*kalam|sarojini\\s*naidu|c\\.?\\s*v\\.?\\s*raman|' +
    // Institutions & concepts
    'isro|lok\\s*sabha|rajya\\s*sabha|indian\\s*army|indian\\s*air\\s*force|indian\\s*navy|' +
    'reserve\\s*bank\\s*of\\s*india|\\brbi\\b|bcci|congress\\s*party|indian\\s*national\\s*congress|' +
    'satyagraha|swaraj|swadeshi|salt\\s*march|quit\\s*india|jallianwala|dandi|' +
    'vedic|vedas|upanishad|bhagavad\\s*gita|ayurveda|sanskrit|diwali|holi|navratri|durga\\s*puja|' +
    'guru\\s*nanak|mahavira|gautama\\s*buddha|brahmo\\s*samaj|arya\\s*samaj' +
  ')\\b',
  'i'
);

/**
 * Detect whether an event belongs to INDIA or WORLD historical scope.
 */
export function detectEventScope(ev) {
  if (!ev) return SCOPES.WORLD;

  // Direct country check
  const country = (ev.country || '').trim().toLowerCase();
  if (
    country === 'india' ||
    country === 'in' ||
    country.includes('india') ||
    country.includes('bharat') ||
    country.includes('hindustan') ||
    country.includes('mughal') ||
    country.includes('maratha') ||
    country.includes('british raj')
  ) {
    return SCOPES.INDIA;
  }

  // Textual inspection of title and description
  const combinedText = `${ev.title || ''} ${ev.description || ''} ${ev.content || ''}`;
  if (INDIA_REGEX.test(combinedText)) {
    return SCOPES.INDIA;
  }

  return SCOPES.WORLD;
}

/**
 * Classify raw event into one of the designated categories for its scope.
 * Guarantees zero "Other" and zero "World Events".
 */
export function classifyEventCategory(ev, scope) {
  const isIndia = scope === SCOPES.INDIA;
  const rawCat = (ev?.category || '').toLowerCase();
  const title = (ev?.title || '').toLowerCase();
  const desc = (ev?.description || ev?.content || '').toLowerCase();
  const text = `${title} ${desc}`;

  // 1. Births
  if (
    rawCat === 'births' ||
    rawCat === 'birth' ||
    desc.includes('was born') ||
    desc.includes('is born') ||
    desc.includes('birth of') ||
    title.startsWith('birth of') ||
    /\bborn\b/i.test(title)
  ) {
    return 'Births';
  }

  // 2. Deaths
  if (
    rawCat === 'deaths' ||
    rawCat === 'death' ||
    desc.includes('died') ||
    desc.includes('was assassinated') ||
    desc.includes('was executed') ||
    desc.includes('passed away') ||
    desc.includes('death of') ||
    title.startsWith('death of') ||
    /\b(died|assassinated|executed)\b/i.test(title)
  ) {
    return 'Deaths';
  }

  // 3. Holidays & Observances / Festivals & Holidays
  if (
    rawCat.includes('holiday') ||
    rawCat.includes('observance') ||
    rawCat.includes('festival') ||
    desc.includes('holiday') ||
    desc.includes('observance') ||
    desc.includes('feast day') ||
    desc.includes('celebrated as') ||
    desc.includes('commemorated as') ||
    desc.includes('festival') ||
    title.includes('day of') ||
    title.includes('international day') ||
    title.includes('world day') ||
    title.includes('national day')
  ) {
    return isIndia ? 'Festivals & Holidays' : 'Holidays & Observances';
  }

  // 4. Wars & Military
  if (
    /\b(war|battle|siege|invasion|invade|invaded|military|army|navy|naval|air\s*force|troops|regiment|brigade|combat|casualt|hostilities|skirmish|offensive|infantry|artillery|conquest|coup\s*d['’]état|blitzkrieg|insurgency|rebellion|revolt|surrender|surrendered|armistice|treaty\s*of\s*peace|ceasefire|guerrilla|missile\s*strike)\b/i.test(
      text
    )
  ) {
    return 'Wars & Military';
  }

  // 5. Science & Technology
  if (
    /\b(science|scientific|technology|scientist|physic|physics|chemist|chemistry|biolog|biology|astronom|spacecraft|satellite|launch|orbit|nasa|isro|esa|telescope|computer|internet|software|hardware|microprocessor|invention|invented|patent|discover|discovered|vaccin|medical|medicine|hospital|surgery|dna|genome|artificial\s*intelligence|laboratory|quantum|nuclear|reactor|atomic\s*bomb|radar|aeroplane|flight)\b/i.test(
      text
    )
  ) {
    return 'Science & Technology';
  }

  // 6. Sports
  if (
    /\b(sport|sports|olympic|olympics|football|soccer|cricket|tennis|basketball|baseball|rugby|tournament|championship|world\s*cup|medal|gold\s*medal|athlete|athletics|stadium|fifa|icc|match|race|formula\s*1|grand\s*prix|boxing|heavyweight|champion)\b/i.test(
      text
    )
  ) {
    return 'Sports';
  }

  // 7. Disasters & Environment
  if (
    /\b(earthquake|tsunami|hurricane|cyclone|typhoon|tornado|flood|flooding|eruption|volcano|volcanic|wildfire|blizzard|famine|drought|landslide|avalanche|oil\s*spill|plane\s*crash|shipwreck|nuclear\s*disaster|chernobyl|catastrophe|meteor|toxic\s*gas)\b/i.test(
      text
    )
  ) {
    return 'Disasters & Environment';
  }

  // 8. Religion & Philosophy
  if (
    /\b(religion|religious|temple|church|mosque|cathedral|synagogue|pope|papal|vatican|bishop|archbishop|priest|saint|monk|theolog|philosophy|philosopher|scripture|bible|quran|koran|torah|gita|vedas|buddhis|hindu|islam|christian|judaism|sikhism|jainism|deity|clergy|canoniz|crusade|theology)\b/i.test(
      text
    )
  ) {
    return 'Religion & Philosophy';
  }

  // 9. Economy & Trade
  if (
    /\b(economy|economic|bank|banking|currency|rupee|dollar|pound|euro|stock\s*exchange|wall\s*street|inflation|deflation|trade|tariff|commerce|commercial\s*treaty|corporation|market\s*crash|great\s*depression|gdp|export|import|customs|debt|merchant|mercantile|recession)\b/i.test(
      text
    )
  ) {
    return 'Economy & Trade';
  }

  // 10. Scope-specific categories:
  if (isIndia) {
    // Society & Movements (India)
    if (
      /\b(movement|satyagraha|protest|strike|reform|reformer|caste|dalit|untouchab|women's\s*rights|suffrage|peasant|labor\s*union|trade\s*union|boycott|swadeshi|demonstration|agitation|civil\s*disobedience|hartal|untouchability|bhoodan|chipko)\b/i.test(
        text
      )
    ) {
      return 'Society & Movements';
    }
  } else {
    // Exploration & Geography (World)
    if (
      /\b(expedition|explorer|explore|voyage|circumnavigat|antarctica|arctic|north\s*pole|south\s*pole|discovered\s*the\s*island|strait|passage|charted|mapmaker|cartograph|columbus|magellan|cook|hudson|amundsen|shackleton|mount\s*everest)\b/i.test(
        text
      )
    ) {
      return 'Exploration & Geography';
    }

    // Society & Human Rights (World)
    if (
      /\b(human\s*rights|civil\s*rights|civil\s*liberties|slavery|slave\s*trade|abolition|emancipation|suffrage|suffragette|apartheid|segregation|protest|demonstration|strike|labor\s*movement|trade\s*union|refugee|amnesty|unicef|genocide\s*convention|civil\s*rights\s*movement)\b/i.test(
        text
      )
    ) {
      return 'Society & Human Rights';
    }
  }

  // 11. Culture & Arts
  if (
    /\b(art|artist|painting|painter|sculpture|museum|gallery|theater|theatre|novel|literature|poet|poetry|author|writer|playwright|music|musical|composer|symphony|opera|orchestra|film|cinema|movie|premiere|exhibition|broadway|grammy|oscar|nobel\s*prize\s*in\s*literature|architecture|architect|monument|folklore)\b/i.test(
      text
    )
  ) {
    return 'Culture & Arts';
  }

  // 12. Default / Fallback: Politics & Governance
  // (Handles elections, treaties, kings, presidents, prime ministers, legislation, constitutions, summits, statehood)
  return 'Politics & Governance';
}

/**
 * Derive a concise, high-clarity 1-2 line summary from existing event information.
 * Rule: Must be grounded in existing stored facts. No invented context or external LLM calls.
 * Length: ~50-160 characters (1-2 lines).
 */
export function deriveShortDescription(title, content, category, year) {
  const cleanTitle = (title || '').trim();
  const rawContent = (content || '').trim();

  if (!rawContent && !cleanTitle) {
    return 'Historical event recorded on this day.';
  }

  // Clean raw content: remove Wikipedia citations [1], [note 2], html tags, extra whitespace
  const sanitized = rawContent
    .replace(/<[^>]+>/g, '')
    .replace(/\[\s*(?:\d+|note\s*\d+|citation needed)\s*\]/gi, '')
    .replace(/^(?:(?:on\s+this\s+day|in\s+\d+|in\s+\d+\s*ad|in\s+\d+\s*bc)[,:\s-]+)/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If content has text, extract the primary explanatory sentence
  if (sanitized) {
    // Split sentences respecting abbreviations (e.g., St., U.S., etc.)
    const sentences = sanitized
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'])/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length > 0) {
      let firstSentence = sentences[0];

      // Remove redundant leading title prefix if content starts with "Title: ..." or "Title – ..."
      if (cleanTitle && firstSentence.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
        const withoutTitle = firstSentence.slice(cleanTitle.length).replace(/^[:\s–—-]+/, '').trim();
        if (withoutTitle.length > 15) {
          firstSentence = withoutTitle.charAt(0).toUpperCase() + withoutTitle.slice(1);
        }
      }

      // If the first sentence is very short (< 35 chars) and a second sentence exists, combine them
      if (firstSentence.length < 35 && sentences.length > 1) {
        const combined = `${firstSentence} ${sentences[1]}`.trim();
        if (combined.length <= 180) {
          firstSentence = combined;
        }
      }

      // If within target length (40 - 180 chars), return clean sentence
      if (firstSentence.length <= 180) {
        if (!/[.!?]$/.test(firstSentence)) firstSentence += '.';
        return firstSentence;
      }

      // If sentence is excessively long, truncate cleanly at word boundary
      const truncated = firstSentence.slice(0, 160).replace(/[,;:\s]+[^,;:\s]*$/, '').trim();
      return `${truncated}.`;
    }
  }

  // Factual, lightweight fallback if stored description is empty or identical to title
  const cleanYear = year ? ` in ${year}` : '';
  if (category === 'Births') {
    return `Birth of ${cleanTitle}${cleanYear}.`;
  }
  if (category === 'Deaths') {
    return `Passing of ${cleanTitle}${cleanYear}.`;
  }
  if (category === 'Festivals & Holidays' || category === 'Holidays & Observances') {
    return `Global and regional observance of ${cleanTitle}.`;
  }
  return `Historical milestone commemorating ${cleanTitle}${cleanYear}.`;
}

/**
 * Distinct badge styling for each category.
 */
export function getCategoryBadgeClass(category) {
  switch (category) {
    case 'Politics & Governance':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    case 'Wars & Military':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'Society & Movements':
    case 'Society & Human Rights':
      return 'bg-amber-50 text-amber-900 border-amber-300';
    case 'Culture & Arts':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'Religion & Philosophy':
      return 'bg-purple-50 text-purple-800 border-purple-200';
    case 'Science & Technology':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'Economy & Trade':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Sports':
      return 'bg-teal-50 text-teal-800 border-teal-200';
    case 'Exploration & Geography':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'Disasters & Environment':
      return 'bg-orange-50 text-orange-900 border-orange-200';
    case 'Festivals & Holidays':
    case 'Holidays & Observances':
      return 'bg-amber-100/70 text-amber-900 border-amber-300';
    case 'Births':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Deaths':
      return 'bg-slate-100 text-slate-800 border-slate-300';
    default:
      return 'bg-histo-copper/10 text-histo-copper border-histo-copper/25';
  }
}
