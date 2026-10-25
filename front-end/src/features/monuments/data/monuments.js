import registry from './registry.generated.json';

const asset = (id, file) => `${import.meta.env.BASE_URL}models/monuments/${id}/${file}`;
const source = (number, title) => ({ id: 'unesco', title, url: `https://whc.unesco.org/en/list/${number}/` });
const hotspot = (id, title, text, position, target, orbit, options = {}) => ({ id, title, text, position, normal: '0 0 1', target, orbit, sourceId: 'unesco', ...options });
const raw = [
  {
    id: 'great-pyramid', aliases: ['Great Pyramid of Giza', 'Pyramid of Khufu', 'Cheops', 'Giza'],
    country: 'Egypt', location: 'Giza, Egypt', civilization: 'Ancient Egypt', period: 'Ancient', date: 'Old Kingdom',
    tags: ['pyramid', 'tomb', 'ancient', 'khufu'], accent: '#c9a267',
    summary: 'Explore the form of the Great Pyramid of Khufu, part of the pyramid fields associated with ancient Memphis. Its setting connects royal burial, architecture, and the organization of the Old Kingdom.',
    dateNote: 'The period label describes its historical context; this illustration does not show a particular construction stage.',
    sources: [source(86, 'UNESCO · Memphis and its Necropolis')],
    camera: { orbit: '35deg 68deg 15m', target: '0m 1.6m 0m' },
    alt: 'Simplified sandstone-colored square pyramid on a base with illustrative course lines.',
    hotspots: [
      hotspot('form', 'The pyramid form', 'The pyramid fields preserve the evolution of royal tomb design, from mastabas to monumental pyramids.', '0m 2.6m 1.05m', '0m 1.9m 0m', '25deg 65deg 11m'),
      hotspot('khufu', 'A royal monument', 'UNESCO identifies the Great Pyramid of Khufu as the surviving wonder of the ancient world. This small model illustrates its outer form only.', '0m 1.15m 2.2m', '0m 1.2m 0m', '0deg 78deg 10m'),
      hotspot('landscape', 'A wider funerary landscape', 'The protected property includes tombs, temples, settlements, and several pyramid fields. The single pyramid shown here is only a small part of that landscape.', '2.7m 0.2m 2.8m', '0m 0.5m 0m', '45deg 40deg 16m'),
      hotspot('summit', 'From mastabas to pyramids', 'The pointed silhouette belongs to a longer evolution of Egyptian royal tomb architecture. Earlier mastabas are outside this model.', '0m 3.65m 0.24m', '0m 3.1m 0m', '15deg 70deg 8m'),
      hotspot('courses', 'Reading the stonework', 'UNESCO highlights ancient construction techniques. These horizontal seams suggest masonry courses; their spacing and number are illustrative.', '-1.2m 1.65m 1.81m', '-0.6m 1.5m 0.7m', '-20deg 70deg 9m'),
      hotspot('royal-tombs', 'Royal burial traditions', 'The necropolis records changing burial practices across Egyptian dynasties. Internal chambers and burial furnishings are not modeled here.', '-0.9m 0.75m 2.51m', '0m 0.9m 0m', '-15deg 76deg 10m', {contextOnly: true}),
      hotspot('memphis', 'Connected to Memphis', 'The pyramid fields belonged to the necropolis of Memphis, a centre of royal administration. The ancient city is not shown.', '1.9m 0.3m 2.86m', '0m 0.4m 0m', '30deg 50deg 15m', {contextOnly: true}),
      hotspot('conservation', 'Preserving an ancient landscape', 'Development pressures affect the wider site. Conservation protects both the monuments and their relationship to the surrounding landscape.', '0.7m 2.4m 1.22m', '0m 2.1m 0m', '30deg 65deg 10m', {contextOnly: true}),
    ],
  },
  {
    id: 'taj-mahal', aliases: ['Taj', 'ताज महल'],
    country: 'India', location: 'Agra, India', civilization: 'Mughal Empire', period: 'Early modern', date: '1632–1653 CE',
    tags: ['mausoleum', 'marble', 'mughal', 'agra'], accent: '#d8d0b9',
    summary: 'Discover a Mughal mausoleum commissioned by Shah Jahan in memory of Mumtaz Mahal. The model highlights its central dome, raised platform, and four freestanding minarets.',
    dateNote: 'UNESCO’s detailed account dates the mausoleum to 1632–1648, with additional buildings completed by 1653; its brief description uses 1631 as the starting year.',
    sources: [source(252, 'UNESCO · Taj Mahal')],
    camera: { orbit: '25deg 68deg 18m', target: '0m 1.8m 0m' },
    alt: 'Simplified ivory-colored Taj Mahal with a central dome, four minarets, raised base, and a suggested garden axis.',
    hotspots: [
      hotspot('dome', 'The central dome', 'Arches and domes are central to the monument’s architectural composition. The original includes detailed surface decoration omitted from this illustration.', '0m 3.6m 0.3m', '0m 3m -0.4m', '20deg 72deg 10m'),
      hotspot('minarets', 'Four minarets', 'Four freestanding minarets stand at the platform corners, framing the central mausoleum.', '3.35m 2.5m 2.25m', '2m 1.8m 0.6m', '45deg 70deg 12m'),
      hotspot('platform', 'Platform and symmetry', 'The tomb sits on a raised platform. A central axis organizes the complex, with the tomb positioned at one end of its divided garden.', '0m 0.4m 2.9m', '0m 0.8m 0m', '0deg 45deg 18m'),
      hotspot('portal', 'The entrance portal', 'Portal halls surround the central tomb chamber. The dark recesses here suggest entrances; their detailed arches are simplified.', '0m 1.3m 1.24m', '0m 1.35m 0.5m', '0deg 78deg 8m'),
      hotspot('marble', 'Marble and stone inlay', 'The real monument combines marble relief and stone inlay. This plain surface omits its floral decoration.', '-1.35m 1.9m 1.22m', '-0.8m 1.7m 0.4m', '-20deg 73deg 8m'),
      hotspot('garden', 'A garden divided into quarters', 'Walkways divide the original garden into four quarters. This short foreground strip only suggests the garden axis.', '0m 0.4m 4.45m', '0m 0.4m 2.5m', '0deg 35deg 15m'),
      hotspot('cenotaphs', 'Cenotaphs and the crypt', 'Memorial cenotaphs occupy the upper chamber; the actual graves lie below. Neither chamber is included in this exterior model.', '1.05m 0.85m 1.22m', '0m 1.2m 0m', '20deg 77deg 10m', {contextOnly: true}),
      hotspot('craftsmanship', 'The people behind the monument', 'Specialist artisans came from across the empire, Central Asia, and Iran. Their calligraphy and intricate carving are not reproduced.', '1.3m 2.8m 0.95m', '0.8m 2.5m 0m', '35deg 65deg 10m', {contextOnly: true}),
    ],
  },
  {
    id: 'qutub-minar', aliases: ['Qutb Minar', 'Qutab Minar', 'क़ुतुब मीनार'],
    country: 'India', location: 'Delhi, India', civilization: 'Delhi Sultanate', period: 'Medieval', date: 'From 1199 CE',
    tags: ['tower', 'minaret', 'sandstone', 'delhi'], accent: '#b87850',
    summary: 'Examine the tapering form and projecting balconies of the Qutb Minar. The tower belongs to a larger Delhi complex reflecting early Islamic architecture in the Indian subcontinent.',
    dateNote: 'The monument was developed and repaired over successive reigns; UNESCO describes construction activity between 1199 and 1503.',
    sources: [source(233, 'UNESCO · Qutb Minar and its Monuments')],
    camera: { orbit: '25deg 78deg 18m', target: '0m 3.3m 0m' },
    alt: 'Simplified tapering Qutub Minar with five sections, projecting balcony rings, and suggested vertical ribs.',
    hotspots: [
      hotspot('shaft', 'A tapering tower', 'UNESCO records a height of 72.5 metres. The model uses illustrative tabletop units rather than real-world scale.', '0m 1.1m 0.66m', '0m 1.4m 0m', '10deg 80deg 6m'),
      hotspot('balconies', 'Projecting balconies', 'Balconies interrupt the tower’s vertical form. Sandstone surfaces include carved inscriptional bands that are not reproduced in this simplified model.', '0m 3.73m 0.6m', '0m 3.7m 0m', '15deg 76deg 6m'),
      hotspot('complex', 'Part of a larger complex', 'Mosques, tombs, gateways, and the Iron Pillar contribute to the significance of the surrounding site. They are outside the model shown here.', '1.65m 0.18m 1.4m', '0m 2.5m 0m', '30deg 65deg 17m', {contextOnly: true}),
      hotspot('sandstone', 'Sandstone materials', 'UNESCO describes red and buff sandstone. The model uses approximate colours rather than a surveyed material map.', '0.25m 0.55m 0.65m', '0m 0.8m 0m', '20deg 80deg 6m'),
      hotspot('fluting', 'Angular and rounded fluting', 'The tower combines angular and rounded fluting. These simplified vertical ribs suggest that texture without reproducing its precise patterns.', '-0.15m 2.65m 0.5m', '0m 2.7m 0m', '-15deg 80deg 6m'),
      hotspot('inscriptions', 'Carved inscriptional bands', 'Inscriptions decorate the real sandstone surfaces. The plain bands shown here are visual placeholders, not readable historical inscriptions.', '0.1m 4.5m 0.38m', '0m 4.45m 0m', '15deg 78deg 5m'),
      hotspot('history', 'Built across successive reigns', 'UNESCO places construction activity between 1199 and 1503. This model does not reconstruct individual building phases.', '-0.1m 5.5m 0.3m', '0m 5.4m 0m', '-15deg 78deg 5m', {contextOnly: true}),
      hotspot('restoration', 'Conservation and repair', 'Conservation work respects the monument’s original construction and ornament. Its maintenance includes measures intended to remain reversible.', '0m 6.65m 0.22m', '0m 6.1m 0m', '15deg 76deg 6m', {contextOnly: true}),
    ],
  },
];

export const monuments = raw.map(m => ({
  ...m, ...registry.find(entry=>entry.id===m.id), model: asset(m.id, 'monument.glb'), poster: asset(m.id, 'poster.svg'),
  representation: 'Simplified educational illustration',
  disclaimer: 'Original illustrative geometry. Proportions, materials, and details are approximate; this is not a survey or an accurate historical reconstruction.',
  attribution: { creator: 'HistoFacts', license: 'MIT', licenseUrl: `${import.meta.env.BASE_URL}models/monuments/LICENSE.txt`, source: 'scripts/generate-monuments.mjs', revision: 1 },
}));
export const getMonument = id => monuments.find(m => m.id === id);
