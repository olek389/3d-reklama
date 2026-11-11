// Dane statyczne gry: regiony, połączenia, ulepszenia obu stron.

// climate: 'cold' | 'temp' | 'hot'   wealth: 0 biedny, 1 średni, 2 bogaty
export const REGIONS = [
  { id: 'can', name: 'Kanada', pop: 39, x: 215, y: 75, climate: 'cold', wealth: 2 },
  { id: 'usa', name: 'USA', pop: 335, x: 225, y: 158, climate: 'temp', wealth: 2 },
  { id: 'mex', name: 'Meksyk', pop: 128, x: 205, y: 232, climate: 'hot', wealth: 1 },
  { id: 'and', name: 'Andy', pop: 140, x: 285, y: 305, climate: 'hot', wealth: 0 },
  { id: 'bra', name: 'Brazylia', pop: 216, x: 365, y: 360, climate: 'hot', wealth: 1 },
  { id: 'arg', name: 'Argentyna', pop: 65, x: 318, y: 455, climate: 'temp', wealth: 1 },
  { id: 'gbr', name: 'Wlk. Brytania', pop: 68, x: 462, y: 92, climate: 'temp', wealth: 2 },
  { id: 'weu', name: 'Europa Zach.', pop: 98, x: 492, y: 138, climate: 'temp', wealth: 2 },
  { id: 'deu', name: 'Niemcy', pop: 84, x: 530, y: 104, climate: 'temp', wealth: 2 },
  { id: 'pol', name: 'Polska', pop: 38, x: 578, y: 108, climate: 'temp', wealth: 1 },
  { id: 'sca', name: 'Skandynawia', pop: 27, x: 545, y: 48, climate: 'cold', wealth: 2 },
  { id: 'seu', name: 'Europa Płd.', pop: 125, x: 545, y: 162, climate: 'temp', wealth: 1 },
  { id: 'rus', name: 'Rosja', pop: 145, x: 690, y: 72, climate: 'cold', wealth: 1 },
  { id: 'naf', name: 'Afryka Płn.', pop: 260, x: 528, y: 228, climate: 'hot', wealth: 0 },
  { id: 'waf', name: 'Afryka Zach.', pop: 430, x: 488, y: 300, climate: 'hot', wealth: 0 },
  { id: 'eaf', name: 'Afryka Wsch.', pop: 470, x: 610, y: 322, climate: 'hot', wealth: 0 },
  { id: 'saf', name: 'Afryka Płd.', pop: 230, x: 568, y: 425, climate: 'temp', wealth: 0 },
  { id: 'mea', name: 'Bliski Wschód', pop: 420, x: 632, y: 205, climate: 'hot', wealth: 1 },
  { id: 'ind', name: 'Indie', pop: 1430, x: 722, y: 238, climate: 'hot', wealth: 0 },
  { id: 'chn', name: 'Chiny', pop: 1410, x: 800, y: 160, climate: 'temp', wealth: 1 },
  { id: 'jpn', name: 'Japonia', pop: 175, x: 900, y: 150, climate: 'temp', wealth: 2 },
  { id: 'sea', name: 'Azja Płd.-Wsch.', pop: 450, x: 795, y: 268, climate: 'hot', wealth: 0 },
  { id: 'idn', name: 'Indonezja', pop: 395, x: 835, y: 338, climate: 'hot', wealth: 0 },
  { id: 'aus', name: 'Australia', pop: 32, x: 880, y: 430, climate: 'hot', wealth: 2 },
];

const L = (type, pairs) => pairs.map(([a, b]) => ({ a, b, type }));

