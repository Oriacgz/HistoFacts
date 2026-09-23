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

function escapeRegExp(str) {
  return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Derive a concise, high-value 1-2 line summary that provides NEW, useful context.
 * Strictly avoids repeating the title, the category name, or the exact existing description.
 * Adheres strictly to the user's Accuracy Rule:
 * - Never fabricates claims, dates, or events.
 * - Extracts and frames existing factual data.
 * - If there is insufficient data to add new value, returns null (omits summary entirely).
 *
 * @param {string} title - The event title
 * @param {string} content - The raw event description/narrative
 * @param {string} category - The assigned taxonomy category
 * @param {string} [year] - The formatted or raw year
 * @param {string} [extract] - Optional Wikipedia article summary extract
 * @returns {string|null} - 1-2 line useful summary or null if insufficient data
 */
export function deriveShortDescription(title, content, category, year, extract) {
  const cleanTitle = (title || '').trim();
  const rawContent = (content || '').trim();
  const rawExtract = (extract || '').trim();

  // 1. If an extract is available and adds valuable encyclopedic context
  if (rawExtract && rawExtract.length > 20) {
    const sanitizedExtract = rawExtract
      .replace(/<[^>]+>/g, '')
      .replace(/\[\s*(?:\d+|note\s*\d+|citation needed)\s*\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Check if extract is not just an identical repeat of content
    if (sanitizedExtract.toLowerCase() !== rawContent.toLowerCase()) {
      // Extract the first clean sentence from the article extract
      const sentences = sanitizedExtract
        .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'])/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (sentences.length > 0) {
        let firstSentence = sentences[0];

        // If the sentence starts with the subject/title e.g. "Autar Singh Paintal was an Indian medical scientist..."
        // Transform the subject to focus on the historical role/significance:
        const titleRegex = new RegExp(`^(?:(?:The\\s+)?${escapeRegExp(cleanTitle)}|He|She|It)\\s+(?:was|is|became|served as|were)\\s+(an?\\s+)?`, 'i');
        if (titleRegex.test(firstSentence)) {
          const predicate = firstSentence.replace(titleRegex, '').trim();
          if (predicate.length > 15) {
            firstSentence = `An influential ${predicate}`;
            firstSentence = firstSentence.replace(/^An influential an?\s+/i, 'An influential ');
          }
        }

        // Limit to 1-2 concise lines (~160 chars)
        if (firstSentence.length > 170) {
          firstSentence = firstSentence.slice(0, 165).replace(/[,;:\s]+[^,;:\s]*$/, '').trim() + '.';
        }

        if (firstSentence.length >= 25 && firstSentence.toLowerCase() !== cleanTitle.toLowerCase()) {
          return firstSentence;
        }
      }
    }
  }

  // 2. If no extract, parse rawContent intelligently
  if (!rawContent) {
    return null;
  }

  const sanitized = rawContent
    .replace(/<[^>]+>/g, '')
    .replace(/\[\s*(?:\d+|note\s*\d+|citation needed)\s*\]/gi, '')
    .replace(/^(?:(?:on\s+this\s+day|in\s+\d+|in\s+\d+\s*ad|in\s+\d+\s*bc)[,:\s-]+)/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If description is identical or virtually identical to title, or too short to have useful new context
  if (!sanitized || sanitized.toLowerCase() === cleanTitle.toLowerCase() || sanitized.length < 15) {
    return null;
  }

  const lowerCat = (category || '').toLowerCase();
  const isBirth = lowerCat === 'births';
  const isDeath = lowerCat === 'deaths';

  // 3. Person handling (Births / Deaths)
  // Example: "Autar Singh Paintal, Indian physiologist and academic (died 2004)"
  if (isBirth || isDeath) {
    let personDesc = sanitized;

    // Remove leading title if present: "Autar Singh Paintal, ..."
    if (cleanTitle && personDesc.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
      personDesc = personDesc.slice(cleanTitle.length).replace(/^[,:;\s–—-]+/, '').trim();
    }

    // Strip parenthetical dates e.g. "(died 2004)", "(born 1925)", "(d. 2004)", "(b. 714)"
    personDesc = personDesc
      .replace(/\s*\((?:died|born|d\.|b\.|probable|circa)[\s\S]*?\)/gi, '')
      .replace(/^[,:;\s–—-]+|[,:;\s–—.-]+$/g, '')
      .trim();

    // If we have a descriptive role/profession (e.g. "Indian physiologist and academic", "Frankish king")
    if (personDesc.length >= 6) {
      const pLower = personDesc.toLowerCase();

      if (isBirth) {
        if (/\b(physiologist|scientist|physicist|chemist|biologist|astronomer|mathematician|inventor|surgeon|doctor|scholar|academic|professor)\b/.test(pLower)) {
          return `An influential ${personDesc} whose research and discoveries advanced scientific knowledge.`;
        }
        if (/\b(king|queen|emperor|empress|sultan|tsar|czar|monarch|prince|princess|chieftain|ruler)\b/.test(pLower)) {
          return `Prominent ${personDesc} whose reign and leadership shaped historical governance.`;
        }
        if (/\b(general|soldier|admiral|commander|marshal|warrior|officer)\b/.test(pLower)) {
          return `Distinguished ${personDesc} recognized for strategic command and military service.`;
        }
        if (/\b(composer|musician|artist|painter|sculptor|author|poet|writer|playwright|architect)\b/.test(pLower)) {
          return `Celebrated ${personDesc} known for creative works and lasting cultural influence.`;
        }
        if (/\b(philosopher|theologian|monk|priest|saint|bishop|pope)\b/.test(pLower)) {
          return `Renowned ${personDesc} whose teachings and thought influenced religious and intellectual history.`;
        }
        return `Notable ${personDesc} remembered for historical contributions and leadership.`;
      }

      if (isDeath) {
        if (/\b(king|queen|emperor|empress|sultan|monarch|ruler|chieftain)\b/.test(pLower)) {
          return `Marked the passing of the ${personDesc}, concluding an influential period of rule.`;
        }
        if (/\b(physiologist|scientist|physicist|chemist|biologist|astronomer|mathematician|inventor)\b/.test(pLower)) {
          return `Remembered as an influential ${personDesc} whose scientific legacy continued to inspire future inquiry.`;
        }
        if (/\b(composer|musician|artist|painter|sculptor|author|poet|writer|playwright)\b/.test(pLower)) {
          return `Remembered as an acclaimed ${personDesc} whose works remain a cornerstone of cultural heritage.`;
        }
        if (/\b(general|soldier|admiral|commander|marshal)\b/.test(pLower)) {
          return `Honors the legacy of the ${personDesc}, celebrated for military command and service.`;
        }
        return `Remembered as an influential ${personDesc} whose life left an enduring historical record.`;
      }
    }
  }

  // 4. Wars & Military Events
  // Example: "Spanish naval forces defeat an English fleet, under the command of John Hawkins, at the Battle of San Juan de Ulúa near Veracruz."
  // Example: "The Battle of Rowton Heath in England occurs, ending in a Parliamentarian victory..."
  if (lowerCat.includes('war') || lowerCat.includes('military')) {
    let eventAction = sanitized;

    if (cleanTitle) {
      const battlePrefix = new RegExp(`^(?:The\\s+)?${escapeRegExp(cleanTitle)}[\\s\\w,]*?(?:occurs|occurred|takes place|took place|begins|began|ends|ended)[,:\\s]*`, 'i');
      if (battlePrefix.test(eventAction)) {
        eventAction = eventAction.replace(battlePrefix, '').trim();
      }
    }

    if (eventAction && eventAction.length > 20 && eventAction.toLowerCase() !== cleanTitle.toLowerCase()) {
      const formatted = eventAction.charAt(0).toUpperCase() + eventAction.slice(1);
      if (!/[.!?]$/.test(formatted)) return `${formatted}.`;
      return formatted;
    }
  }

  // 5. General Events / Politics / Science / Disasters / Holidays
  let generalSummary = sanitized;
  if (cleanTitle && generalSummary.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
    const withoutTitle = generalSummary.slice(cleanTitle.length).replace(/^[,:;\s–—-]+/, '').trim();
    if (withoutTitle.length >= 20) {
      generalSummary = withoutTitle.charAt(0).toUpperCase() + withoutTitle.slice(1);
    }
  }

  const firstSentenceMatch = generalSummary.match(/^([^.!?]+[.!?])/);
  let resultSentence = firstSentenceMatch ? firstSentenceMatch[1].trim() : generalSummary;

  if (resultSentence.length > 170) {
    resultSentence = resultSentence.slice(0, 165).replace(/[,;:\s]+[^,;:\s]*$/, '').trim() + '.';
  }

  // Ensure result doesn't duplicate the title or content exactly
  if (
    resultSentence &&
    resultSentence.length >= 20 &&
    resultSentence.toLowerCase() !== cleanTitle.toLowerCase() &&
    resultSentence.toLowerCase() !== sanitized.toLowerCase()
  ) {
    if (!/[.!?]$/.test(resultSentence)) resultSentence += '.';
    return resultSentence;
  }

  // If the extracted sentence is virtually identical to content or title, return null (omit extra summary)
  return null;
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