export const LINKS = [
  ...L('land', [
    ['can', 'usa'], ['usa', 'mex'], ['mex', 'and'], ['and', 'bra'], ['and', 'arg'], ['bra', 'arg'],
    ['gbr', 'weu'], ['weu', 'deu'], ['weu', 'seu'], ['deu', 'pol'], ['deu', 'sca'], ['deu', 'seu'],
    ['pol', 'rus'], ['sca', 'rus'], ['naf', 'waf'], ['naf', 'eaf'], ['naf', 'mea'], ['waf', 'eaf'],
    ['eaf', 'saf'], ['waf', 'saf'], ['mea', 'seu'], ['mea', 'rus'], ['mea', 'ind'], ['rus', 'chn'],
    ['ind', 'chn'], ['chn', 'sea'], ['ind', 'sea'],
  ]),
  ...L('air', [
    ['usa', 'gbr'], ['usa', 'weu'], ['usa', 'jpn'], ['usa', 'chn'], ['usa', 'bra'], ['can', 'gbr'],
    ['gbr', 'ind'], ['gbr', 'mea'], ['weu', 'waf'], ['weu', 'naf'], ['deu', 'chn'], ['deu', 'rus'],
    ['pol', 'gbr'], ['seu', 'arg'], ['sca', 'usa'], ['mea', 'sea'], ['mea', 'eaf'], ['chn', 'jpn'],
    ['sea', 'aus'], ['jpn', 'aus'], ['and', 'usa'], ['saf', 'gbr'], ['idn', 'jpn'], ['ind', 'idn'],
    ['mex', 'weu'],
  ]),
  ...L('sea', [
    ['bra', 'waf'], ['arg', 'saf'], ['can', 'sca'], ['chn', 'usa'], ['idn', 'ind'], ['eaf', 'ind'],
    ['saf', 'aus'], ['sea', 'idn'], ['aus', 'idn'], ['seu', 'naf'], ['gbr', 'sca'], ['jpn', 'sea'],
    ['mex', 'bra'], ['pol', 'sca'], ['rus', 'jpn'],
  ]),
];

export const LINK_NAMES = { land: 'lądem', air: 'samolotem', sea: 'statkiem' };
export const CLIMATE_NAMES = { cold: 'zimny', temp: 'umiarkowany', hot: 'gorący' };
export const WEALTH_NAMES = ['biedny', 'średnio zamożny', 'bogaty'];

// ---------------------------------------------------------------- WIRUS
export const VIRUS_TREES = [
  { id: 'trans', name: 'Przenoszenie' },
  { id: 'symp', name: 'Objawy' },
  { id: 'abil', name: 'Zdolności' },
];

export const VIRUS_UPGRADES = [
  // Przenoszenie
  { id: 'air1', tree: 'trans', name: 'Droga kropelkowa', cost: 9, desc: 'Większa zakaźność. Łatwiejsze przenoszenie samolotami.', fx: { air: 1, infAir: 2 } },
  { id: 'air2', tree: 'trans', name: 'Aerozol', cost: 16, req: ['air1'], desc: 'Dużo większa zakaźność. Samoloty roznoszą patogen znacznie skuteczniej.', fx: { air: 1, infAir: 3 } },
  { id: 'water1', tree: 'trans', name: 'Skażona woda', cost: 9, desc: 'Większa zakaźność. Łatwiejsze przenoszenie statkami.', fx: { water: 1, infWater: 2 } },
  { id: 'water2', tree: 'trans', name: 'Przetrwanie w wodzie', cost: 16, req: ['water1'], desc: 'Dużo większa zakaźność. Statki roznoszą patogen znacznie skuteczniej.', fx: { water: 1, infWater: 3 } },
  { id: 'blood1', tree: 'trans', name: 'Krew', cost: 8, desc: 'Większa zakaźność, szczególnie w biednych regionach.', fx: { vector: 1, infVector: 2 } },
  { id: 'animal1', tree: 'trans', name: 'Zwierzęta', cost: 10, desc: 'Większa zakaźność w biednych regionach. Łatwiej przekracza granice lądowe.', fx: { vector: 1, land: 1, infVector: 2 } },
  { id: 'insect1', tree: 'trans', name: 'Owady', cost: 14, req: ['blood1', 'animal1'], desc: 'Dużo większa zakaźność w gorącym klimacie i biednych regionach.', fx: { vector: 1, heat: 0.5, infVector: 3 } },
  // Objawy
  { id: 'cough', tree: 'symp', name: 'Kaszel', cost: 5, desc: 'Zakaźność +, uciążliwość +.', fx: { inf: 2, sev: 1 } },
  { id: 'rash', tree: 'symp', name: 'Wysypka', cost: 4, desc: 'Niewielki wzrost zakaźności i uciążliwości.', fx: { inf: 1, sev: 1 } },
  { id: 'sneeze', tree: 'symp', name: 'Kichanie', cost: 9, req: ['cough'], desc: 'Duży wzrost zakaźności.', fx: { inf: 3, sev: 1 } },
  { id: 'fever', tree: 'symp', name: 'Gorączka', cost: 10, req: ['cough', 'rash'], desc: 'Uciążliwość ++, pierwsze zgony.', fx: { inf: 1, sev: 3, leth: 1 } },
  { id: 'pneumonia', tree: 'symp', name: 'Zapalenie płuc', cost: 15, req: ['fever'], desc: 'Uciążliwość ++, śmiertelność ++.', fx: { inf: 1, sev: 3, leth: 3 } },
  { id: 'organ', tree: 'symp', name: 'Niewydolność narządów', cost: 22, req: ['pneumonia'], desc: 'Śmiertelność +++.', fx: { sev: 4, leth: 6 } },
  { id: 'hemo', tree: 'symp', name: 'Gorączka krwotoczna', cost: 28, req: ['organ'], desc: 'Śmiertelność ++++, zakaźność +.', fx: { inf: 2, sev: 5, leth: 8 } },
  // Zdolności
  { id: 'cold1', tree: 'abil', name: 'Odporność na zimno', cost: 10, desc: 'Patogen normalnie rozwija się w zimnym klimacie.', fx: { cold: 1 } },
  { id: 'heat1', tree: 'abil', name: 'Odporność na upał', cost: 12, desc: 'Patogen normalnie rozwija się w gorącym klimacie.', fx: { heat: 1 } },
  { id: 'drug1', tree: 'abil', name: 'Lekooporność', cost: 12, desc: 'Lepiej radzi sobie w bogatych regionach. Osłabia szpitale i leki.', fx: { drug: 1 } },
  { id: 'drug2', tree: 'abil', name: 'Wielolekooporność', cost: 20, req: ['drug1'], desc: 'Bogate regiony przestają być przeszkodą. Leczenie niemal nie działa.', fx: { drug: 1 } },
  { id: 'stealth', tree: 'abil', name: 'Uśpienie', cost: 14, desc: 'Trudniej wykryć ogniska. Badania nad lekiem postępują wolniej.', fx: { stealth: 1 } },
  { id: 'harden', tree: 'abil', name: 'Odporność środowiskowa', cost: 16, desc: 'Kwarantanny i zamknięte granice są dużo mniej szczelne.', fx: { harden: 1 } },
  { id: 'shuffle', tree: 'abil', name: 'Przetasowanie genów', cost: 12, costStep: 6, repeatable: true, needsDetection: true, desc: 'Cofa postęp prac nad lekiem. Każde kolejne użycie jest droższe.', fx: {} },
];

// --------------------------------------------------------------- OBROŃCA
export const DEF_TREES = [
  { id: 'med', name: 'Medycyna' },
  { id: 'ctrl', name: 'Kontrola' },
  { id: 'intel', name: 'Wywiad' },
];

export const DEF_UPGRADES = [
  // Medycyna
  { id: 'm_lab', tree: 'med', name: 'Laboratoria krajowe', cost: 10, desc: 'Badania nad lekiem +60%.', fx: { research: 1.6 } },
  { id: 'm_seq', tree: 'med', name: 'Sekwencjonowanie genomu', cost: 14, req: ['m_lab'], desc: 'Badania nad lekiem +30%.', fx: { research: 1.3 } },
  { id: 'm_cons', tree: 'med', name: 'Globalne konsorcjum', cost: 20, req: ['m_seq'], desc: 'Badania nad lekiem +40%.', fx: { research: 1.4 } },
  { id: 'm_trial', tree: 'med', name: 'Przyspieszone badania kliniczne', cost: 26, req: ['m_cons'], desc: 'Badania nad lekiem +40%.', fx: { research: 1.4 } },
  { id: 'm_hosp', tree: 'med', name: 'Szpitale polowe', cost: 10, desc: 'Śmiertelność −25%.', fx: { leth: 0.75 } },
  { id: 'm_antiv', tree: 'med', name: 'Leki przeciwwirusowe', cost: 16, req: ['m_hosp'], desc: 'Śmiertelność −30%.', fx: { leth: 0.7 } },
  { id: 'm_immun', tree: 'med', name: 'Profilaktyka i środki ochrony', cost: 16, desc: 'Zakażenia w bogatych i średnio zamożnych regionach −20%.', fx: { immun: 0.8 } },
  // Kontrola
  { id: 'c_air', tree: 'ctrl', name: 'Kontrola lotnisk', cost: 8, desc: 'Odblokowuje zamykanie lotnisk w regionach.', fx: { unlock: 'air' } },
  { id: 'c_port', tree: 'ctrl', name: 'Kontrola portów', cost: 7, desc: 'Odblokowuje zamykanie portów morskich.', fx: { unlock: 'sea' } },
  { id: 'c_border', tree: 'ctrl', name: 'Straż graniczna', cost: 8, desc: 'Odblokowuje zamykanie granic lądowych.', fx: { unlock: 'land' } },
  { id: 'c_quar', tree: 'ctrl', name: 'Protokół kwarantanny', cost: 14, desc: 'Odblokowuje kwarantannę regionu (mocno spowalnia zakażenia).', fx: { unlock: 'quar' } },
  { id: 'c_dist', tree: 'ctrl', name: 'Dystans społeczny', cost: 12, desc: 'O połowę osłabia przenoszenie drogą kropelkową. Zaufanie −8.', fx: { cutAir: 0.5, trustNow: -8 } },
  { id: 'c_water', tree: 'ctrl', name: 'Uzdatnianie wody', cost: 12, desc: 'O połowę osłabia przenoszenie przez wodę.', fx: { cutWater: 0.5 } },
  { id: 'c_vector', tree: 'ctrl', name: 'Kontrola wektorów i krwi', cost: 12, desc: 'O połowę osłabia przenoszenie przez krew, zwierzęta i owady.', fx: { cutVector: 0.5 } },
  // Wywiad
  { id: 'i_test', tree: 'intel', name: 'Testy masowe', cost: 9, desc: 'Ogniska wykrywane znacznie wcześniej. Dokładne liczby zakażonych.', fx: { tests: 1 } },
  { id: 'i_surv', tree: 'intel', name: 'Nadzór epidemiologiczny', cost: 9, desc: 'Ujawnia objawy i siłę patogenu.', fx: { surv: 1 } },
  { id: 'i_gen', tree: 'intel', name: 'Analiza genetyczna', cost: 12, req: ['i_surv'], desc: 'Ujawnia drogi przenoszenia i zdolności patogenu.', fx: { gen: 1 } },
  { id: 'i_stab', tree: 'intel', name: 'Bank szczepów', cost: 14, req: ['i_gen'], desc: 'Przetasowanie genów cofa badania o połowę mniej.', fx: { stab: 1 } },
  { id: 'i_model', tree: 'intel', name: 'Modelowanie predykcyjne', cost: 18, req: ['i_test'], desc: 'Pokazuje zakażenia także w regionach, w których patogenu jeszcze nie wykryto.', fx: { model: 1 } },
  { id: 'i_media', tree: 'intel', name: 'Kampania informacyjna', cost: 9, desc: 'Zaufanie +15 od razu i szybsza odbudowa zaufania.', fx: { trustNow: 15, trustRegen: 1 } },
  { id: 'i_coop', tree: 'intel', name: 'Współpraca międzynarodowa', cost: 14, desc: 'Budżet rośnie o 40% szybciej.', fx: { budget: 1.4 } },
];

// Działania obrońcy na pojedynczym regionie
export const MEASURES = {
  air: { name: 'Zamknij lotnisko', off: 'Otwórz lotnisko', cost: 4, trust: 6, icon: '✈' },
  sea: { name: 'Zamknij port', off: 'Otwórz port', cost: 3, trust: 4, icon: '⚓' },
  land: { name: 'Zamknij granice', off: 'Otwórz granice', cost: 4, trust: 5, icon: '▣' },
  quar: { name: 'Kwarantanna', off: 'Zakończ kwarantannę', cost: 7, trust: 9, icon: '☣' },
};

export const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
export const VIRUS_BY_ID = byId(VIRUS_UPGRADES);
export const DEF_BY_ID = byId(DEF_UPGRADES);
export const REGION_BY_ID = byId(REGIONS);
