/* =============================================================================
   AURA Studio Pro — app.js
   실제 악기 샘플 + 오프라인 렌더 엔진 (Tone.js 없이 Web Audio 만으로 구현)
   · 재생과 WAV 내보내기가 "같은 그래프"를 쓰므로 들리는 그대로 저장된다.
   ========================================================================== */
(function () {
'use strict';

/* ---------------------------------------------------------------- 0. 상수 */
var NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var KEY_LABEL  = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
var SCALES = {
  major:  [0,2,4,5,7,9,11],
  minor:  [0,2,3,5,7,8,10],
  dorian: [0,2,3,5,7,9,10]
};
var SCALE_LABEL = { major:'장조', minor:'단조', dorian:'도리안' };

var SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/';
var DRUM_BASE   = 'https://tonejs.github.io/audio/drum-samples/';
var INST_BASE   = 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments/samples/';

/* 악기 정의 — kind:'sample' | 'synth' | 'drums' */
var INST = {
  piano:   { name:'그랜드 피아노', kind:'sample', base:SAMPLE_BASE, notes:['C2','Ds3','Fs3','A4','C5','Ds6'], atk:0.002, rel:0.85, gain:0.92, tone:9000, tag:'샘플' },
  ep:      { name:'일렉트릭 피아노', kind:'synth', synth:'fm', atk:0.004, dec:0.9, sus:0.22, rel:0.55, gain:0.55, tone:4200, bright:1.6, tag:'신스' },
  flute:   { name:'플루트', kind:'sample', base:INST_BASE+'flute/', notes:['C4','E5'], atk:0.06, rel:0.35, gain:0.75, tone:7000, tag:'샘플' },
  lead:    { name:'아날로그 리드', kind:'synth', synth:'saw', atk:0.02, dec:0.25, sus:0.45, rel:0.3, gain:0.42, tone:5200, bright:1.2, tag:'신스' },
  strings: { name:'첼로 스트링', kind:'sample', base:INST_BASE+'cello/', notes:['C2','G3','D4','A4'], atk:0.16, rel:0.85, gain:0.62, tone:5200, tag:'샘플' },
  pad:     { name:'따뜻한 패드', kind:'synth', synth:'pad', atk:0.5, dec:0.8, sus:0.75, rel:1.6, gain:0.3, tone:3000, bright:0.9, tag:'신스' },
  organ:   { name:'오르간', kind:'sample', base:INST_BASE+'organ/', notes:['C2','Ds3','Fs4'], atk:0.012, rel:0.28, gain:0.6, tone:6500, tag:'샘플' },
  bassEl:  { name:'일렉트릭 베이스', kind:'sample', base:INST_BASE+'bass-electric/', notes:['E1','G2'], atk:0.004, rel:0.28, gain:0.95, tone:1100, tag:'샘플' },
  bassSyn: { name:'서브 신스 베이스', kind:'synth', synth:'sub', atk:0.006, dec:0.3, sus:0.55, rel:0.18, gain:0.62, tone:700, bright:0.6, tag:'신스' },
  guitar:  { name:'어쿠스틱 기타', kind:'sample', base:INST_BASE+'guitar-acoustic/', notes:['C3','E4'], atk:0.004, rel:0.45, gain:0.7, tone:7500, tag:'샘플' },
  harp:    { name:'하프', kind:'sample', base:INST_BASE+'harp/', notes:['C3','D4'], atk:0.003, rel:1.0, gain:0.66, tone:8000, tag:'샘플' },
  xylo:    { name:'마림바/실로폰', kind:'sample', base:INST_BASE+'xylophone/', notes:['C5','G6'], atk:0.002, rel:0.3, gain:0.5, tone:9000, tag:'샘플' },
  /* 드럼 킷 */
  'kit-acoustic': { name:'어쿠스틱 킷', kind:'drums', folder:'acoustic-kit', gain:1.0, tag:'샘플' },
  'kit-cr78':     { name:'시티팝 (CR-78)', kind:'drums', folder:'CR78', gain:1.0, tag:'샘플' },
  'kit-kpr77':    { name:'로파이 (KPR-77)', kind:'drums', folder:'KPR77', gain:1.0, tag:'샘플' },
  'kit-linn':     { name:'80s (LINN)', kind:'drums', folder:'LINN', gain:1.0, tag:'샘플' },
  'kit-r8':       { name:'힙합 (R-8)', kind:'drums', folder:'R8', gain:1.0, tag:'샘플' },
  'kit-stark':    { name:'소프트 (Stark)', kind:'drums', folder:'Stark', gain:1.0, tag:'샘플' }
};

var DRUM_FILES = { kick:'kick.mp3', snare:'snare.mp3', hat:'hihat.mp3', tom1:'tom1.mp3', tom2:'tom2.mp3', tom3:'tom3.mp3' };
var DRUM_ROWS = [
  { id:'kick',  label:'킥',   note:'C1'  },
  { id:'snare', label:'스네어', note:'D1'  },
  { id:'hat',   label:'하이햇', note:'F#1' },
  { id:'ohat',  label:'오픈햇', note:'G#1' }
];

/* 프리셋 — 장르 한 방 세팅 */
var PRESETS = [
  { id:'citypop', em:'🌃', name:'시티팝', mood:'비 오는 밤 드라이브, 몽환적인 시티팝과 따뜻한 그랜드 피아노',
    key:9, mode:'minor', bpm:104, bright:64, energy:70, ext:'9', prog:'citypop',
    mel:'piano', chd:'strings', bas:'bassEl', drm:'kit-cr78', arp:'guitar',
    eng:'Dreamy 80s Japanese city pop, warm grand piano melody, lush string chords, funky electric bass, crisp gated drums, neon night drive' },
  { id:'lofi', em:'☕', name:'로파이', mood:'비 오는 오후 아늑한 카페, 따뜻한 로파이 힙합과 피아노',
    key:2, mode:'minor', bpm:82, bright:42, energy:46, ext:'7', prog:'lofi',
    mel:'piano', chd:'pad', bas:'bassSyn', drm:'kit-kpr77', arp:'harp',
    eng:'Chill lo-fi hip-hop beat, dusty piano chords, mellow sub bass, vinyl crackle warmth, rainy cafe atmosphere' },
  { id:'cinematic', em:'🎬', name:'시네마틱', mood:'광활한 우주와 감동적인 영화 OST, 웅장한 피아노와 스트링',
    key:2, mode:'minor', bpm:76, bright:50, energy:78, ext:'9', prog:'cinematic',
    mel:'piano', chd:'strings', bas:'bassSyn', drm:'kit-acoustic', arp:'harp',
    eng:'Emotional cinematic film score, expressive grand piano lead, sweeping warm strings, deep percussion, lush hall reverb' },
  { id:'synthwave', em:'🕹️', name:'신스웨이브', mood:'네온 불빛 가득한 밤거리, 신나는 레트로 신스웨이브',
    key:9, mode:'minor', bpm:118, bright:78, energy:86, ext:'7', prog:'synthwave',
    mel:'lead', chd:'pad', bas:'bassSyn', drm:'kit-linn', arp:'xylo',
    eng:'Energetic retro synthwave, punchy analog lead, pulsing synth bass, driving four-on-the-floor drums, neon night' },
  { id:'acoustic', em:'🎸', name:'어쿠스틱', mood:'햇살 좋은 주말 아침 산책, 산뜻한 피아노와 어쿠스틱 기타',
    key:5, mode:'major', bpm:94, bright:82, energy:56, ext:'7', prog:'pop',
    mel:'piano', chd:'pad', bas:'bassEl', drm:'kit-acoustic', arp:'guitar',
    eng:'Warm indie acoustic pop, gentle grand piano melody, soft acoustic guitar arpeggio, organic bass, sunny morning mood' },
  { id:'hiphop', em:'🔥', name:'힙합', mood:'도심 속 야경, 묵직한 808 베이스와 트렌디한 힙합 비트',
    key:2, mode:'minor', bpm:132, bright:44, energy:84, ext:'9', prog:'trap',
    mel:'ep', chd:'pad', bas:'bassSyn', drm:'kit-r8', arp:'xylo',
    eng:'Modern trap hip-hop instrumental, heavy 808 sub bass, rapid hi-hat rolls, atmospheric synth pad, clean studio punch' },

  /* ---- 확장 10종 (뉴스·속보·보사노바·K-POP·발라드·펑키·8비트·앰비언트·테크하우스·네오소울) ---- */
  { id:'news', em:'📈', name:'뉴스/경제 브리핑', mood:'깔끔한 뉴스·경제 브리핑 오프닝, 마림바 펄스와 밝은 피아노',
    key:0, mode:'major', bpm:110, bright:74, energy:56, ext:'7', prog:'news', swing:0, curve:'standard',
    mel:'piano', chd:'ep', bas:'bassEl', drm:'kit-stark', arp:'xylo', pat:'news', arpPat:[0,2,4,6,8,10,12,14],
    eng:'Clean news and economy briefing bed, steady marimba pulse, bright grand piano accents, soft kick and shaker groove, neutral optimistic corporate tone' },
  { id:'breaking', em:'🚨', name:'속보/서스펜스', mood:'긴장감 넘치는 속보 화면, 낮게 깔리는 마이너 베이스와 타이트한 드럼',
    key:2, mode:'minor', bpm:124, bright:38, energy:88, ext:'7', prog:'breaking', swing:0, curve:'buildup',
    mel:'lead', chd:'pad', bas:'bassSyn', drm:'kit-linn', arp:'xylo', pat:'breaking', arpPat:[0,2,4,6,8,10,12,14],
    eng:'Tense breaking news underscore, dark minor synth bass ostinato, tight ticking drums, suspenseful pulsing arpeggio, urgent cinematic tension' },
  { id:'bossa', em:'☕', name:'보사노바 카페', mood:'햇살 드는 카페 테라스, 따뜻한 기타와 가벼운 라틴 리듬의 보사노바',
    key:5, mode:'major', bpm:108, bright:68, energy:44, ext:'9', prog:'bossa', swing:18, curve:'chill',
    mel:'flute', chd:'ep', bas:'bassEl', drm:'kit-acoustic', arp:'guitar', pat:'bossa', arpPat:[0,3,6,10,12,14],
    eng:'Warm acoustic bossa nova, gentle nylon guitar comping, soft flute melody, light latin rimshot groove, relaxed sunny cafe atmosphere' },
  { id:'kpop', em:'🌸', name:'K-POP 청량', mood:'여름 햇살처럼 청량한 K-POP, 밝은 신스와 펑키 베이스',
    key:7, mode:'major', bpm:122, bright:86, energy:82, ext:'9', prog:'kpop', swing:14, curve:'standard',
    mel:'lead', chd:'pad', bas:'bassEl', drm:'kit-linn', arp:'xylo', pat:'kpop', arpPat:[0,2,4,6,8,10,12,14],
    eng:'Bright refreshing K-pop instrumental, sparkling synth plucks, funky electric bass, punchy modern pop drums, catchy uplifting hook' },
  { id:'ballad', em:'🎹', name:'감성 발라드', mood:'이별의 밤, 서정적인 피아노와 첼로가 흐르는 감성 발라드',
    key:9, mode:'minor', bpm:72, bright:48, energy:40, ext:'9', prog:'ballad', swing:0, curve:'standard',
    mel:'piano', chd:'strings', bas:'bassSyn', drm:'kit-acoustic', arp:'harp', pat:'ballad', arpPat:[0,4,8,12],
    eng:'Emotional piano ballad, lyrical grand piano melody, warm cello and string chords, soft acoustic drums, tender late night mood' },
  { id:'funk', em:'🕺', name:'펑키 그루브', mood:'클럽을 달구는 펑키 그루브, 그루비한 베이스와 브라스 스탭',
    key:3, mode:'major', bpm:112, bright:72, energy:80, ext:'7', prog:'funk', swing:18, curve:'standard',
    mel:'ep', chd:'organ', bas:'bassEl', drm:'kit-r8', arp:'guitar', pat:'funk', arpPat:[0,1,2,3,4,6,7,8,10,11,12,14],
    eng:'Classic funk groove, slap electric bass, tight brass stabs, clavinet and rhythm guitar, punchy syncopated drums' },
  { id:'chiptune', em:'🕹️', name:'8비트 레트로', mood:'아이들이 좋아하는 8비트 게임 화면, 통통 튀는 칩튠 신스와 실로폰',
    key:0, mode:'major', bpm:132, bright:90, energy:78, ext:'7', prog:'chiptune', swing:0, curve:'standard',
    mel:'lead', chd:'ep', bas:'bassSyn', drm:'kit-cr78', arp:'xylo', pat:'chiptune', arpPat:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    eng:'Playful 8-bit chiptune, bright square wave lead, bouncy xylophone arpeggio, punchy retro game drums, cheerful kids and game vibe' },
  { id:'ambient', em:'🌿', name:'힐링 앰비언트', mood:'새벽 숲의 고요함, 하프와 플루트가 흐르는 잔잔한 힐링 앰비언트',
    key:5, mode:'major', bpm:68, bright:58, energy:26, ext:'9', prog:'ambient', swing:0, curve:'chill',
    mel:'flute', chd:'pad', bas:'bassSyn', drm:'kit-stark', arp:'harp', pat:'ambient', arpPat:[0,6,12],
    eng:'Calm healing ambient, airy flute melody, delicate harp, warm sustained pads, sparse soft percussion, deep peaceful space' },
  { id:'techhouse', em:'⚡', name:'테크 하우스', mood:'새벽 클럽의 테크 하우스, 강렬한 4/4 킥과 에너지 드롭',
    key:9, mode:'minor', bpm:126, bright:66, energy:92, ext:'7', prog:'techhouse', swing:0, curve:'drop',
    mel:'lead', chd:'pad', bas:'bassSyn', drm:'kit-linn', arp:'xylo', pat:'techhouse', arpPat:[2,6,10,14],
    eng:'Driving tech house, powerful four-on-the-floor kick, offbeat open hats, rolling synth bass, deep club energy drop' },
  { id:'neosoul', em:'🌙', name:'재즈 네오소울', mood:'늦은 밤의 재즈 네오소울, 7th·9th 텐션 코드와 스윙 드럼',
    key:2, mode:'dorian', bpm:88, bright:52, energy:42, ext:'9', prog:'neosoul', swing:46, curve:'chill',
    mel:'ep', chd:'organ', bas:'bassEl', drm:'kit-acoustic', arp:'xylo', pat:'neosoul', arpPat:[0,3,6,10,12],
    eng:'Smooth jazz neo-soul, lush 7th and 9th chord voicings, warm Rhodes melody, laid-back swung drums, late night intimate groove' }
];

/* 코드 진행 (스케일 도수) — 8마디 */
var PROGRESSIONS = {
  citypop:   { label:'시티팝 진행',  minor:[3,4,2,5],        major:[3,4,2,5] },
  lofi:      { label:'로파이 진행',    minor:[0,5,3,4],        major:[0,5,3,4] },
  cinematic: { label:'시네마틱 진행', minor:[0,5,2,6],     major:[0,5,3,4] },
  synthwave: { label:'신스웨이브 진행', minor:[0,6,5,6],   major:[0,6,5,6] },
  pop:       { label:'팝 진행',        minor:[2,6,3,0],        major:[0,4,5,3] },
  trap:      { label:'트랩 진행',      minor:[0,3,5,4],        major:[0,3,5,4] },
  canon:     { label:'캐논 진행',  minor:[0,4,5,2,3,0,3,4], major:[0,4,5,2,3,0,3,4] },
  news:      { label:'뉴스/경제 진행', minor:[0,5,3,4],     major:[0,4,3,4] },
  breaking:  { label:'속보 진행',      minor:[0,6,5,6],     major:[0,5,4,5] },
  bossa:     { label:'보사노바 진행',  minor:[0,5,1,4],     major:[0,5,1,4] },
  kpop:      { label:'K-POP 진행',     minor:[5,3,0,4],     major:[5,3,0,4] },
  ballad:    { label:'발라드 진행',    minor:[0,5,2,6],     major:[0,5,3,4] },
  funk:      { label:'펑키 진행',      minor:[0,3,4,3],     major:[0,3,4,3] },
  chiptune:  { label:'8비트 진행',     minor:[0,3,4,3],     major:[0,4,5,3] },
  ambient:   { label:'앰비언트 진행',  minor:[0,5,3,4],     major:[0,5,3,4] },
  techhouse: { label:'테크 하우스 진행', minor:[0,6,3,4],   major:[0,5,3,4] },
  neosoul:   { label:'네오소울 진행',  minor:[0,3,6,2],     major:[1,4,0,5] }
};

/* 드럼 패턴 (16분 16칸) */
var DRUM_PAT = {
  'kit-acoustic': {
    A:{ kick:'1000000010000000', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000000000000' },
    B:{ kick:'1000000010010000', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000000001000' }
  },
  'kit-cr78': {
    A:{ kick:'1000000010000000', snare:'0000100000001000', hat:'1111111111111111', ohat:'0000000000000000' },
    B:{ kick:'1000000010010000', snare:'0000100000001010', hat:'1011101110111011', ohat:'0000000000001000' }
  },
  'kit-kpr77': {
    A:{ kick:'1000000010000000', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000000000000' },
    B:{ kick:'1000000010010000', snare:'0000100000001001', hat:'1010101110101011', ohat:'0000000000000000' }
  },
  'kit-linn': {
    A:{ kick:'1000100010001000', snare:'0000100000001000', hat:'0010001000100010', ohat:'0000000000000000' },
    B:{ kick:'1000100010001000', snare:'0000100000001000', hat:'0011001100110011', ohat:'0000000010000000' }
  },
  'kit-r8': {
    A:{ kick:'1000000000100000', snare:'0000100000001000', hat:'1010111010101110', ohat:'0000000000000000' },
    B:{ kick:'1000000000100010', snare:'0000100000001000', hat:'1110111011101110', ohat:'0000000000000100' }
  },
  'kit-stark': {
    A:{ kick:'1000000010000000', snare:'0000010000000100', hat:'1010101010101010', ohat:'0000000000000000' },
    B:{ kick:'1000000010010000', snare:'0000010000000100', hat:'1010101010101011', ohat:'0000000000000000' }
  },

  /* 확장 프리셋 전용 패턴 — 프리셋이 pat:'…' 로 골라 쓴다 */
  news: {
    A:{ kick:'1000000010000000', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000000000000' },
    B:{ kick:'1000000010000010', snare:'0000100000001010', hat:'1010111010101110', ohat:'0000000000001000' }
  },
  breaking: {
    A:{ kick:'1000000010000100', snare:'0000100000001000', hat:'0010001000100010', ohat:'0000000000000000' },
    B:{ kick:'1000001010000100', snare:'0000100000001010', hat:'0010001000100011', ohat:'0000000000000100' }
  },
  bossa: {
    A:{ kick:'1000000010000000', snare:'0000100100001001', hat:'1010101010101010', ohat:'0000000000000000' },
    B:{ kick:'1000000010000010', snare:'0000100100001010', hat:'1010101010101110', ohat:'0000000000001000' }
  },
  kpop: {
    A:{ kick:'1000000010000000', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000000001000' },
    B:{ kick:'1000000010000010', snare:'0000100000001010', hat:'1010101110101011', ohat:'0000000010000000' }
  },
  ballad: {
    A:{ kick:'1000000010000000', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000000000000' },
    B:{ kick:'1000000010000000', snare:'0000100000001010', hat:'1010101010101011', ohat:'0000000010000000' }
  },
  funk: {
    A:{ kick:'1000000010000010', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000010000000' },
    B:{ kick:'1000000010010010', snare:'0000100000001010', hat:'1010111010101110', ohat:'0000000010000000' }
  },
  chiptune: {
    A:{ kick:'1000000010000000', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000000000000' },
    B:{ kick:'1000000010000010', snare:'0000100000001010', hat:'1010101110101110', ohat:'0000000000001000' }
  },
  ambient: {
    A:{ kick:'1000000000000000', snare:'0000000000000000', hat:'0000000000000000', ohat:'0000000000000000' },
    B:{ kick:'1000000010000000', snare:'0000000000000000', hat:'0000000000000000', ohat:'0000000000000000' }
  },
  techhouse: {
    A:{ kick:'1000100010001000', snare:'0000100000001000', hat:'0000000000000000', ohat:'0010001000100010' },
    B:{ kick:'1000100010001010', snare:'0000100000001000', hat:'1010101010101010', ohat:'0010001000100010' }
  },
  neosoul: {
    A:{ kick:'1000000010000010', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000001000000000' },
    B:{ kick:'1000000010010000', snare:'0000100000001010', hat:'1010101110101011', ohat:'0000001000001000' }
  }
};

/* ---------------------------------------------------------------- 1. 상태 */
var S = {
  bpm: 104, key: 9, mode: 'minor', bars: 16,
  bright: 64, energy: 70, swing: 12,
  humanize: true, fill: true, normalize: true,
  preset: 'citypop', prog: 'citypop', ext: '9',
  energyCurve: [],
  chords: [], notes: [], bass: [], arp: [], drums: [],
  events: [], eventsLen: 0,
  hum: new Array(16).fill(null),
  humMidi: [],
  aiTitle: '', aiTip: '', aiModel: '', aiSource: '',
  rollBars: 2, rollStart: 0, drumBar: 0,
  loop: { type:'sec', value: 15 },
  isPlaying: false, playing: false, step: 0, isLoop: true, normalize: true, exactSec: true,
  tracks: [
    { id:'melody', role:'melody', name:'멜로디', inst:'piano',  vol:0.85, pan:-0.08, mute:false, solo:false },
    { id:'chords', role:'chords', name:'코드',   inst:'strings',vol:0.62, pan: 0.12, mute:false, solo:false },
    { id:'bass',   role:'bass',   name:'베이스', inst:'bassEl', vol:0.80, pan: 0,    mute:false, solo:false },
    { id:'drums',  role:'drums',  name:'드럼',   inst:'kit-cr78',vol:0.85, pan: 0,   mute:false, solo:false },
    { id:'arp',    role:'arp',    name:'아르페지오', inst:'guitar', vol:0.42, pan: -0.22, mute:false, solo:false }
  ],
  trackOpts: {
    melody: ['piano','ep','flute','lead'],
    chords: ['strings','pad','organ','ep'],
    bass:   ['bassEl','bassSyn'],
    drums:  ['kit-cr78','kit-acoustic','kit-kpr77','kit-linn','kit-r8','kit-stark'],
    arp:    ['guitar','harp','xylo','piano']
  },
  master: { low:1, mid:0, high:2, reverb:28, warmth:18, volume:80, limiter:true }
};

/* ---------------------------------------------------------------- 2. 유틸 */
function $(id){ return document.getElementById(id); }
function el(tag, cls, txt){ var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
function clamp(v,a,b){ return v < a ? a : v > b ? b : v; }
function pad2(n){ return String(n).padStart(2,'0'); }

/* 시드 난수 — 같은 곡을 다시 렌더할 때 동일한 결과 */
var rngState = 1234567;
function seedRand(seed){ rngState = seed >>> 0 || 1234567; }
function rand(){ rngState ^= rngState << 13; rngState ^= rngState >>> 17; rngState ^= rngState << 5; rngState >>>= 0; return rngState / 4294967296; }
function rint(n){ return Math.floor(rand() * n); }
function pick(arr){ return arr[rint(arr.length)]; }
function chance(p){ return rand() < p; }

function midiToName(m){ return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
function nameToMidi(n){
  var m = /^([A-G])([#s]?)(-?\d)$/.exec(n);
  if (!m) return 60;
  var base = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[m[1]];
  if (m[2]) base += 1;
  return base + (parseInt(m[3], 10) + 1) * 12;
}

function scaleMidis(){
  var iv = SCALES[S.mode] || SCALES.minor;
  var out = [];
  for (var o = 0; o < 8; o++) for (var i = 0; i < 7; i++) out.push(36 + S.key + iv[i] + o * 12);
  return out;
}
function scaleInterval(deg){
  var iv = SCALES[S.mode] || SCALES.minor;
  var oct = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7;
  return iv[i] + 12 * oct;
}

/* 도수 → 절대 음 (C3 = 48 기준) */
function degreeMidi(deg){ return 48 + S.key + scaleInterval(deg); }

/* 코드 보이싱: 도수 + 확장(7th/9th) + 드롭2 보이싱 */
function chordVoicing(deg, ext){
  var core = [0, 2, 4];
  if (ext === '7' || ext === '9') core.push(6);
  if (ext === '9') core.push(8);
  var notes = core.map(function(d){ return degreeMidi(deg + d); });
  /* 아래쪽으로 정리 — 루트를 48~59 로 */
  while (notes[0] >= 60) notes = notes.map(function(n){ return n - 12; });
  while (notes[0] < 48) notes = notes.map(function(n){ return n + 12; });
  /* 드롭2: 두 번째로 높은 음을 한 옥타브 내려 넓게 */
  if (notes.length >= 4) {
    var sorted = notes.slice().sort(function(a,b){ return a-b; });
    var idx = notes.indexOf(sorted[sorted.length - 2]);
    if (idx > -1 && notes[idx] - 12 >= 40) notes[idx] -= 12;
  }
  return notes.sort(function(a,b){ return a-b; });
}

function chordName(deg, ext){
  var iv = SCALES[S.mode] || SCALES.minor;
  var rootPc = (S.key + iv[((deg % 7) + 7) % 7]) % 12;
  var third = (iv[((deg + 2) % 7 + 7) % 7] - iv[((deg % 7) + 7) % 7] + 12) % 12;
  var fifth = (iv[((deg + 4) % 7 + 7) % 7] - iv[((deg % 7) + 7) % 7] + 12) % 12;
  var minor = third === 3;
  var dim = minor && fifth === 6;
  var name = KEY_LABEL[rootPc] + (dim ? 'dim' : minor ? 'm' : '');
  if (ext === '7') name += minor ? '7' : 'M7';
  else if (ext === '9') name += minor ? '9' : 'M9';
  return name;
}

function toast(msg, kind){
  var host = $('toasts');
  if (!host) { host = el('div','toasts'); host.id = 'toasts'; document.body.appendChild(host); }
  var t = el('div','toast' + (kind ? ' ' + kind : ''), msg);
  host.appendChild(t);
  setTimeout(function(){ t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(function(){ t.remove(); }, 3000);
}

/* ---------------------------------------------------------------- 3. 오디오 엔진 */
var AU = {
  ctx: null, master: null, trackNodes: {}, buffers: {}, pending: {}, instCache: {},
  noise: null, timer: null, step: 0, nextTime: 0, raf: null, started: false, playing: false, endAt: null,
  loadTotal: 0, loadDone: 0, failed: {}, ready: false
};

function makeCurve(amount){
  /* 부드러운 테이프 새추레이션 — amount 0..100 */
  var k = 1 + (amount / 100) * 5, n = 1024, curve = new Float32Array(n), norm = Math.tanh(k);
  for (var i = 0; i < n; i++) {
    var x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

function makeIR(ctx, seconds, damp){
  var rate = ctx.sampleRate, len = Math.max(1, Math.floor(rate * seconds));
  var buf = ctx.createBuffer(2, len, rate), rs = 20240623;
  function r(){ rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; }
  for (var ch = 0; ch < 2; ch++) {
    var d = buf.getChannelData(ch), prev = 0, pre = Math.floor(rate * 0.012);
    for (var i = 0; i < len; i++) {
      var t = i / len;
      var env = Math.pow(1 - t, 2.2) * Math.exp(-t * 2.6);
      var n = (r() * 2 - 1) * env;
      prev = prev * damp + n * (1 - damp);           /* 저역으로 부드럽게 */
      d[i] = (i < pre) ? 0 : prev * 1.6;
    }
  }
  return buf;
}

/* 마스터 체인 — 라이브/오프라인 공용 (같은 소리 보장) */
function buildMaster(ctx, m){
  var inp = ctx.createGain();
  var low = ctx.createBiquadFilter(); low.type = 'lowshelf';  low.frequency.value = 190;  low.gain.value = m.low;
  var mid = ctx.createBiquadFilter(); mid.type = 'peaking';   mid.frequency.value = 1150; mid.Q.value = 1.1; mid.gain.value = m.mid;
  var hi  = ctx.createBiquadFilter(); hi.type = 'highshelf';  hi.frequency.value = 4200;  hi.gain.value = m.high;
  var warm = ctx.createWaveShaper(); warm.curve = makeCurve(m.warmth); warm.oversample = '2x';
  var dry = ctx.createGain(); dry.gain.value = 1;
  var wet = ctx.createGain(); wet.gain.value = m.reverb / 100 * 0.9;
  var conv = ctx.createConvolver(); conv.buffer = makeIR(ctx, 2.6, 0.42);
  var comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
  var lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -1.2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.09;
  var out = ctx.createGain(); out.gain.value = m.volume / 100;
  inp.connect(low); low.connect(mid); mid.connect(hi); hi.connect(warm);
  warm.connect(dry); dry.connect(comp);
  warm.connect(conv); conv.connect(wet); wet.connect(comp);
  comp.connect(lim); lim.connect(out);
  return { in: inp, out: out, low: low, mid: mid, high: hi, warm: warm, wet: wet, lim: lim, master: out };
}

function setMasterParam(key, val){
  if (!AU.master) return;
  var m = S.master;
  if (key === 'low') AU.master.low.gain.setTargetAtTime(val, AU.ctx.currentTime, 0.03);
  if (key === 'mid') AU.master.mid.gain.setTargetAtTime(val, AU.ctx.currentTime, 0.03);
  if (key === 'high') AU.master.high.gain.setTargetAtTime(val, AU.ctx.currentTime, 0.03);
  if (key === 'reverb') AU.master.wet.gain.setTargetAtTime(val / 100 * 0.9, AU.ctx.currentTime, 0.03);
  if (key === 'warmth') AU.master.warm.curve = makeCurve(val);
  if (key === 'volume') AU.master.master.gain.setTargetAtTime(val / 100, AU.ctx.currentTime, 0.03);
  if (key === 'limiter') AU.master.lim.threshold.setTargetAtTime(val ? -1.2 : 0, AU.ctx.currentTime, 0.03);
  void m;
}

function ensureAudio(){
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume().catch(function(){}); return Promise.resolve(AU.ctx); }
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return Promise.reject(new Error('이 브라우저에는 Web Audio 가 없습니다'));
  var ctx = new Ctx({ latencyHint: 'interactive', sampleRate: 44100 });
  AU.ctx = ctx;
  AU.master = buildMaster(ctx, S.master);
  AU.master.out.connect(ctx.destination);
  AU.analyser = ctx.createAnalyser(); AU.analyser.fftSize = 256;
  AU.master.out.connect(AU.analyser);

  S.tracks.forEach(function(t){ attachTrack(t); });
  if (ctx.state === 'suspended') ctx.resume();
  return Promise.resolve(ctx);
}

function attachTrack(t){
  if (!AU.ctx || AU.trackNodes[t.id]) return;
  var ctx = AU.ctx;
  var gain = ctx.createGain(); gain.gain.value = t.vol;
  var pan = (ctx.createStereoPanner ? ctx.createStereoPanner() : null);
  var filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = instTone(t.inst);
  if (pan) { gain.connect(pan); pan.connect(filt); pan.pan.value = t.pan || 0; }
  else gain.connect(filt);
  filt.connect(AU.master.in);
  AU.trackNodes[t.id] = { gain: gain, pan: pan, filt: filt };
}
function instTone(id){ var d = INST[id]; return d && d.tone ? d.tone : 12000; }

function trackOutput(t){
  var n = AU.trackNodes[t.id];
  if (!n) { attachTrack(t); n = AU.trackNodes[t.id]; }
  return n ? n.gain : AU.master.in;
}
function refreshMix(){
  var anySolo = S.tracks.some(function(t){ return t.solo; });
  S.tracks.forEach(function(t){
    var n = AU.trackNodes[t.id]; if (!n) return;
    var audible = !t.mute && (!anySolo || t.solo);
    n.gain.gain.setTargetAtTime(audible ? t.vol : 0, AU.ctx.currentTime, 0.02);
    if (n.pan) n.pan.pan.setTargetAtTime(t.pan || 0, AU.ctx.currentTime, 0.02);
    n.filt.frequency.setTargetAtTime(instTone(t.inst), AU.ctx.currentTime, 0.05);
  });
}

/* ---------------- 샘플 로딩 ---------------- */
function fetchBuffer(ctx, url){
  if (AU.buffers[url]) return Promise.resolve(AU.buffers[url]);
  if (AU.pending[url]) return AU.pending[url];
  var p = fetch(url, { mode: 'cors' })
    .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then(function(ab){
      return new Promise(function(res, rej){
        ctx.decodeAudioData(ab, function(b){ res(b); }, function(e){ rej(e || new Error('decode')); });
      });
    })
    .then(function(b){ AU.buffers[url] = b; delete AU.pending[url]; return b; })
    .catch(function(e){ delete AU.pending[url]; throw e; });
  AU.pending[url] = p;
  return p;
}

function instUrls(id){
  var d = INST[id]; if (!d) return [];
  if (d.kind === 'sample') return d.notes.map(function(n){ return d.base + n.replace('#','s') + '.mp3'; });
  if (d.kind === 'drums') return Object.keys(DRUM_FILES).map(function(k){ return DRUM_BASE + d.folder + '/' + DRUM_FILES[k]; });
  return [];
}

function prepareInst(id){
  var d = INST[id];
  if (!d) return Promise.resolve(null);
  if (AU.instCache[id]) return AU.instCache[id].promise;
  var ctx = AU.ctx;
  if (d.kind === 'synth' || !ctx) {
    var prepared = { id: id, type: 'synth', def: d, samples: null, ready: true };
    AU.instCache[id] = { promise: Promise.resolve(prepared), inst: prepared };
    return Promise.resolve(prepared);
  }
  var urls = instUrls(id);
  AU.loadTotal += urls.length;
  var jobs = urls.map(function(u){
    return fetchBuffer(ctx, u).then(function(b){ AU.loadDone++; return { url: u, buf: b }; })
      .catch(function(e){ AU.loadDone++; return { url: u, buf: null, err: e }; });
  });
  var promise = Promise.all(jobs).then(function(res){
    var inst = { id: id, type: d.kind === 'drums' ? 'drums' : 'sample', def: d, samples: [], ready: false, missing: 0 };
    if (d.kind === 'drums') {
      var map = {};
      res.forEach(function(o){
        var key = Object.keys(DRUM_FILES).filter(function(k){ return o.url.indexOf('/' + DRUM_FILES[k]) > -1; })[0];
        if (key && o.buf) map[key] = o.buf; else if (!o.buf) inst.missing++;
      });
      inst.drumMap = map;
      inst.ready = Object.keys(map).length > 0;
    } else {
      d.notes.forEach(function(n, i){
        if (res[i] && res[i].buf) inst.samples.push({ midi: nameToMidi(n), buf: res[i].buf });
        else inst.missing++;
      });
      inst.samples.sort(function(a,b){ return a.midi - b.midi; });
      inst.ready = inst.samples.length > 0;
    }
    if (!inst.ready) AU.failed[id] = true;
    AU.instCache[id] = { promise: Promise.resolve(inst), inst: inst };
    return inst;
  });
  AU.instCache[id] = { promise: promise, inst: null };
  return promise;
}

function loadedInst(id){
  var c = AU.instCache[id];
  return c && c.inst && c.inst.ready ? c.inst : null;
}

function loadNeeded(onProgress){
  var used = S.tracks.filter(function(t){ return !t.mute; }).map(function(t){ return t.inst; });
  var uniq = used.filter(function(v,i,a){ return a.indexOf(v) === i; });
  var before = AU.loadDone;
  var jobs = uniq.map(function(id){ return prepareInst(id); });
  var tick = setInterval(function(){
    if (onProgress) onProgress(AU.loadDone, Math.max(AU.loadTotal, AU.loadDone));
  }, 80);
  return Promise.all(jobs).then(function(){ clearInterval(tick); if (onProgress) onProgress(1,1); void before; });
}

/* ---------------- 보이스 ---------------- */
function nearestSample(samples, midi){
  var best = samples[0], bd = 999;
  for (var i = 0; i < samples.length; i++) {
    var d = Math.abs(samples[i].midi - midi);
    if (d < bd) { bd = d; best = samples[i]; }
  }
  return best;
}

function sampleVoice(ctx, out, inst, midi, when, durSec, vel){
  if (!inst.samples.length) return false;
  var s = nearestSample(inst.samples, midi);
  var def = inst.def;
  var src = ctx.createBufferSource();
  src.buffer = s.buf;
  src.playbackRate.value = Math.pow(2, (midi - s.midi) / 12);
  var g = ctx.createGain();
  var peak = Math.max(0.02, Math.min(1, vel)) * (def.gain || 0.8);
  var atk = Math.max(0.001, def.atk || 0.004), rel = Math.max(0.05, def.rel || 0.5);
  var hold = Math.max(when + atk + 0.02, when + durSec);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + atk);
  g.gain.setValueAtTime(peak, hold);
  g.gain.linearRampToValueAtTime(0.0001, hold + rel);
  src.connect(g); g.connect(out);
  src.start(when);
  try { src.stop(hold + rel + 0.03); } catch (e) {}
  return true;
}

function drumVoice(ctx, out, inst, row, when, vel){
  var def = inst.def;
  var buf = inst.drumMap ? inst.drumMap[row] : null;
  if (!buf) return false;
  var src = ctx.createBufferSource();
  src.buffer = buf;
  var g = ctx.createGain();
  g.gain.value = Math.max(0.02, Math.min(1, vel)) * (def.gain || 1) * 0.95;
  src.connect(g); g.connect(out);
  src.start(when);
  return true;
}

function noiseBuffer(ctx){
  if (AU.noise) return AU.noise;
  var len = Math.floor(ctx.sampleRate * 0.6);
  var b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), rs = 777;
  for (var i = 0; i < len; i++){ rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; d[i] = (rs / 4294967296) * 2 - 1; }
  AU.noise = b;
  return b;
}

function synthDrum(ctx, out, row, when, vel){
  var v = Math.max(0.05, Math.min(1, vel));
  if (row === 'kick') {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, when);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.11);
    g.gain.setValueAtTime(v * 0.9, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.34);
    o.connect(g); g.connect(out); o.start(when); o.stop(when + 0.36);
    return;
  }
  var src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
  var f = ctx.createBiquadFilter(); var g2 = ctx.createGain();
  if (row === 'snare') {
    f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.9;
    g2.gain.setValueAtTime(v * 0.55, when); g2.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
  } else {
    f.type = 'highpass'; f.frequency.value = row === 'ohat' ? 6200 : 8200;
    g2.gain.setValueAtTime(v * 0.32, when); g2.gain.exponentialRampToValueAtTime(0.001, when + (row === 'ohat' ? 0.28 : 0.055));
  }
  src.connect(f); f.connect(g2); g2.connect(out);
  src.start(when); src.stop(when + 0.32);
}

function synthVoice(ctx, out, def, midi, when, durSec, vel){
  var f0 = 440 * Math.pow(2, (midi - 69) / 12);
  var v = Math.max(0.03, Math.min(1, vel));
  var atk = def.atk || 0.01, dec = def.dec || 0.2, sus = def.sus || 0.5, rel = def.rel || 0.3;
  var g = ctx.createGain();
  var filt = ctx.createBiquadFilter();
  filt.type = 'lowpass'; filt.Q.value = 1.1;
  var bri = def.bright || 1;
  var openF = Math.min(14000, 600 + v * 3200 * bri);
  filt.frequency.setValueAtTime(openF, when);
  filt.frequency.exponentialRampToValueAtTime(Math.max(280, openF * 0.32), when + Math.max(0.08, durSec * 0.8));
  var peak = v * (def.gain || 0.5);
  var holdEnd = Math.max(when + atk + dec, when + durSec);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + atk);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), when + atk + dec);
  g.gain.setValueAtTime(Math.max(0.0001, peak * sus), holdEnd);
  g.gain.exponentialRampToValueAtTime(0.0001, holdEnd + rel);
  filt.connect(g); g.connect(out);

  var oscs = [];
  function osc(type, detune, level){
    var o = ctx.createOscillator(); o.type = type; o.frequency.value = f0;
    if (detune) o.detune.value = detune;
    var og = ctx.createGain(); og.gain.value = level;
    o.connect(og); og.connect(filt); oscs.push(o);
    return o;
  }
  if (def.synth === 'pluck') {
    osc('triangle', 0, 0.7); osc('sine', 0, 0.3);
  } else if (def.synth === 'fm') {
    var car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f0;
    var mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f0 * 2;
    var mg = ctx.createGain();
    mg.gain.setValueAtTime(f0 * 1.8, when);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, f0 * 0.25), when + Math.max(0.12, durSec * 0.9));
    mod.connect(mg); mg.connect(car.frequency);
    var og2 = ctx.createGain(); og2.gain.value = 1;
    car.connect(og2); og2.connect(filt);
    oscs.push(car, mod);
    /* 로즈 계열 트레몰로 — 신스 티를 줄이는 핵심 */
    var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 4.7;
    var lfoG = ctx.createGain(); lfoG.gain.value = peak * 0.12;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    lfo.start(when);
    try { lfo.stop(holdEnd + rel + 0.06); } catch (e) {}
  } else if (def.synth === 'pad') {
    osc('sawtooth', -8, 0.32); osc('sawtooth', 7, 0.32); osc('triangle', 0, 0.22);
  } else if (def.synth === 'sub') {
    osc('sine', 0, 0.9); osc('triangle', 0, 0.22);
  } else {
    osc('sawtooth', -7, 0.34); osc('sawtooth', 6, 0.34); osc('square', 0, 0.12);
  }
  oscs.forEach(function(o){
    o.start(when);
    try { o.stop(holdEnd + rel + 0.04); } catch (e) {}
  });
}

/* 설계도 이벤트 → 소리 */
function fireEvent(ctx, out, track, ev, when, stepDur){
  if (!(when > 0)) when = 0.001;
  var inst = loadedInst(track.inst);
  var def = INST[track.inst];
  if (!def) return;
  if (def.kind === 'drums') {
    var ok = inst ? drumVoice(ctx, out, inst, ev.row, when, ev.vel) : false;
    if (!ok) synthDrum(ctx, out, ev.row, when, ev.vel);
    return;
  }
  if (inst && inst.type === 'sample' && inst.samples.length) {
    sampleVoice(ctx, out, inst, ev.midi, when, ev.dur * stepDur, ev.vel);
    return;
  }
  /* 샘플을 아직 못 받았거나 실패 → 같은 악기 느낌의 신스 폴백 */
  var fdef = def.kind === 'sample'
    ? { synth:'pluck', atk:0.003, dec:0.34, sus:0.10, rel:0.5, gain:(def.gain || .7) * 0.55, bright:1.3 }
    : def;
  synthVoice(ctx, out, fdef, ev.midi, when, ev.dur * stepDur, ev.vel);
}

/* ---------------- 재생 스케줄러 ---------------- */
var LOOKAHEAD = 0.18, TICK_MS = 25;

function totalSteps(){ return S.bars * 16; }
function stepDur(){ return (60 / S.bpm) / 4; }

function scheduleStep(step, when, stepDurS){
  var evs = S.events[step];
  if (!evs || !evs.length) return;
  var anySolo = S.tracks.some(function(t){ return t.solo; });
  for (var i = 0; i < evs.length; i++) {
    var ev = evs[i], trk = S.tracks[ev.t];
    if (!trk || trk.mute || (anySolo && !trk.solo)) continue;
    var out = trackOutput(trk);
    if (!out) continue;
    fireEvent(AU.ctx, out, trk, ev, when + (ev.jit || 0) * stepDurS, stepDurS);
  }
}

function schedTick(){
  if (!AU.playing) return;
  var ctx = AU.ctx;
  var guard = 0;
  while (AU.nextTime < ctx.currentTime + LOOKAHEAD && guard < 64) {
    if (AU.endAt) break;
    var sd = stepDur();
    scheduleStep(AU.step, AU.nextTime, sd);
    var st = AU.step;
    var delay = Math.max(0, (AU.nextTime - ctx.currentTime) * 1000);
    setTimeout(function(){
      if (!AU.playing) return;
      var bar = Math.floor(st / 16) + 1, beat = Math.floor((st % 16) / 4) + 1;
      var el2 = $('bar-display'); if (el2) el2.textContent = pad2(bar) + '.' + beat;
      S.step = st;
      if (document.querySelector('#tab-seq:not(.hidden)')) drawEnergy();
    }, delay);
    AU.nextTime += sd;
    AU.step++;
    if (AU.step >= totalSteps()) {
      if (S.isLoop === false) { AU.endAt = AU.nextTime; AU.step = 0; break; }
      AU.step = 0;
    }
    guard++;
  }
  if (AU.endAt && ctx.currentTime >= AU.endAt) { AU.endAt = null; stopPlayback(); }
}

function startPlayback(){
  if (AU.playing) { pausePlayback(); return Promise.resolve(); }
  return ensureAudio()
    .then(function(){ return loadNeeded(showLoadProgress); })
    .then(function(){
      AU.started = true;
      AU.playing = true;
      S.isPlaying = true;
      AU.step = 0;
      AU.nextTime = AU.ctx.currentTime + 0.14;
      AU.endAt = null;
      AU.timer = setInterval(schedTick, TICK_MS);
      schedTick();
      setPlayBtn(true);
      startMeter();
    })
    .catch(function(e){ toast('오디오를 시작할 수 없습니다: ' + (e && e.message || e), 'err'); });
}

function pausePlayback(){
  AU.playing = false;
  S.isPlaying = false;
  if (AU.timer) { clearInterval(AU.timer); AU.timer = null; }
  var n = $('bar-display'); if (n) n.textContent = '01.1';
  S.step = 0;
  setPlayBtn(false);
}

function stopPlayback(){ pausePlayback(); }

function setPlayBtn(playing){
  var b = $('btn-play');
  if (!b) return;
  b.textContent = playing ? '❚❚ 일시정지' : '▶ 재생';
}

function showLoadProgress(done, total){
  var st = $('sampler-status');
  if (!st) return;
  if (total <= 0 || done >= total) { updateSamplerStatus(); return; }
  st.textContent = '악기 샘플 받는 중 ' + done + '/' + total;
}

function updateSamplerStatus(){
  var st = $('sampler-status'), badge = $('engine-badge'), mixb = $('mix-engine-badge');
  var insts = S.tracks.map(function(t){ return t.inst; }).filter(function(v,i,a){ return a.indexOf(v) === i; });
  var live = 0, synth = 0, total = insts.length;
  insts.forEach(function(id){
    var c = AU.instCache[id];
    if (INST[id] && INST[id].kind === 'synth') synth++;
    else if (c && c.inst && c.inst.ready) live++;
    else if (AU.failed[id]) synth++;
  });
  if (badge) {
    badge.textContent = live ? ('샘플 ' + live + '종' + (synth ? ' · 신스 ' + synth : '')) : (synth ? '신스 엔진' : '샘플 대기');
    badge.className = 'badge' + (live ? ' ok' : synth ? ' warn' : '');
  }
  if (st) {
    if (!insts.length) st.textContent = '악기를 골라 주세요';
    else st.textContent = live
      ? ('실제 악기 원음 ' + live + '/' + total + ' 트랙' + (synth ? ' · 신스 ' + synth : ''))
      : '신스 폴백 준비됨';
  }
  if (mixb) mixb.textContent = '샘플 ' + live + '/' + total;
  var ab = $('about-engine'); if (ab) ab.textContent = live ? '샘플러 + 신스 하이브리드' : '신스 엔진';
  var as = $('about-samples'); if (as) as.textContent = live + '종 로드 · ' + (Object.keys(AU.buffers).length) + '버퍼';
  try { refreshSlots(); } catch (e) {}
}

/* 스펙트럼 & 미터 */
function startMeter(){
  if (AU.raf) return;
  var cv = $('meter-canvas'), spec = $('spectrum-canvas');
  function frame(){
    AU.raf = requestAnimationFrame(frame);
    if (!AU.analyser) return;
    var buf = new Uint8Array(AU.analyser.frequencyBinCount);
    AU.analyser.getByteFrequencyData(buf);
    if (cv) {
      var c = cv.getContext('2d'), w = cv.width, h = cv.height;
      if (cv.clientWidth && cv.width !== Math.floor(cv.clientWidth * dpr())) { cv.width = Math.floor(cv.clientWidth * dpr()); cv.height = Math.floor(cv.clientHeight * dpr()); }
      c.clearRect(0, 0, w, h);
      var bars = 48, bw = w / bars;
      for (var i = 0; i < bars; i++) {
        var v = buf[Math.floor(i * buf.length / bars)] / 255;
        var grd = c.createLinearGradient(0, h, 0, h - v * h);
        grd.addColorStop(0, '#22d3ee'); grd.addColorStop(1, '#a78bfa');
        c.fillStyle = grd;
        c.fillRect(i * bw + 1, h - v * h, bw - 2, v * h);
      }
    }
    if (spec) {
      var c2 = spec.getContext('2d'), w2 = spec.width, h2 = spec.height;
      c2.clearRect(0, 0, w2, h2);
      var n = 16, bw2 = w2 / n;
      for (var j = 0; j < n; j++) {
        var v2 = buf[Math.floor(j * buf.length / n)] / 255;
        c2.fillStyle = j % 2 ? '#a78bfa' : '#22d3ee';
        c2.fillRect(j * bw2 + 1, h2 - v2 * h2, bw2 - 1.5, v2 * h2);
      }
    }
  }
  frame();
}
function dpr(){ return Math.min(2, window.devicePixelRatio || 1); }

/* ---------------------------------------------------------------- 4. 작곡 엔진 */
function defaultCurve(kind){
  var c = [.22,.34,.5,.62,.72,.84,.94,.99, .96,.86,.8,.92, .74,.58,.42,.3];
  if (kind === 'buildup') c = c.map(function(v,i){ return 0.2 + (i/15) * 0.78; });
  if (kind === 'drop')    c = [.45,.92,.95,.9,.88,.85,.9,.95, .8,.7,.62,.55, .5,.44,.4,.34];
  if (kind === 'chill')   c = [.4,.42,.45,.48,.5,.52,.55,.58, .55,.52,.5,.48, .46,.44,.42,.4];
  if (kind === 'wave')    c = c.map(function(v,i){ return 0.45 + Math.sin(i / 2.2) * 0.3; });
  return c.map(function(v){ return Math.max(0.12, Math.min(1, v)); });
}

function presetEnergyCurve(p){
  var kind = (p && p.curve) || 'standard';
  var en = p && p.energy != null ? p.energy : S.energy;
  return defaultCurve(kind).map(function(v){
    return clamp(v * (0.55 + en / 100 * 0.62), .12, 1);
  });
}

function sections(){
  if (S.bars <= 4) return [{ name:'A', start:0, len:S.bars, e:.7 }];
  if (S.bars <= 8) return [{ name:'A', start:0, len:4, e:.55 }, { name:'B', start:4, len:4, e:.92 }];
  return [
    { name:'Intro', start:0,  len:2, e:.3 },
    { name:'A',     start:2,  len:4, e:.62 },
    { name:'B',     start:6,  len:4, e:.95 },
    { name:"A′",    start:10, len:4, e:.8 },
    { name:'Outro', start:14, len:2, e:.38 }
  ];
}
function barEnergy(bar){
  var v = S.energyCurve[bar];
  if (v == null) {
    var sec = sections().filter(function(s){ return bar >= s.start && bar < s.start + s.len; })[0];
    v = sec ? sec.e : .6;
  }
  return clamp(v, .1, 1);
}
function sectionOf(bar){
  return sections().filter(function(s){ return bar >= s.start && bar < s.start + s.len; })[0] || { name:'A', e:.6 };
}

/* 코드 진행 채우기 */
function buildChords(seed){
  seedRand(seed || 20261127);
  var prog = PROGRESSIONS[S.prog] || PROGRESSIONS[S.preset] || PROGRESSIONS.citypop;
  var degs = (S.mode === 'major' ? prog.major : prog.minor).slice();
  S.chords = [];
  for (var b = 0; b < S.bars; b++) {
    /* 4마디 블록 단위로 진행을 유지하고, B 블록(9~12마디)만 한 칸 회전해 대비를 준다 */
    var block = Math.floor(b / 4);
    var rot = (block === 2 && S.bars >= 12) ? 1 : 0;
    var deg = degs[(b + rot) % degs.length];
    var ext = S.ext;
    var notes = chordVoicing(deg, ext);
    S.chords.push({ deg: deg, ext: ext, notes: notes, name: chordName(deg, ext), root: notes[0] });
  }
}

function nearestChordTone(from, notes, maxLeap){
  var best = null, bd = 999;
  for (var i = 0; i < notes.length; i++) {
    var cands = [notes[i], notes[i] + 12, notes[i] - 12];
    for (var j = 0; j < cands.length; j++) {
      var d = Math.abs(cands[j] - from);
      if (d < bd && d <= (maxLeap || 7)) { bd = d; best = cands[j]; }
    }
  }
  return best == null ? from : best;
}

function genMelody(seed, fromHum){
  seedRand(seed || 909);
  var pool = scaleMidis().filter(function(m){ return m >= 62 && m <= 86; });
  var HI = 86;
  var rhythms = {
    low:  [[0,4,8,12],[0,4,8],[0,6,8,12],[0,4,10,12]],
    mid:  [[0,2,4,6,8,10,12,14],[0,2,4,8,10,12],[0,3,4,6,8,11,12,14],[0,4,6,8,10,12]],
    high: [[0,1,2,4,6,7,8,10,11,12,14],[0,2,3,4,6,8,9,10,12,14],[0,2,4,5,6,8,10,11,12,14,15]]
  };
  var out = [];
  var prev = pool[Math.floor(pool.length / 2)];
  var lastRhythm = null, lastLine = null;

  for (var b = 0; b < S.bars; b++) {
    var ch = S.chords[b] || { notes:[60,64,67] };
    var sec = sectionOf(b);
    var e = barEnergy(b) * (0.75 + S.energy / 100 * 0.35);
    e = clamp(e, .1, 1.15);
    var intro = sec.name === 'Intro', outro = sec.name === 'Outro';

    var rhythm;
    if (fromHum && S.hum.some(function(x){ return x != null; }) && b < 2) {
      rhythm = S.hum.map(function(m, i){ return m != null ? i : null; }).filter(function(x){ return x != null; });
      if (!rhythm.length) rhythm = [0,4,8,12];
    } else if (lastRhythm && chance(.34)) {
      rhythm = lastRhythm;
    } else {
      rhythm = pick(e > .8 ? rhythms.high : e > .45 ? rhythms.mid : rhythms.low);
    }
    lastRhythm = rhythm;

    var line = [];
    for (var k = 0; k < rhythm.length; k++) {
      var step = rhythm[k];
      if (intro && step > 8) continue;
      if (outro && step > 6) continue;
      if (step !== 0 && chance(intro ? .5 : outro ? .35 : (1 - e) * .28)) continue;

      var target;
      if (fromHum && b < 2 && S.hum[step] != null) {
        target = S.hum[step] + 12;
      } else if (step === 0) {
        target = nearestChordTone(prev, ch.notes, 12);
      } else if (step % 4 === 0) {
        target = chance(.62) ? nearestChordTone(prev, ch.notes, 9) : nearestChordTone(prev, pool, 5);
      } else if (chance(.16)) {
        target = prev;                       /* 같은 음 반복 — 리듬에 힘을 준다 */
      } else {
        var dir = chance(.5) ? 1 : -1;
        var idx = pool.indexOf(nearestChordTone(prev, pool, 5));
        if (idx < 0) idx = Math.floor(pool.length / 2);
        target = pool[clamp(idx + dir * (1 + rint(2)), 0, pool.length - 1)];
        if (Math.abs(target - prev) > 7) target = prev + dir * 2;
      }
      target = clamp(target, 60, HI);
      if (Math.abs(target - prev) > 12) target = prev + (target > prev ? 7 : -7);

      var nextStep = k + 1 < rhythm.length ? rhythm[k + 1] : 16;
      var dur = Math.max(1, Math.min(8, nextStep - step));
      var vel = (intro ? .5 : outro ? .55 : .72) + (step % 4 === 0 ? .12 : 0) + e * .16;
      out.push({ bar:b, step:step, midi:target, dur:dur, vel:clamp(vel, .25, 1) });
      line.push(target);
      prev = target;
    }
    /* 훅 반복: 같은 코드면 앞 마디 선율을 살짝 변형해 다시 (기억에 남는 후렴) */
    if (!line.length && lastLine && lastLine.length) {
      lastLine.forEach(function(m, k){
        var st = rhythm[k] != null ? rhythm[k] : k * 2;
        out.push({ bar:b, step:st, midi:nearestChordTone(m, ch.notes, 12), dur:2, vel:.6 });
      });
    }
    lastLine = line;
  }
  return out;
}

function genBass(seed){
  seedRand(seed || 5150);
  var style = { citypop:'funk', lofi:'straight', cinematic:'sub', synthwave:'pulse', acoustic:'straight', hiphop:'sub',
    news:'straight', breaking:'pulse', bossa:'bossa', kpop:'funk', ballad:'straight', funk:'funk',
    chiptune:'pulse', ambient:'sub', techhouse:'pulse', neosoul:'walk' }[S.preset] || 'straight';
  var out = [];
  for (var b = 0; b < S.bars; b++) {
    var ch = S.chords[b]; if (!ch) continue;
    var e = barEnergy(b);
    var sec = sectionOf(b);
    if (sec.name === 'Intro' && b % 4 !== 3) continue;
    var root = ch.notes[0] - 12;
    while (root > 48) root -= 12;
    while (root < 33) root += 12;
    var fifth = root + 7, oct = root + 12;
    var steps;
    if (style === 'funk')       steps = e > .6 ? [[0,root],[3,oct],[6,fifth],[8,root],[11,oct],[14,fifth]] : [[0,root],[6,fifth],[8,root],[14,oct]];
    else if (style === 'pulse') steps = [[0,root],[2,oct],[4,root],[6,oct],[8,root],[10,oct],[12,root],[14,oct]];
    else if (style === 'sub')   steps = [[0,root],[8,root],[14,chance(.5) ? fifth : oct]];
    else if (style === 'bossa') steps = e > .5 ? [[0,root],[3,fifth],[6,oct],[10,root],[13,fifth]] : [[0,root],[6,fifth],[10,oct]];
    else if (style === 'walk')  steps = [[0,root],[4,fifth],[8,oct],[12,fifth],[14,chance(.5) ? fifth : oct]];
    else                        steps = [[0,root],[6,fifth],[8,root],[12,oct]];
    steps.forEach(function(p){
      out.push({ bar:b, step:p[0], midi:p[1], dur: p[0] === 0 ? 3 : 2, vel: clamp(.62 + e * .3, .3, 1) });
    });
    /* 다음 코드로 넘어가는 접근음 */
    var nextRoot = S.chords[(b + 1) % S.bars].notes[0] - 12;
    while (nextRoot > 48) nextRoot -= 12;
    while (nextRoot < 33) nextRoot += 12;
    if (e > .5 && chance(.55)) out.push({ bar:b, step:15, midi: nextRoot > root ? nextRoot - 1 : nextRoot + 1, dur:1, vel:.5 });
  }
  return out;
}

function genArp(seed){
  seedRand(seed || 3131);
  var out = [];
  var pObj = PRESETS.filter(function(x){ return x.id === S.preset; })[0];
  var fixedSteps = pObj && pObj.arpPat && pObj.arpPat.length ? pObj.arpPat : null;
  for (var b = 0; b < S.bars; b++) {
    var ch = S.chords[b]; if (!ch) continue;
    var e = barEnergy(b);
    if (e < .3) continue;
    var sec = sectionOf(b);
    if (sec.name === 'Intro' && b % 2 === 0) continue;
    var tones = ch.notes.map(function(n){ return n + 12; });
    var seq = [0, 1, 2, 3, 2, 1, 2, 3];
    if (fixedSteps) {
      var dense = fixedSteps.length > 8;
      for (var f = 0; f < fixedSteps.length; f++) {
        var fst = fixedSteps[f];
        if (sec.name === 'Intro' && fst > 7) continue;
        if (sec.name === 'Outro' && fst > 11) continue;
        var fidx = seq[f % seq.length] % tones.length;
        out.push({ bar:b, step:fst, midi:tones[fidx], dur: dense ? 1 : 2,
          vel: (fst % 4 === 0 ? .5 : .34) + e * .18 });
      }
      continue;
    }
    var count = e > .8 ? 16 : e > .5 ? 8 : 4;
    var gap = 16 / count;
    for (var k = 0; k < count; k++) {
      var idx = seq[k % seq.length] % tones.length;
      out.push({ bar:b, step: Math.round(k * gap), midi: tones[idx], dur: Math.max(1, Math.round(gap * .8)), vel: (k % 4 === 0 ? .55 : .34) + e * .18 });
    }
  }
  return out;
}

function genDrums(seed){
  seedRand(seed || 4242);
  var kitId = S.tracks.filter(function(t){ return t.role === 'drums'; })[0].inst;
  var pObj = PRESETS.filter(function(x){ return x.id === S.preset; })[0];
  var pat = (pObj && pObj.pat && DRUM_PAT[pObj.pat]) || DRUM_PAT[kitId] || DRUM_PAT['kit-cr78'];
  var out = [];
  for (var b = 0; b < S.bars; b++) {
    var e = barEnergy(b);
    var sec = sectionOf(b);
    var useB = (sec.name === 'B' || sec.name === "A′") && e > .55;
    var p = useB ? pat.B : pat.A;
    var isFill = S.fill && ((b + 1) % 4 === 0) && b > 0;
    for (var s = 0; s < 16; s++) {
      var accent = (s % 4 === 0) ? 1 : (s % 2 === 0 ? .82 : .68);
      if (isFill && s >= 12) {
        var rowF = s === 12 ? 'snare' : s === 13 ? 'tom1' : s === 14 ? 'tom2' : 'tom3';
        out.push({ bar:b, step:s, row:rowF, vel: clamp(.5 + (s - 12) * .12 + e * .2, .3, 1) });
        continue;
      }
      if (p.kick[s] === '1' && (e > .28 || s === 0)) out.push({ bar:b, step:s, row:'kick', vel: clamp(.72 + e * .28, .3, 1) });
      if (p.snare[s] === '1' && e > .42) out.push({ bar:b, step:s, row:'snare', vel: clamp(.66 + e * .3, .3, 1) });
      if (p.hat[s] === '1' && e > .22) out.push({ bar:b, step:s, row:'hat', vel: clamp(accent * (.24 + e * .26), .12, .78) });
      if (p.ohat[s] === '1' && e > .5) out.push({ bar:b, step:s, row:'ohat', vel: clamp(.42 + e * .22, .2, .9) });
    }
    /* 고에너지 구간 16분 하이햇 롤 */
    if (e > .88 && !isFill) {
      for (var s2 = 1; s2 < 16; s2 += 2) {
        if (p.hat[s2] !== '1') out.push({ bar:b, step:s2, row:'hat', vel:.26 });
      }
    }
  }
  return out;
}

/* 이벤트 평탄화 — 재생·내보내기 공용 */
function rebuildEvents(){
  var total = totalSteps();
  var ev = new Array(total);
  for (var i = 0; i < total; i++) ev[i] = [];
  var tIdx = {};
  S.tracks.forEach(function(t, i){ tIdx[t.role] = i; });

  S.chords.forEach(function(ch, b){
    var step = b * 16;
    if (step >= total) return;
    ch.notes.forEach(function(n){
      ev[step].push({ t: tIdx.chords, midi: n, dur: 15, vel: .52 });
    });
  });
  S.notes.forEach(function(n){
    var s = n.bar * 16 + n.step;
    if (s < total) ev[s].push({ t: tIdx.melody, midi: n.midi, dur: n.dur || 2, vel: n.vel || .75 });
  });
  S.bass.forEach(function(n){
    var s = n.bar * 16 + n.step;
    if (s < total) ev[s].push({ t: tIdx.bass, midi: n.midi, dur: n.dur || 2, vel: n.vel || .8 });
  });
  S.arp.forEach(function(n){
    var s = n.bar * 16 + n.step;
    if (s < total) ev[s].push({ t: tIdx.arp, midi: n.midi, dur: n.dur || 1, vel: n.vel || .4 });
  });
  S.drums.forEach(function(n){
    var s = n.bar * 16 + n.step;
    if (s < total) ev[s].push({ t: tIdx.drums, row: n.row, dur: 1, vel: n.vel || .8 });
  });

  /* 휴머나이즈 + 스윙 (시드 고정 → 재생과 내보내기가 동일) */
  seedRand(77771);
  var swingUnit = (S.swing / 100) * 0.66;
  ev.forEach(function(list, step){
    list.forEach(function(e2){
      e2.jit = 0;
      if (S.humanize) {
        e2.jit = (rand() - 0.5) * 0.09;
        e2.vel = clamp(e2.vel * (1 + (rand() - 0.5) * 0.24), .1, 1);
      }
      if (step % 2 === 1) e2.jit += swingUnit;
    });
  });
  S.events = ev;
  var count = 0;
  ev.forEach(function(l){ count += l.length; });
  S.eventCount = count;
}

/* 전체 작곡 */
function composeAll(seed, opts){
  opts = opts || {};
  if (!S.chords.length || opts.newChords) buildChords(seed);
  S.notes = genMelody(opts.seed || seed, opts.fromHum);
  S.bass = genBass((seed || 1) + 11);
  S.arp = genArp((seed || 1) + 23);
  S.drums = genDrums((seed || 1) + 37);
  rebuildEvents();
  refreshStats();
}

/* 무드 문장 → 프리셋 추정 (AI 서버가 막혔을 때 쓰는 스마트 폴백) */
var MOOD_RULES = [
  { p:'citypop',   w:['시티팝','시티','네온','드라이브','밤거리','80','야경','몽환','일렉'] },
  { p:'lofi',      w:['로파이','카페','비','빗소리','아늑','새벽','공부','잔잔','감성'] },
  { p:'cinematic', w:['시네마','영화','웅장','오케스트라','감동','우주','ost','드라마'] },
  { p:'synthwave', w:['신스웨이브','신스','레트로','복고','질주','아케이드'] },
  { p:'acoustic',  w:['어쿠스틱','기타','아침','햇살','산책','주말','맑','밝'] },
  { p:'hiphop',    w:['힙합','트랩','808','비트','도심','랩','쿨','쇼츠'] },
  { p:'news',      w:['뉴스','경제','브리핑','시황','리포트','앵커','증시','깔끔'] },
  { p:'breaking',  w:['속보','긴장','긴박','서스펜스','추적','위기','경고','스릴'] },
  { p:'bossa',     w:['보사노바','보사','라틴','브런치','테라스'] },
  { p:'kpop',      w:['k-pop','kpop','케이팝','아이돌','청량','걸그룹','댄스'] },
  { p:'ballad',    w:['발라드','애절','이별','서정','눈물','사랑'] },
  { p:'funk',      w:['펑키','펑크','그루브','브라스','디스코','클럽'] },
  { p:'chiptune',  w:['8비트','8bit','칩튠','픽셀','게임'] },
  { p:'ambient',   w:['앰비언트','힐링','명상','수면','요가','숲'] },
  { p:'techhouse', w:['테크','하우스','드롭','페스티벌','edm','일렉트로'] },
  { p:'neosoul',   w:['네오소울','재즈','소울','알앤비','r&b'] }
];
function guessPreset(text){
  var t = String(text || '').toLowerCase(), best = null, bs = 0;
  MOOD_RULES.forEach(function(r){
    var s = 0;
    r.w.forEach(function(w){ if (t.indexOf(w) > -1) s += w.length > 2 ? 2 : 1; });
    if (s > bs) { bs = s; best = r.p; }
  });
  if (best) return best;
  return PRESETS[Math.floor(Math.random() * PRESETS.length)].id;
}

function applyPresetValues(p, keepMood){
  S.preset = p.id; S.prog = p.prog || p.id; S.ext = p.ext || '7';
  S.key = p.key; S.mode = p.mode; S.bpm = p.bpm; S.bright = p.bright; S.energy = p.energy;
  if (p.swing != null) S.swing = clamp(p.swing, 0, 60);
  var byRole = { melody:p.mel, chords:p.chd, bass:p.bas, drums:p.drm, arp:p.arp || 'guitar' };
  S.tracks.forEach(function(t){ if (byRole[t.role]) t.inst = byRole[t.role]; else t.inst = t.inst; });
  S.energyCurve = presetEnergyCurve(p);
  if (!keepMood) {
    var mt = $('mood-text'); if (mt) mt.value = p.mood;
  }
  syncPresetUI();
  saveSettings();
}

function syncPresetUI(){
  var host = $('preset-buttons');
  if (host) {
    Array.prototype.forEach.call(host.children, function(btn){
      btn.classList.toggle('on', btn.dataset.pid === S.preset);
    });
  }
  var ks = $('key-select'); if (ks) ks.value = String(S.key);
  var ms = $('mode-select'); if (ms) ms.value = S.mode;
  var bs = $('bpm-slider'); if (bs) bs.value = S.bpm;
  var bv = $('bpm-val'); if (bv) bv.textContent = S.bpm;
  var hb = $('header-bpm'); if (hb) hb.value = S.bpm;
  var br = $('bright-slider'); if (br) br.value = S.bright;
  var brv = $('bright-val'); if (brv) brv.textContent = S.bright;
  var en = $('energy-slider'); if (en) en.value = S.energy;
  var env = $('energy-val'); if (env) env.textContent = S.energy;
  var sw = $('swing-slider'); if (sw) sw.value = S.swing;
  var swv = $('swing-val'); if (swv) swv.textContent = S.swing;
  if (AU.ctx && AU.master) {
    AU.master.low.gain.value = S.master.low;
  }
  updatePrompt();
}

function updatePrompt(){
  var ta = $('ai-prompt'); if (!ta) return;
  var p = PRESETS.filter(function(x){ return x.id === S.preset; })[0];
  var mood = ($('mood-text') && $('mood-text').value.trim()) || (p ? p.mood : '');
  var key = KEY_LABEL[S.key] + ' ' + (SCALE_LABEL[S.mode] || '');
  var tone = S.bright > 65 ? 'bright and airy' : S.bright > 40 ? 'warm balanced tone' : 'dark mellow tone';
  var en = S.energy > 72 ? 'high energy driving groove' : S.energy > 45 ? 'steady mid-tempo groove' : 'sparse relaxed flow';
  var base = p ? p.eng : 'Modern instrumental';
  ta.value = base + ', ' + S.bpm + ' BPM, ' + key + ', ' + tone + ', ' + en +
    ', seamless loopable, clean studio mix and master, no vocals. Mood: ' + mood;
}

function refreshStats(){
  var n = $('stat-bars'); if (n) n.textContent = S.bars;
  var c = $('stat-notes'); if (c) c.textContent = S.eventCount || 0;
  var barSec = 4 * 60 / S.bpm;
  var l = $('stat-len'); if (l) l.textContent = (barSec * S.bars).toFixed(1) + 's';
  var cl = $('chord-line');
  if (cl && S.chords.length) {
    var names = S.chords.slice(0, 8).map(function(ch, i){ return (i + 1) + ':' + ch.name; }).join('  ');
    cl.innerHTML = '<b>' + KEY_LABEL[S.key] + ' ' + SCALE_LABEL[S.mode] + '</b> · ' + (PROGRESSIONS[S.prog] ? PROGRESSIONS[S.prog].label : '') +
      '<br><span class="mono" style="font-size:11px;color:var(--tx2);">' + names + (S.chords.length > 8 ? ' …' : '') + '</span>';
  }
  var strip = $('struct-strip');
  if (strip) {
    strip.innerHTML = '';
    for (var b = 0; b < 16; b++) {
      var i2 = el('i');
      var v = barEnergy(b);
      i2.style.opacity = String(0.32 + v * 0.68);
      i2.style.height = Math.round(3 + v * 11) + 'px';
      i2.style.background = b < S.bars ? 'var(--cyan)' : 'var(--track)';
      i2.title = 'BAR ' + (b + 1) + ' · ' + Math.round(v * 100) + '%';
      strip.appendChild(i2);
    }
  }
  var sd = $('struct-desc');
  if (sd) sd.textContent = sections().map(function(s2){ return s2.name + ' ' + s2.len + '마디'; }).join(' → ');
}

/* ---------------------------------------------------------------- 5. 루프 · 내보내기 */
var API_URL = 'https://stock-dashboard-live-bice.vercel.app/api/content-ai';

function planLoop(){
  var barSec = 4 * 60 / S.bpm;
  var L = S.loop;
  if (L.type === 'sec') {
    var bars = Math.max(1, Math.round(L.value / barSec));
    if (S.exactSec === false) {
      /* 템포를 지키고 마디에 맞춘 근사 길이 — 미리 들은 그대로 저장된다 */
      var realSec = bars * 4 * 60 / S.bpm;
      return { bars:bars, bpm:S.bpm, sec: realSec, exact: Math.abs(realSec - L.value) < 0.05, adjusted:false };
    }
    var bpmExact = bars * 4 * 60 / L.value;
    var diff = Math.abs(bpmExact - S.bpm) / S.bpm;
    if (diff <= 0.1 && bpmExact >= 60 && bpmExact <= 175) {
      var adjBpm = Math.round(bpmExact * 10) / 10;
      return { bars:bars, bpm: adjBpm, sec: bars * 4 * 60 / adjBpm, exact:true, adjusted: Math.abs(bpmExact - S.bpm) > 0.15 };
    }
    return { bars:bars, bpm:S.bpm, sec: bars * 4 * 60 / S.bpm, exact:false, adjusted:false };
  }
  return { bars:L.value, bpm:S.bpm, sec: L.value * 4 * 60 / S.bpm, exact:true, adjusted:false };
}

function refreshLoopInfo(){
  var p = planLoop();
  var sec = $('loop-sec'), bars = $('loop-bars'), seam = $('loop-seam');
  if (sec) sec.textContent = p.sec.toFixed(1) + '초';
  if (bars) bars.textContent = p.bars + '마디 · ' + (p.adjusted ? S.bpm + '→' + p.bpm : p.bpm) + ' BPM';
  if (seam) {
    seam.textContent = p.exact ? '끊김 없음 (테일 감아넣기)' : '템포 유지 · 마디 근사';
    seam.style.color = p.exact ? 'var(--green)' : 'var(--amber)';
  }
  return p;
}

function encodeWav(buffer, peakNorm){
  var chs = buffer.numberOfChannels, len = buffer.length;
  var data = [];
  for (var c = 0; c < chs; c++) data.push(buffer.getChannelData(c));
  var peak = 0;
  for (var c2 = 0; c2 < chs; c2++) {
    var d = data[c2];
    for (var i = 0; i < len; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; }
  }
  var gain = 1;
  if (peakNorm && peak > 0.0001) gain = Math.min(4, 0.891 / peak);
  var bytes = 44 + len * chs * 2;
  var arr = new ArrayBuffer(bytes), view = new DataView(arr);
  var ws = function(o, s){ for (var i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); view.setUint32(4, bytes - 8, true); ws(8, 'WAVE');
  ws(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, chs, true); view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * chs * 2, true); view.setUint16(32, chs * 2, true);
  view.setUint16(34, 16, true); ws(36, 'data'); view.setUint32(40, bytes - 44, true);
  var off = 44;
  for (var i2 = 0; i2 < len; i2++) {
    for (var c3 = 0; c3 < chs; c3++) {
      var s = Math.max(-1, Math.min(1, data[c3][i2] * gain));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return { blob: new Blob([arr], { type:'audio/wav' }), peak: peak, gain: gain, bytes: bytes };
}

/* 들리는 그대로 오프라인 렌더 + 루프 이음매를 위해 꼬리를 앞에 감아 넣는다 */
function renderLoop(plan){
  var sr = 44100;
  var barSec = 4 * 60 / plan.bpm;
  var bodySec = plan.bars * barSec;
  var tailSec = Math.min(2.6, Math.max(1.2, barSec));
  var totalSamples = Math.ceil((bodySec + tailSec) * sr);
  var octx = new OfflineAudioContext(2, totalSamples, sr);
  var master = buildMaster(octx, S.master);
  master.out.connect(octx.destination);

  var anySolo = S.tracks.some(function(t){ return t.solo; });
  var nodes = {};
  S.tracks.forEach(function(t){
    var audible = !t.mute && (!anySolo || t.solo);
    var gain = octx.createGain(); gain.gain.value = audible ? t.vol : 0;
    var pan = octx.createStereoPanner(); pan.pan.value = t.pan || 0;
    var filt = octx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = instTone(t.inst);
    gain.connect(pan); pan.connect(filt); filt.connect(master.in);
    nodes[t.id] = gain;
  });

  var sd = barSec / 16;
  var arrSteps = S.bars * 16, loopSteps = plan.bars * 16;
  var reps = Math.ceil(loopSteps / arrSteps);
  for (var rep = 0; rep < reps; rep++) {
    for (var st = 0; st < arrSteps; st++) {
      var gs = rep * arrSteps + st;
      if (gs >= loopSteps) break;
      var list = S.events[st];
      if (!list || !list.length) continue;
      for (var i = 0; i < list.length; i++) {
        var ev = list[i], trk = S.tracks[ev.t];
        if (!trk || !nodes[trk.id]) continue;
        var tAt = gs * sd + (ev.jit || 0) * sd;
        fireEvent(octx, nodes[trk.id], trk, ev, Math.max(0.001, tAt), sd);
      }
    }
  }

  return octx.startRendering().then(function(rendered){
    var bodyLen = Math.round(bodySec * sr);
    var out = new AudioBuffer({ length: bodyLen, sampleRate: sr, numberOfChannels: 2 });
    for (var ch = 0; ch < 2; ch++) {
      var src = rendered.getChannelData(ch);
      var dst = out.getChannelData(ch);
      for (var i2 = 0; i2 < bodyLen; i2++) dst[i2] = src[i2];
      /* 꼬리(잔향·길게 남은 음)를 앞부분에 겹쳐 넣어 반복 이음매를 없앤다 */
      var tailLen = Math.min(bodyLen, src.length - bodyLen);
      for (var k = 0; k < tailLen; k++) dst[k] += src[bodyLen + k];
    }
    return out;
  });
}

function downloadBlob(blob, filename){
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function setExportProgress(pct, msg){
  var box = $('export-prog');
  if (box) {
    box.style.display = pct == null ? 'none' : 'block';
    var bar = box.firstElementChild;
    if (bar) bar.style.width = clamp(pct, 0, 100) + '%';
  }
  if (msg) { var n = $('export-note'); if (n) n.textContent = msg; }
}

var exporting = false;
function exportWav(){
  if (exporting) return;
  var btn = $('btn-export-wav');
  exporting = true;
  if (btn) btn.disabled = true;
  var plan = refreshLoopInfo();
  var t0 = performance.now();
  setExportProgress(6, '악기 샘플을 확인하는 중…');
  ensureAudio()
    .then(function(){ return loadNeeded(null); })
    .then(function(){
      setExportProgress(28, '오프라인으로 렌더링하는 중… (' + plan.bars + '마디 / ' + plan.sec.toFixed(1) + '초)');
      return new Promise(function(r){ setTimeout(r, 40); });
    })
    .then(function(){ return renderLoop(plan); })
    .then(function(buf){
      setExportProgress(88, 'WAV 로 만드는 중…');
      return new Promise(function(r){ setTimeout(function(){ r(buf); }, 20); });
    })
    .then(function(buf){
      var enc = encodeWav(buf, S.normalize);
      var name = 'AURA_' + plan.bpm + 'bpm_' + plan.sec.toFixed(1) + 's_loop.wav';
      downloadBlob(enc.blob, name);
      var secs = ((performance.now() - t0) / 1000).toFixed(1);
      setExportProgress(100, '완료 · ' + (enc.bytes / 1024 / 1024).toFixed(2) + 'MB · 피크 ' +
        (20 * Math.log10(Math.max(enc.peak * enc.gain, 1e-6))).toFixed(1) + 'dBFS (' + secs + '초)');
      toast('WAV 저장 완료 · ' + plan.sec.toFixed(1) + '초 ' + name, 'ok');
      setTimeout(function(){ setExportProgress(null); }, 4000);
    })
    .catch(function(e){
      console.error(e);
      setExportProgress(null);
      toast('WAV 렌더 실패: ' + (e && e.message || e), 'err');
    })
    .then(function(){ exporting = false; if (btn) btn.disabled = false; });
}

/* ---------------- MIDI (SMF format 1) ---------------- */
function varlen(n){
  var buf = [n & 0x7f];
  n >>= 7;
  while (n > 0) { buf.unshift((n & 0x7f) | 0x80); n >>= 7; }
  return buf;
}
function midiTrack(chunkEvents, tpq){
  var bytes = [], last = 0;
  chunkEvents.sort(function(a, b){ return a.tick - b.tick || a.seq - b.seq; });
  chunkEvents.forEach(function(e){
    bytes = bytes.concat(varlen(Math.max(0, e.tick - last)));
    last = e.tick;
    bytes = bytes.concat(e.bytes);
  });
  bytes = bytes.concat([0x00, 0xFF, 0x2F, 0x00]);
  var head = [0x4D, 0x54, 0x72, 0x6B,
    (bytes.length >> 24) & 0xFF, (bytes.length >> 16) & 0xFF, (bytes.length >> 8) & 0xFF, bytes.length & 0xFF];
  void tpq;
  return head.concat(bytes);
}
function exportMidi(){
  var plan = planLoop();
  var tpq = 480;
  var barTicks = tpq * 4;
  var secPerBeat = 60 / plan.bpm;
  var secs = plan.bars * 4 * secPerBeat;
  var tracksOut = [];
  var seq = 0;

  function collect(role, channel, program){
    var evs = [], t = S.tracks.filter(function(x){ return x.role === role; })[0];
    if (!t) return null;
    var chBase = channel;
    var arrSteps = S.bars * 16, loopSteps = plan.bars * 16, reps = Math.ceil(loopSteps / arrSteps);
    for (var rep = 0; rep < reps; rep++) {
      for (var st = 0; st < arrSteps; st++) {
        var gs = rep * arrSteps + st;
        if (gs >= loopSteps) break;
        (S.events[st] || []).forEach(function(ev){
          if (ev.t !== S.tracks.indexOf(t)) return;
          var tick = Math.round(gs / 4 * tpq + (ev.jit || 0) * tpq / 4);
          var dur = Math.max(1, Math.round((ev.dur || 1) / 4 * tpq));
          var note = ev.midi;
          if (role === 'drums') {
            var map = { kick:36, snare:38, hat:42, ohat:46, tom1:45, tom2:47, tom3:50 };
            note = map[ev.row] || 36;
          }
          var vel = Math.max(1, Math.min(127, Math.round((ev.vel || .8) * 127)));
          evs.push({ tick: tick, seq: seq++, bytes:[0x90 | chBase, note & 0x7f, vel] });
          evs.push({ tick: tick + dur, seq: seq++, bytes:[0x80 | chBase, note & 0x7f, 0x40] });
        });
      }
    }
    if (!evs.length) return null;
    var head = [{ tick:0, seq: -3, bytes:[0xC0 | chBase, program, 0x00] }];
    var name = t.name;
    var nameBytes = [];
    for (var i = 0; i < name.length; i++) nameBytes.push(name.charCodeAt(i) & 0x7f);
    head.push({ tick:0, seq:-2, bytes:[0xFF, 0x03, nameBytes.length].concat(nameBytes) });
    return midiTrack(head.concat(evs), tpq);
  }

  var t1 = collect('melody', 0, 0);
  var t2 = collect('chords', 1, 48);
  var t3 = collect('bass', 2, 33);
  var t4 = collect('arp', 3, 24);
  var t5 = collect('drums', 9, 0);
  [t1, t2, t3, t4, t5].forEach(function(t){ if (t) tracksOut.push(t); });
  if (!tracksOut.length) { toast('먼저 곡을 만들어 주세요', 'warn'); return; }

  var usPerQuarter = Math.round(60000000 / plan.bpm);
  var tempoBytes = [0xFF, 0x51, 0x03, (usPerQuarter >> 16) & 0xFF, (usPerQuarter >> 8) & 0xFF, usPerQuarter & 0xFF];
  var meta = [{ tick:0, seq:-9, bytes: tempoBytes },
              { tick:0, seq:-8, bytes:[0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] }];
  tracksOut.unshift(midiTrack(meta, tpq));

  var header = [0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01,
    (tracksOut.length >> 8) & 0xFF, tracksOut.length & 0xFF, (tpq >> 8) & 0xFF, tpq & 0xFF];
  var all = header;
  tracksOut.forEach(function(t){ all = all.concat(t); });
  downloadBlob(new Blob([new Uint8Array(all)], { type:'audio/midi' }),
    'AURA_' + plan.bpm + 'bpm_' + plan.bars + 'bar.mid');
  var _ = barTicks; void _;
  toast('MIDI 저장 완료 · ' + plan.bars + '마디 · ' + tracksOut.length + '트랙 · ' + secs.toFixed(1) + '초', 'ok');
}

/* ---------------- 프로젝트 저장/불러오기 ---------------- */
function projectSnapshot(){
  return {
    v: 1, at: Date.now(), title: S.aiTitle || 'AURA 프로젝트',
    bpm:S.bpm, key:S.key, mode:S.mode, bars:S.bars, preset:S.preset, prog:S.prog, ext:S.ext,
    bright:S.bright, energy:S.energy, swing:S.swing, humanize:S.humanize, fill:S.fill,
    energyCurve:S.energyCurve, chords:S.chords, notes:S.notes, bass:S.bass, arp:S.arp, drums:S.drums,
    hum:S.hum, tracks:S.tracks.map(function(t){ return { id:t.id, inst:t.inst, vol:t.vol, pan:t.pan, mute:t.mute, solo:t.solo }; }),
    master:S.master, loop:S.loop
  };
}
function applyProject(p){
  if (!p || !p.chords) { toast('프로젝트 파일을 읽을 수 없습니다', 'err'); return false; }
  S.bpm = p.bpm || S.bpm; S.key = p.key != null ? p.key : S.key; S.mode = p.mode || S.mode;
  S.bars = p.bars || S.bars; S.preset = p.preset || S.preset;
  S.prog = p.prog || S.prog; S.ext = p.ext || S.ext;
  S.bright = p.bright != null ? p.bright : S.bright;
  S.energy = p.energy != null ? p.energy : S.energy;
  S.swing = p.swing != null ? p.swing : S.swing;
  S.humanize = p.humanize !== false; S.fill = p.fill !== false;
  S.energyCurve = p.energyCurve && p.energyCurve.length === 16 ? p.energyCurve : defaultCurve('standard');
  S.chords = p.chords || []; S.notes = p.notes || []; S.bass = p.bass || []; S.arp = p.arp || [];
  S.drums = p.drums || []; S.hum = p.hum || new Array(16).fill(null);
  S.master = Object.assign(S.master, p.master || {});
  S.loop = p.loop || S.loop;
  if (p.tracks) p.tracks.forEach(function(t){
    var cur = S.tracks.filter(function(x){ return x.id === t.id; })[0];
    if (cur) { cur.inst = t.inst || cur.inst; cur.vol = t.vol != null ? t.vol : cur.vol; cur.pan = t.pan != null ? t.pan : cur.pan; cur.mute = !!t.mute; cur.solo = !!t.solo; }
  });
  if (p.title) { S.aiTitle = p.title; }
  rebuildEvents();
  syncPresetUI();
  renderMixer();
  refreshStats();
  refreshLoopInfo();
  drawAll();
  updateSamplerStatus();
  return true;
}
function saveProject(){
  try {
    localStorage.setItem('aura_project', JSON.stringify(projectSnapshot()));
    toast('이 기기에 저장했습니다', 'ok');
  } catch (e) { toast('저장 실패: ' + e.message, 'err'); }
}
function loadProject(){
  var raw = null;
  try { raw = localStorage.getItem('aura_project'); } catch (e) {}
  if (!raw) { toast('저장된 프로젝트가 없습니다', 'warn'); return; }
  try {
    if (applyProject(JSON.parse(raw))) toast('불러왔습니다', 'ok');
  } catch (e) { toast('불러오기 실패: ' + e.message, 'err'); }
}
function downloadProject(){
  var blob = new Blob([JSON.stringify(projectSnapshot(), null, 1)], { type:'application/json' });
  downloadBlob(blob, 'aura_project_' + new Date().toISOString().slice(0, 10) + '.json');
}
function pickProjectFile(){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = function(){
    var f = inp.files && inp.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function(){
      try { if (applyProject(JSON.parse(String(fr.result)))) toast('프로젝트를 불러왔습니다', 'ok'); }
      catch (e) { toast('파일을 읽을 수 없습니다', 'err'); }
    };
    fr.readAsText(f);
  };
  inp.click();
}

/* ---------------------------------------------------------------- 6. 캔버스 · 그리기 */
function isLight(){ return document.documentElement.getAttribute('data-theme') === 'light'; }
function pal(){
  return isLight()
    ? { bg:'#f7f9fd', grid:'rgba(15,23,42,.10)', gridSoft:'rgba(15,23,42,.05)', tx:'#41506a', tx2:'#7b8798',
        bar:'rgba(8,145,178,.28)', barOn:'#0891b2', line:'#5b4bd6', note:'#0891b2', note2:'#5b4bd6',
        black:'rgba(15,23,42,.045)', beat:'rgba(15,23,42,.16)', accent:'#c2760a' }
    : { bg:'#0d1322', grid:'rgba(148,163,184,.13)', gridSoft:'rgba(148,163,184,.06)', tx:'#9aa8bf', tx2:'#64748b',
        bar:'rgba(167,139,250,.30)', barOn:'#22d3ee', line:'#a78bfa', note:'#22d3ee', note2:'#a78bfa',
        black:'rgba(148,163,184,.05)', beat:'rgba(148,163,184,.22)', accent:'#f59e0b' };
}
function fitCanvas(cv){
  var r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  var d = dpr();
  var w = Math.max(1, Math.floor(r.width * d)), h = Math.max(1, Math.floor(r.height * d));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  var c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  return { w: w, h: h, d: d, c: c };
}

function drawEnergy(){
  var cv = $('energy-canvas'); if (!cv) return;
  var f = fitCanvas(cv); if (!f) return;
  var c = f.c, W = f.w, H = f.h, d = f.d, P = pal();
  c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
  var barW = W / 16, pad = 8 * d;
  c.font = '600 ' + (9.5 * d) + 'px Pretendard, sans-serif';
  for (var i = 0; i < 16; i++) {
    var on = i < S.bars;
    c.strokeStyle = i % 4 === 0 ? P.beat : P.gridSoft;
    c.beginPath(); c.moveTo(i * barW, 0); c.lineTo(i * barW, H); c.stroke();
    if (i % 4 === 0) { c.fillStyle = P.tx2; c.fillText('BAR ' + (i + 1), i * barW + 4 * d, 13 * d); }
  }
  var curBar = AU.playing ? Math.floor(S.step / 16) : -1;
  for (var b = 0; b < 16; b++) {
    var v = S.energyCurve[b] == null ? .5 : S.energyCurve[b];
    var bh = Math.max(4 * d, v * (H - 26 * d));
    c.fillStyle = b === curBar ? P.barOn : (b < S.bars ? P.bar : 'rgba(148,163,184,.12)');
    c.fillRect(b * barW + 3 * d, H - bh, barW - 6 * d, bh);
  }
  c.strokeStyle = P.line; c.lineWidth = 1.6 * d; c.beginPath();
  for (var k = 0; k < 16; k++) {
    var vv = S.energyCurve[k] == null ? .5 : S.energyCurve[k];
    var x = k * barW + barW / 2, y = H - Math.max(4 * d, vv * (H - 26 * d));
    if (k === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
  void pad;
}

var ROLL_LOW = 60, ROLL_HIGH = 86;
function drawRoll(){
  var cv = $('roll-canvas'); if (!cv) return;
  var f = fitCanvas(cv); if (!f) return;
  var c = f.c, W = f.w, H = f.h, d = f.d, P = pal();
  c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
  var cols = S.rollBars * 16, rows = ROLL_HIGH - ROLL_LOW + 1;
  var cw = W / cols, rh = H / rows;
  for (var r = 0; r < rows; r++) {
    var midi = ROLL_HIGH - r;
    var black = [1, 3, 6, 8, 10].indexOf(midi % 12) > -1;
    if (black) { c.fillStyle = P.black; c.fillRect(0, r * rh, W, rh); }
    if (midi % 12 === 0) {
      c.fillStyle = P.tx2; c.font = '600 ' + (8.5 * d) + 'px ui-monospace, monospace';
      c.fillText('C' + (Math.floor(midi / 12) - 1), 2 * d, r * rh + rh * 0.78);
    }
  }
  for (var i = 0; i <= cols; i++) {
    c.strokeStyle = i % 16 === 0 ? P.beat : (i % 4 === 0 ? P.grid : P.gridSoft);
    c.beginPath(); c.moveTo(i * cw, 0); c.lineTo(i * cw, H); c.stroke();
  }
  for (var r2 = 0; r2 <= rows; r2++) {
    c.strokeStyle = P.gridSoft; c.beginPath(); c.moveTo(0, r2 * rh); c.lineTo(W, r2 * rh); c.stroke();
  }
  var endBar = S.rollStart + S.rollBars;
  S.notes.forEach(function(n){
    if (n.bar < S.rollStart || n.bar >= endBar) return;
    if (n.midi < ROLL_LOW || n.midi > ROLL_HIGH) return;
    var col = (n.bar - S.rollStart) * 16 + n.step;
    var row = ROLL_HIGH - n.midi;
    var x = col * cw, y = row * rh;
    var w = Math.max(cw * 0.92, (n.dur || 1) * cw - 1);
    c.fillStyle = P.note;
    c.globalAlpha = clamp(0.55 + (n.vel || .7) * 0.45, .4, 1);
    c.fillRect(x + 1, y + 1, w, rh - 2);
    c.globalAlpha = 1;
  });
  if (AU.playing) {
    var st = S.step % (S.bars * 16);
    var barNow = Math.floor(st / 16), stepNow = st % 16;
    if (barNow >= S.rollStart && barNow < endBar) {
      var px = ((barNow - S.rollStart) * 16 + stepNow) * cw;
      c.strokeStyle = 'rgba(244,63,94,.85)'; c.lineWidth = 1.6 * d;
      c.beginPath(); c.moveTo(px, 0); c.lineTo(px, H); c.stroke();
    }
  }
  var lab = $('roll-range');
  if (lab) lab.textContent = (S.rollStart + 1) + '–' + Math.min(S.bars, S.rollStart + S.rollBars) + '마디';
}

function drawDrums(){
  var cv = $('drum-canvas'); if (!cv) return;
  var f = fitCanvas(cv); if (!f) return;
  var c = f.c, W = f.w, H = f.h, d = f.d, P = pal();
  c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
  var gutter = 46 * d, cw = (W - gutter) / 16, rh = H / DRUM_ROWS.length;
  c.font = '700 ' + (9 * d) + 'px Pretendard, sans-serif';
  DRUM_ROWS.forEach(function(row, ri){
    c.fillStyle = P.tx2;
    c.fillText(row.label, 5 * d, ri * rh + rh * 0.66);
    for (var s = 0; s < 16; s++) {
      var x = gutter + s * cw, y = ri * rh;
      var hit = S.drums.some(function(n){ return n.bar === S.drumBar && n.step === s && n.row === row.id; });
      c.fillStyle = hit ? (ri === 0 ? P.note : ri === 1 ? P.note2 : P.accent) : (s % 4 === 0 ? 'rgba(148,163,184,.10)' : 'rgba(148,163,184,.04)');
      c.globalAlpha = hit ? 0.95 : 1;
      c.fillRect(x + 1.5 * d, y + 2 * d, cw - 3 * d, rh - 4 * d);
      c.globalAlpha = 1;
    }
  });
  for (var i = 0; i <= 16; i++) {
    c.strokeStyle = i % 4 === 0 ? P.beat : P.gridSoft;
    c.beginPath(); c.moveTo(gutter + i * cw, 0); c.lineTo(gutter + i * cw, H); c.stroke();
  }
  var lab = $('drum-bar-label');
  if (lab) lab.textContent = (S.drumBar + 1) + '마디';
}

var HUM_LOW = 60, HUM_HIGH = 76;
function drawHum(){
  var cv = $('hum-canvas'); if (!cv) return;
  var f = fitCanvas(cv); if (!f) return;
  var c = f.c, W = f.w, H = f.h, d = f.d, P = pal();
  c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
  var cols = 16, rows = HUM_HIGH - HUM_LOW + 1;
  var cw = W / cols, rh = H / rows;
  for (var r = 0; r < rows; r++) {
    var midi = HUM_HIGH - r;
    if ([1,3,6,8,10].indexOf(midi % 12) > -1) { c.fillStyle = P.black; c.fillRect(0, r * rh, W, rh); }
    if (midi % 12 === 0) { c.fillStyle = P.tx2; c.font = '600 ' + (8.5 * d) + 'px ui-monospace, monospace'; c.fillText('C' + (Math.floor(midi / 12) - 1), 2 * d, r * rh + rh * .78); }
  }
  for (var i = 0; i <= cols; i++) {
    c.strokeStyle = i % 4 === 0 ? P.beat : P.gridSoft;
    c.beginPath(); c.moveTo(i * cw, 0); c.lineTo(i * cw, H); c.stroke();
  }
  S.hum.forEach(function(m, i){
    if (m == null) return;
    var row = clamp(HUM_HIGH - m, 0, rows - 1);
    c.fillStyle = P.note;
    c.fillRect(i * cw + 2 * d, row * rh + 1, cw - 4 * d, rh - 2);
  });
}

function drawAll(){
  drawEnergy(); drawRoll(); drawDrums(); drawHum();
}

/* ---------------------------------------------------------------- 7. 입력 처리 */
function canvasPoint(cv, ev){
  var r = cv.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height, w: r.width, h: r.height };
}

var rollPaint = null, drumPaint = null, humPaint = null, energyDrag = false;

function bindCanvasInput(){
  var roll = $('roll-canvas');
  var lastCell = '';
  function rollAct(ev, isStart){
    var p = canvasPoint(roll, ev);
    var cols = S.rollBars * 16, rows = ROLL_HIGH - ROLL_LOW + 1;
    var col = clamp(Math.floor(p.x * cols), 0, cols - 1);
    var row = clamp(Math.floor(p.y * rows), 0, rows - 1);
    var bar = S.rollStart + Math.floor(col / 16), step = col % 16;
    var midi = ROLL_HIGH - row;
    var key = bar + ':' + step;
    if (key === lastCell) return;
    lastCell = key;
    var idx = -1;
    S.notes.forEach(function(n, i){ if (n.bar === bar && n.step === step && n.midi === midi) idx = i; });
    if (isStart) rollPaint = idx > -1 ? 'erase' : 'draw';
    if (rollPaint === 'erase') {
      if (idx > -1) S.notes.splice(idx, 1);
    } else if (idx < 0) {
      S.notes.push({ bar:bar, step:step, midi:midi, dur: parseInt($('note-len').value, 10) || 2, vel:.8 });
    }
    rebuildEvents(); drawRoll(); refreshStats();
  }
  if (roll) {
    roll.addEventListener('pointerdown', function(e){ e.preventDefault(); roll.setPointerCapture(e.pointerId); lastCell = ''; rollAct(e, true); });
    roll.addEventListener('pointermove', function(e){ if (rollPaint) rollAct(e, false); });
    roll.addEventListener('pointerup', function(){ rollPaint = null; });
    roll.addEventListener('pointercancel', function(){ rollPaint = null; });
  }

  var drum = $('drum-canvas'), lastDrum = '';
  function drumAct(ev, isStart){
    var p = canvasPoint(drum, ev);
    var gutter = 46 / Math.max(1, p.w);
    if (p.x <= gutter) return;
    var col = clamp(Math.floor((p.x - gutter) / (1 - gutter) * 16), 0, 15);
    var row = clamp(Math.floor(p.y * DRUM_ROWS.length), 0, DRUM_ROWS.length - 1);
    var id = DRUM_ROWS[row].id;
    var key = id + ':' + col;
    if (key === lastDrum) return;
    lastDrum = key;
    var exists = S.drums.some(function(n){ return n.bar === S.drumBar && n.step === col && n.row === id; });
    if (isStart) drumPaint = exists ? 'erase' : 'draw';
    if (drumPaint === 'erase' || (exists && !isStart)) S.drums = S.drums.filter(function(n){ return !(n.bar === S.drumBar && n.step === col && n.row === id); });
    else if (!exists) S.drums.push({ bar:S.drumBar, step:col, row:id, vel: .82 });
    rebuildEvents(); drawDrums(); refreshStats();
  }
  if (drum) {
    drum.addEventListener('pointerdown', function(e){ e.preventDefault(); drum.setPointerCapture(e.pointerId); lastDrum = ''; drumAct(e, true); });
    drum.addEventListener('pointermove', function(e){ if (drumPaint) drumAct(e, false); });
    drum.addEventListener('pointerup', function(){ drumPaint = null; });
    drum.addEventListener('pointercancel', function(){ drumPaint = null; });
  }

  var hum = $('hum-canvas');
  function humAct(ev, isStart){
    var p = canvasPoint(hum, ev);
    var rows = HUM_HIGH - HUM_LOW + 1;
    var col = clamp(Math.floor(p.x * 16), 0, 15);
    var row = clamp(Math.floor(p.y * rows), 0, rows - 1);
    var midi = HUM_HIGH - row;
    if ($('chk-snap') && $('chk-snap').checked) midi = snapToScale(midi);
    if (S.hum[col] === midi && isStart) S.hum[col] = null;
    else S.hum[col] = midi;
    drawHum();
    var rd = $('hum-pitch-readout');
    if (rd) rd.textContent = S.hum[col] == null ? '--' : midiToName(S.hum[col]) + ' (수동)';
  }
  if (hum) {
    hum.addEventListener('pointerdown', function(e){ e.preventDefault(); hum.setPointerCapture(e.pointerId); humAct(e, true); });
    hum.addEventListener('pointermove', function(e){ if (humPaint) humAct(e, false); });
    hum.addEventListener('pointerdown', function(){ humPaint = 'draw'; });
    hum.addEventListener('pointerup', function(){ humPaint = null; });
  }

  var en = $('energy-canvas');
  var energyDirty = false;
  function energyAct(ev){
    var p = canvasPoint(en, ev);
    var idx = clamp(Math.floor(p.x * 16), 0, 15);
    S.energyCurve[idx] = clamp(1 - p.y, .1, 1);
    energyDirty = true;
    drawEnergy();
  }
  if (en) {
    en.addEventListener('pointerdown', function(e){ e.preventDefault(); energyDrag = true; en.setPointerCapture(e.pointerId); energyAct(e); });
    en.addEventListener('pointermove', function(e){ if (energyDrag) energyAct(e); });
    en.addEventListener('pointerup', function(){ energyDrag = false; if (energyDirty) { energyDirty = false; rebuildDynamics(); refreshStats(); } });
    en.addEventListener('pointercancel', function(){ energyDrag = false; if (energyDirty) { energyDirty = false; rebuildDynamics(); } });
  }
}

/* 에너지 곡선이 바뀌면 드럼·아르페지오 밀도만 다시 (멜로디·코드는 유지) */
function rebuildDynamics(){
  var keepNotes = S.notes.slice();
  S.drums = genDrums(4242);
  S.arp = genArp(3131);
  S.notes = keepNotes;
  rebuildEvents();
  refreshStats();
}

function snapToScale(midi){
  var iv = SCALES[S.mode] || SCALES.minor;
  var allowed = iv.map(function(x){ return (S.key + x) % 12; });
  for (var d = 0; d <= 3; d++) {
    if (allowed.indexOf((midi + d) % 12) > -1) return midi + d;
    if (allowed.indexOf((midi - d + 12) % 12) > -1) return midi - d;
  }
  return midi;
}

/* ---------------------------------------------------------------- 8. 패널 · 믹서 · 컨트롤 */
function renderPresets(){
  var box = $('preset-buttons'); if (!box) return;
  box.innerHTML = PRESETS.map(function(p){
    return '<button class="preset' + (p.id === S.preset ? ' on' : '') + '" data-pid="' + p.id + '" title="' + p.name + ' · ' + p.bpm + ' BPM">' +
      '<span class="em">' + p.em + '</span>' + p.name + '</button>';
  }).join('');
  var cnt = $('preset-count'); if (cnt) cnt.textContent = PRESETS.length;
  Array.prototype.forEach.call(box.children, function(btn){
    btn.addEventListener('click', function(){
      var p = PRESETS.filter(function(x){ return x.id === btn.dataset.pid; })[0];
      if (!p) return;
      applyPresetValues(p, false);
      S.chords = [];
      composeAll(Date.now() & 0xffff, { newChords: true });
      S.aiTitle = p.name + ' 자동 편곡';
      S.aiTip = '프리셋 "' + p.name + '" — ' + (PROGRESSIONS[p.prog] ? PROGRESSIONS[p.prog].label : '') + ' 진행으로 16마디를 만들었습니다.';
      S.aiSource = 'preset';
      showAiCard();
      drawAll(); refreshStats(); refreshLoopInfo();
      toast('"' + p.name + '" 프리셋 적용 · 바로 재생해 보세요', 'ok');
    });
  });
}

function slotBadge(instId){
  var d = INST[instId];
  if (!d) return '<span class="slot">—</span>';
  if (d.kind === 'synth') return '<span class="slot synth">신스</span>';
  var c = AU.instCache[instId];
  if (c && c.inst && c.inst.ready) return '<span class="slot live">샘플</span>';
  if (AU.failed[instId]) return '<span class="slot synth">신스 대체</span>';
  return '<span class="slot load">로딩</span>';
}

function renderMixer(){
  var box = $('mixer-container'); if (!box) return;
  box.innerHTML = S.tracks.map(function(t, i){
    var opts = (S.trackOpts[t.role] || [t.inst]).map(function(id){
      return '<option value="' + id + '"' + (t.inst === id ? ' selected' : '') + '>' + (INST[id] ? INST[id].name : id) + '</option>';
    }).join('');
    return '<div class="trk" data-i="' + i + '">' +
      '<div class="top"><div class="row" style="gap:5px;min-width:0;">' +
        '<span class="name">' + t.name + '</span>' + slotBadge(t.inst) +
      '</div><div class="ms">' +
        '<button class="m' + (t.mute ? ' on' : '') + '" data-mute="' + i + '" aria-label="음거">M</button>' +
        '<button class="s' + (t.solo ? ' on' : '') + '" data-solo="' + i + '" aria-label="솔로">S</button>' +
      '</div></div>' +
      '<select class="inp inst" data-inst="' + i + '" style="padding:5px 24px 5px 8px;font-size:11.5px;border-radius:8px;">' + opts + '</select>' +
      '<div class="row" style="margin-top:7px;gap:6px;">' +
        '<span class="mono faint" style="font-size:9px;">VOL</span>' +
        '<input type="range" min="0" max="100" value="' + Math.round(t.vol * 100) + '" data-vol="' + i + '" aria-label="볼륨" />' +
        '<span class="mono" style="font-size:9.5px;color:var(--tx2);width:24px;text-align:right;">' + Math.round(t.vol * 100) + '</span>' +
      '</div>' +
      '<div class="row" style="gap:6px;">' +
        '<span class="mono faint" style="font-size:9px;">PAN</span>' +
        '<input type="range" min="-100" max="100" value="' + Math.round((t.pan || 0) * 100) + '" data-pan="' + i + '" class="v" aria-label="팬" style="height:4px;" />' +
        '<span class="mono" style="font-size:9.5px;color:var(--tx2);width:24px;text-align:right;">' + (t.pan > 0 ? 'R' : t.pan < 0 ? 'L' : 'C') + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  box.querySelectorAll('[data-mute]').forEach(function(b){
    b.addEventListener('click', function(){
      var t = S.tracks[+b.dataset.mute]; t.mute = !t.mute; refreshMix(); renderMixer();
    });
  });
  box.querySelectorAll('[data-solo]').forEach(function(b){
    b.addEventListener('click', function(){
      var t = S.tracks[+b.dataset.solo]; t.solo = !t.solo; refreshMix(); renderMixer();
    });
  });
  box.querySelectorAll('[data-inst]').forEach(function(s){
    s.addEventListener('change', function(){
      var t = S.tracks[+s.dataset.inst];
      t.inst = s.value;
      if (AU.ctx) { refreshMix(); }
      if (t.role === 'drums') { S.drums = genDrums(4242); rebuildEvents(); drawDrums(); }
      if (AU.ctx) {
        prepareInst(t.inst).then(function(){ updateSamplerStatus(); renderMixer(); });
      }
      renderMixer();
    });
  });
  box.querySelectorAll('[data-vol]').forEach(function(r){
    r.addEventListener('input', function(){
      var i = +r.dataset.vol; S.tracks[i].vol = r.value / 100;
      refreshMix();
      var n = r.parentElement.querySelector('span:last-child'); if (n) n.textContent = r.value;
      saveSettings();
    });
  });
  box.querySelectorAll('[data-pan]').forEach(function(r){
    r.addEventListener('input', function(){
      var i = +r.dataset.pan; S.tracks[i].pan = r.value / 100;
      refreshMix();
      var n = r.parentElement.querySelector('span:last-child');
      if (n) n.textContent = S.tracks[i].pan > 0 ? 'R' : S.tracks[i].pan < 0 ? 'L' : 'C';
      saveSettings();
    });
  });
}

function refreshSlots(){
  var box = $('mixer-container'); if (!box || !box.children.length) return;
  Array.prototype.forEach.call(box.children, function(tr, i){
    var t = S.tracks[i]; if (!t) return;
    var holder = tr.querySelector('.top .row');
    var old = holder && holder.querySelector('.slot');
    if (old) old.outerHTML = slotBadge(t.inst);
  });
}

function bindControls(){
  /* 탭 */
  Array.prototype.forEach.call(document.querySelectorAll('.tabbtn'), function(btn){
    btn.addEventListener('click', function(){ switchTab(btn.dataset.tab); });
  });

  /* 재생 · 정지 · 반복 */
  $('btn-play').addEventListener('click', function(){ startPlayback(); });
  $('btn-stop').addEventListener('click', function(){ stopPlayback(); });
  $('btn-loop').addEventListener('click', function(e){
    S.isLoop = !S.isLoop;
    e.currentTarget.classList.toggle('on', S.isLoop);
    toast(S.isLoop ? '구간 반복 ON' : '구간 반복 OFF');
  });

  /* 테마 */
  $('btn-theme-toggle').addEventListener('click', function(){
    var next = isLight() ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('aura_theme', next); } catch (e) {}
    var mt = $('metaThemeColor'); if (mt) mt.setAttribute('content', next === 'light' ? '#eef1f8' : '#0b0f1a');
    this.textContent = next === 'light' ? '☀️' : '🌙';
    drawAll();
    saveSettings();
  });

  /* 설명서 */
  $('btn-guide').addEventListener('click', function(){ $('guide-modal').classList.remove('hidden'); });
  $('btn-guide-close').addEventListener('click', function(){ $('guide-modal').classList.add('hidden'); });
  $('guide-modal').addEventListener('click', function(e){ if (e.target === this) this.classList.add('hidden'); });

  /* BPM */
  var syncBpm = function(v){
    S.bpm = clamp(parseInt(v, 10) || 104, 60, 170);
    var a = $('bpm-slider'); if (a) a.value = S.bpm;
    var b = $('header-bpm'); if (b) b.value = S.bpm;
    var c = $('bpm-val'); if (c) c.textContent = S.bpm;
    if (AU.ctx) { /* 다음 스텝부터 적용 */ }
    updatePrompt(); refreshStats(); refreshLoopInfo(); saveSettings();
  };
  $('bpm-slider').addEventListener('input', function(e){ syncBpm(e.target.value); });
  $('header-bpm').addEventListener('change', function(e){ syncBpm(e.target.value); });

  $('bright-slider').addEventListener('input', function(e){
    S.bright = +e.target.value; $('bright-val').textContent = S.bright; updatePrompt(); saveSettings();
  });
  $('energy-slider').addEventListener('input', function(e){
    S.energy = +e.target.value; $('energy-val').textContent = S.energy; updatePrompt();
    rebuildDynamics(); drawEnergy(); saveSettings();
  });
  $('swing-slider').addEventListener('input', function(e){
    S.swing = +e.target.value; $('swing-val').textContent = S.swing; rebuildEvents(); saveSettings();
  });
  $('chk-humanize').addEventListener('change', function(e){ S.humanize = e.target.checked; rebuildEvents(); saveSettings(); });
  $('chk-fill').addEventListener('change', function(e){ S.fill = e.target.checked; S.drums = genDrums(4242); rebuildEvents(); drawDrums(); saveSettings(); });

  $('key-select').addEventListener('change', function(e){
    S.key = +e.target.value;
    S.chords = []; composeAll(Date.now() & 0xffff, { newChords: true });
    updatePrompt(); refreshStats(); drawAll(); refreshLoopInfo(); saveSettings();
  });
  $('mode-select').addEventListener('change', function(e){
    S.mode = e.target.value;
    S.chords = []; composeAll(Date.now() & 0xffff, { newChords: true });
    updatePrompt(); refreshStats(); drawAll(); saveSettings();
  });

  /* 마디 수 */
  Array.prototype.forEach.call(document.querySelectorAll('[data-bars]'), function(btn){
    btn.addEventListener('click', function(){
      S.bars = +btn.dataset.bars;
      Array.prototype.forEach.call(document.querySelectorAll('[data-bars]'), function(b2){ b2.classList.toggle('on', b2 === btn); });
      S.rollStart = 0; S.drumBar = 0;
      S.chords = [];
      composeAll(Date.now() & 0xffff, { newChords: true });
      drawAll(); refreshStats(); refreshLoopInfo(); saveSettings();
      toast(S.bars + '마디로 다시 구성했습니다');
    });
  });

  /* 에너지 프리셋 */
  Array.prototype.forEach.call(document.querySelectorAll('[data-curve]'), function(btn){
    btn.addEventListener('click', function(){
      S.energyCurve = defaultCurve(btn.dataset.curve);
      Array.prototype.forEach.call(document.querySelectorAll('[data-curve]'), function(b2){ b2.classList.toggle('on', b2 === btn); });
      rebuildDynamics(); drawEnergy(); refreshStats();
    });
  });

  /* 무드 칩 */
  Array.prototype.forEach.call(document.querySelectorAll('[data-mood]'), function(btn){
    btn.addEventListener('click', function(){
      $('mood-text').value = btn.dataset.mood;
      updatePrompt();
    });
  });

  /* 작곡 */
  $('btn-compose').addEventListener('click', function(){ composeAI(); });
  $('btn-compose-local').addEventListener('click', function(){ composeLocal($('mood-text').value); });
  $('btn-regen').addEventListener('click', function(){ composeAI(); });
  $('btn-regen-code').addEventListener('click', function(){
    S.chords = []; buildChords(Date.now() & 0xffff);
    S.notes = genMelody(Date.now() & 0xffff);
    S.bass = genBass(99); S.arp = genArp(98);
    rebuildEvents(); drawAll(); refreshStats();
    toast('코드 진행을 새로 뽑았습니다');
  });
  $('btn-copy-prompt').addEventListener('click', function(){
    var ta = $('ai-prompt');
    var text = ta.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){ toast('영문 프롬프트를 복사했습니다', 'ok'); })
        .catch(function(){ ta.select(); document.execCommand('copy'); toast('복사했습니다', 'ok'); });
    } else { ta.select(); document.execCommand('copy'); toast('복사했습니다', 'ok'); }
  });

  /* 롤 · 드럼 창 이동 */
  $('roll-prev').addEventListener('click', function(){
    S.rollStart = Math.max(0, S.rollStart - S.rollBars); drawRoll();
  });
  $('roll-next').addEventListener('click', function(){
    S.rollStart = Math.min(Math.max(0, S.bars - S.rollBars), S.rollStart + S.rollBars); drawRoll();
  });
  $('roll-zoom').addEventListener('click', function(){
    S.rollBars = S.rollBars === 2 ? 4 : 2;
    S.rollStart = Math.min(S.rollStart, Math.max(0, S.bars - S.rollBars));
    this.textContent = S.rollBars === 2 ? '4마디' : '2마디';
    drawRoll();
  });
  $('drum-prev').addEventListener('click', function(){ S.drumBar = Math.max(0, S.drumBar - 1); drawDrums(); });
  $('drum-next').addEventListener('click', function(){ S.drumBar = Math.min(S.bars - 1, S.drumBar + 1); drawDrums(); });
  $('btn-clear-bar').addEventListener('click', function(){
    var from = S.rollStart, to = S.rollStart + S.rollBars;
    S.notes = S.notes.filter(function(n){ return n.bar < from || n.bar >= to; });
    rebuildEvents(); drawRoll(); refreshStats(); toast((from + 1) + '–' + to + '마디의 멜로디를 지웠습니다');
  });

  /* 마스터 */
  var bindEq = function(id, labelId, key){
    $(id).addEventListener('input', function(e){
      var v = parseFloat(e.target.value);
      S.master[key] = v;
      var l = $(labelId); if (l) l.textContent = (v > 0 ? '+' : '') + v.toFixed(1) + 'dB';
      setMasterParam(key, v); saveSettings();
    });
  };
  bindEq('eq-low', 'val-eq-low', 'low');
  bindEq('eq-mid', 'val-eq-mid', 'mid');
  bindEq('eq-high', 'val-eq-high', 'high');
  $('fx-reverb').addEventListener('input', function(e){
    S.master.reverb = +e.target.value;
    $('val-reverb').textContent = e.target.value + '%';
    setMasterParam('reverb', +e.target.value); saveSettings();
  });
  $('fx-warmth').addEventListener('input', function(e){
    S.master.warmth = +e.target.value;
    $('val-warmth').textContent = e.target.value + '%';
    setMasterParam('warmth', +e.target.value); saveSettings();
  });
  $('fx-master').addEventListener('input', function(e){
    S.master.volume = +e.target.value;
    $('val-master').textContent = e.target.value + '%';
    setMasterParam('volume', +e.target.value); saveSettings();
  });
  $('toggle-limiter').addEventListener('change', function(e){
    S.master.limiter = e.target.checked; setMasterParam('limiter', e.target.checked); saveSettings();
  });

  /* 내보내기 */
  Array.prototype.forEach.call(document.querySelectorAll('[data-loop]'), function(btn){
    btn.addEventListener('click', function(){
      var v = +btn.dataset.loop;
      S.loop = { type: btn.dataset.kind === 'bars' ? 'bars' : 'sec', value:v };
      Array.prototype.forEach.call(document.querySelectorAll('[data-loop]'), function(b2){ b2.classList.toggle('on', b2 === btn); });
      refreshLoopInfo(); saveSettings();
    });
  });
  $('chk-normalize').addEventListener('change', function(e){ S.normalize = e.target.checked; saveSettings(); });
  var ex = $('chk-exactsec');
  if (ex) ex.addEventListener('change', function(){ S.exactSec = ex.checked; refreshLoopInfo(); saveSettings(); });
  $('btn-export-wav').addEventListener('click', exportWav);
  $('btn-export-midi').addEventListener('click', exportMidi);
  $('btn-save-proj').addEventListener('click', saveProject);
  $('btn-load-proj').addEventListener('click', loadProject);
  $('btn-download-proj').addEventListener('click', downloadProject);

  /* 허밍 */
  $('btn-mic-rec').addEventListener('click', toggleMic);
  $('btn-hum-demo').addEventListener('click', humDemo);
  $('btn-play-guide').addEventListener('click', playGuide);
  $('btn-apply-guide').addEventListener('click', applyGuide);
  $('chk-snap').addEventListener('change', function(){
    if (!this.checked) return;
    S.hum = S.hum.map(function(m){ return m == null ? null : snapToScale(m); });
    drawHum();
  });
}

function switchTab(name){
  Array.prototype.forEach.call(document.querySelectorAll('.tabbtn'), function(b){
    b.classList.toggle('on', b.dataset.tab === name);
  });
  ['compose','seq','hum','mix','export'].forEach(function(id){
    var sec = $('tab-' + id);
    if (sec) sec.classList.toggle('hidden', id !== name);
  });
  setTimeout(function(){ drawAll(); }, 40);
  if (name === 'mix' && !AU.ctx) { /* 첫 제스처에서 엔진 준비 */ }
}

/* ---------------------------------------------------------------- 9. AI 작곡 */
function showAiCard(){
  var card = $('ai-result'); if (!card) return;
  card.classList.remove('hidden');
  var t = $('ai-title'), m = $('ai-meta'), tip = $('ai-tip');
  if (t) t.textContent = S.aiTitle || 'AURA 편곡';
  if (m) m.textContent = KEY_LABEL[S.key] + ' ' + SCALE_LABEL[S.mode] + ' · ' + S.bpm + ' BPM · ' + S.bars + '마디 · ' +
    (S.aiSource === 'ai' ? 'Gemini AI' : S.aiSource === 'preset' ? '프리셋' : '내장 엔진') +
    (S.aiModel ? ' (' + S.aiModel + ')' : '');
  if (tip) tip.textContent = S.aiTip || '';
}

function parsePattern(v){
  if (Array.isArray(v)) return v.map(function(x){ return (x === 1 || x === true || x === '1') ? 1 : 0; }).slice(0, 16);
  if (typeof v === 'string') {
    var s = v.replace(/[^01]/g, '');
    if (s.length >= 16) return s.slice(0, 16).split('').map(Number);
  }
  return new Array(16).fill(0);
}

function applyAI(d){
  if (!d) return false;
  if (d.bpm) S.bpm = clamp(Math.round(d.bpm), 60, 170);
  if (d.key) {
    var flat = { 'Db':1, 'Eb':3, 'Gb':6, 'Ab':8, 'Bb':10 };
    var kraw = String(d.key).replace('♭', 'b');
    var ki = NOTE_NAMES.indexOf(kraw);
    if (ki < 0 && flat[kraw] != null) ki = flat[kraw];
    if (ki >= 0) S.key = ki;
  }
  if (d.scaleType && SCALES[d.scaleType]) S.mode = d.scaleType;
  if (d.title) S.aiTitle = d.title;
  S.aiTip = d.tip || '';

  var arr = Array.isArray(d.chords) ? d.chords : [];
  S.chords = [];
  if (arr.length) {
    for (var b = 0; b < S.bars; b++) {
      var c = arr[b % arr.length] || {};
      var ext = String(c.extension || '7').replace(/[^0-9]/g, '') || '7';
      if (['5','7','9'].indexOf(ext) < 0) ext = '7';
      var deg = c.degree != null ? clamp(Math.round(c.degree), 0, 6) : 0;
      var notes = (Array.isArray(c.midi) && c.midi.length >= 3)
        ? c.midi.map(function(n){ return clamp(Math.round(n), 36, 84); }).sort(function(a2, b2){ return a2 - b2; })
        : chordVoicing(deg, ext);
      S.chords.push({ deg:deg, ext:ext, notes:notes, name: c.name || chordName(deg, ext), root: notes[0] });
    }
    S.ext = String(arr[0] && arr[0].extension || '7').replace(/[^0-9]/g, '') || '7';
  } else {
    buildChords();
  }

  var mel = Array.isArray(d.melody) ? d.melody.filter(function(n){ return n && n.midi != null && n.step != null; }) : [];
  if (mel.length >= 4) {
    var maxBar = 0;
    mel.forEach(function(n){ maxBar = Math.max(maxBar, Math.round(n.bar || 0)); });
    var span = Math.min(S.bars, maxBar + 1);
    S.notes = [];
    mel.forEach(function(n){
      S.notes.push({
        bar: clamp(Math.round(n.bar || 0), 0, S.bars - 1),
        step: clamp(Math.round(n.step), 0, 15),
        midi: clamp(Math.round(n.midi), 60, 86),
        dur: clamp(Math.round(n.dur || 2), 1, 16),
        vel: clamp(Number(n.vel) || 0.78, 0.2, 1)
      });
    });
    for (var rep = 1; rep * span < S.bars; rep++) {
      S.notes.slice(0).forEach(function(n){
        if (n.bar >= span) return;
        var nb = n.bar + rep * span;
        if (nb < S.bars) S.notes.push({ bar:nb, step:n.step, midi:n.midi, dur:n.dur, vel:n.vel * 0.94 });
      });
    }
  } else {
    S.notes = genMelody(Date.now() & 0xffff);
  }

  var dr = d.drums || {};
  var pk = parsePattern(dr.kick), ps = parsePattern(dr.snare), ph = parsePattern(dr.hat), po = parsePattern(dr.openhat || dr.ohat);
  if (pk.some(function(v){ return v; }) || ps.some(function(v){ return v; })) {
    var kit = dr.kit && INST[dr.kit] ? dr.kit : null;
    if (kit) { S.tracks.filter(function(t){ return t.role === 'drums'; })[0].inst = kit; }
    S.drums = [];
    for (var bb = 0; bb < S.bars; bb++) {
      var e = barEnergy(bb);
      for (var s = 0; s < 16; s++) {
        if (pk[s]) S.drums.push({ bar:bb, step:s, row:'kick', vel: clamp(.7 + e * .3, .3, 1) });
        if (ps[s] && e > .35) S.drums.push({ bar:bb, step:s, row:'snare', vel: clamp(.66 + e * .3, .3, 1) });
        if (ph[s] && e > .2) S.drums.push({ bar:bb, step:s, row:'hat', vel: clamp(.3 + e * .34, .15, .95) });
        if (po[s] && e > .5) S.drums.push({ bar:bb, step:s, row:'ohat', vel: clamp(.4 + e * .25, .2, .9) });
      }
      if (S.fill && (bb + 1) % 4 === 0 && bb > 0) {
        [12, 13, 14, 15].forEach(function(s2, k){
          S.drums = S.drums.filter(function(n){ return !(n.bar === bb && n.step === s2 && n.row !== 'kick'); });
          S.drums.push({ bar:bb, step:s2, row: ['snare','tom1','tom2','tom3'][k], vel: .55 + k * .1 });
        });
      }
    }
  } else {
    S.drums = genDrums(Date.now() & 0xffff);
  }

  S.bass = genBass(5150);
  S.arp = genArp(3131);
  S.aiSource = 'ai';
  rebuildEvents();
  syncPresetUI(); renderMixer(); refreshStats(); refreshLoopInfo(); drawAll();
  /* AI가 고른 악기(드럼 킷 등)를 새로 받아 둔다 — 안 받으면 신스 폴백으로 들린다 */
  if (AU.ctx) loadNeeded(null).then(function(){ updateSamplerStatus(); }).catch(function(){});
  return true;
}

function composeAI(){
  var mood = ($('mood-text') && $('mood-text').value || '').trim();
  if (!mood) { toast('먼저 분위기를 한 줄 적어 주세요', 'warn'); return; }
  var btn = $('btn-compose'), prog = $('compose-prog');
  if (btn) btn.disabled = true;
  if (prog) { prog.style.display = 'block'; prog.firstElementChild.style.width = '18%'; }
  var t0 = performance.now();
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ try { ctrl.abort(); } catch (e) {} }, 26000);

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      action: 'aura_compose', mood: mood, genre: S.preset, bars: S.bars,
      bpm: S.bpm, key: NOTE_NAMES[S.key], scaleType: S.mode, energy: S.energy, brightness: S.bright
    }),
    signal: ctrl.signal
  })
  .then(function(r){ if (prog) prog.firstElementChild.style.width = '55%'; return r.json(); })
  .then(function(json){
    if (!json || json.ok !== true) throw new Error((json && (json.message || json.reason)) || 'AI 응답 없음');
    if (!applyAI(json.data)) throw new Error('AI 결과를 해석하지 못했습니다');
    S.aiModel = json.model || '';
    S.aiSource = 'ai';
    S.aiTitle = (json.data && json.data.title) || S.aiTitle;
    showAiCard();
    if (prog) prog.firstElementChild.style.width = '100%';
    var secs = ((performance.now() - t0) / 1000).toFixed(1);
    toast('AI 작곡 완료 · ' + (S.aiTitle || '곡') + ' (' + secs + '초)', 'ok');
    setTimeout(function(){ if (prog) prog.style.display = 'none'; }, 700);
  })
  .catch(function(e){
    var why = (e && e.name === 'AbortError') ? '서버 응답 시간 초과' : (e && e.message) || 'AI 연결 실패';
    composeLocal(mood, why);
    if (prog) prog.style.display = 'none';
  })
  .then(function(){
    clearTimeout(timer);
    if (btn) btn.disabled = false;
  });
}

/* 내장 스마트 폴백 — 서버·쿼터가 막혀도 같은 무드로 곡이 나온다 */
function composeLocal(mood, why){
  var pid = guessPreset(mood);
  var p = PRESETS.filter(function(x){ return x.id === pid; })[0] || PRESETS[0];
  applyPresetValues(p, true);
  var seed = (Date.now() ^ (Math.random() * 1e6)) & 0xffff;
  S.chords = [];
  composeAll(seed, { newChords:true });
  S.aiTitle = (mood.length > 22 ? mood.slice(0, 22) + '…' : mood) + ' · ' + p.name;
  S.aiTip = 'AI 서버를 쓰지 못해(' + why + ') 내장 엔진이 "' + p.name + '" 계열로 작곡했습니다. 코드 진행·멜로디·드럼은 다시 눌러 새로 뽑을 수 있어요.';
  S.aiSource = 'local';
  S.aiModel = '';
  showAiCard();
  var pg = $('compose-prog'); if (pg) pg.style.display = 'none';
  toast('내장 엔진으로 작곡했습니다 · ' + p.name, 'warn');
}

/* ---------------------------------------------------------------- 10. 허밍 */
var MIC = { stream:null, ctx:null, an:null, raf:null, rec:null, buf:[], t0:0, lastAt:0, level:0 };

function detectPitch(buf, sr){
  var n = buf.length, rms = 0;
  for (var i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return -1;
  var minLag = Math.floor(sr / 1000), maxLag = Math.floor(sr / 70);
  var best = -1, bestVal = 0;
  var corr = new Float32Array(maxLag + 2);
  for (var lag = minLag; lag <= maxLag; lag++) {
    var s = 0;
    for (var j = 0; j < n - lag; j += 3) s += buf[j] * buf[j + lag];
    s /= (n - lag);
    corr[lag] = s;
    if (s > bestVal) { bestVal = s; best = lag; }
  }
  if (best < 0 || bestVal < 1e-5) return -1;
  /* 옥타브 오류 방지: best 의 72% 이상인 첫 봉우리를 택한다 */
  for (var l = minLag + 1; l < maxLag; l++) {
    if (corr[l] > corr[l - 1] && corr[l] >= corr[l + 1] && corr[l] > bestVal * 0.72) { best = l; break; }
  }
  var hz = sr / best;
  return (hz > 70 && hz < 1000) ? hz : -1;
}

function startMic(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('이 브라우저는 마이크를 지원하지 않습니다. 샘플 데모를 써 보세요', 'warn'); return;
  }
  navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } })
    .then(function(stream){
      MIC.stream = stream;
      MIC.ctx = new (window.AudioContext || window.webkitAudioContext)();
      var src = MIC.ctx.createMediaStreamSource(stream);
      var an = MIC.ctx.createAnalyser(); an.fftSize = 2048;
      src.connect(an);
      MIC.an = an; MIC.buf = []; MIC.t0 = performance.now(); MIC.rec = true; MIC.lastAt = 0;
      var btn = $('btn-mic-rec');
      btn.classList.add('recpulse'); btn.textContent = '■ 녹음 중지';
      var st = $('hum-status'); if (st) st.textContent = '듣고 있어요… "라~라~" 하고 흥얼거려 보세요';
      var data = new Float32Array(1024);
      var loop = function(){
        if (!MIC.rec) return;
        MIC.raf = requestAnimationFrame(loop);
        var now = performance.now();
        if (now - MIC.lastAt < 55) return;
        MIC.lastAt = now;
        MIC.an.getFloatTimeDomainData(data);
        var hz = detectPitch(data, MIC.ctx.sampleRate);
        var rms = 0; for (var i = 0; i < data.length; i += 8) rms += data[i] * data[i];
        rms = Math.min(1, Math.sqrt(rms / (data.length / 8)) * 6);
        var m = $('hum-meter'); if (m) m.firstElementChild.style.width = Math.round(rms * 100) + '%';
        if (hz > 0) {
          var midi = Math.round(69 + 12 * Math.log2(hz / 440));
          var rd = $('hum-pitch-readout');
          if (rd) rd.textContent = midiToName(midi) + ' · ' + Math.round(hz) + 'Hz';
          MIC.buf.push({ t: (now - MIC.t0) / 1000, midi: midi });
        }
      };
      loop();
    })
    .catch(function(e){
      toast('마이크를 열 수 없습니다: ' + (e && e.message || e) + ' — 샘플 데모로 체험할 수 있어요', 'warn');
    });
}

function stopMic(){
  MIC.rec = false;
  if (MIC.raf) cancelAnimationFrame(MIC.raf);
  if (MIC.stream) MIC.stream.getTracks().forEach(function(t){ t.stop(); });
  if (MIC.ctx) { try { MIC.ctx.close(); } catch (e) {} MIC.ctx = null; }
  var btn = $('btn-mic-rec');
  if (btn) { btn.classList.remove('recpulse'); btn.textContent = '● 허밍 녹음'; }
  var m = $('hum-meter'); if (m) m.firstElementChild.style.width = '0%';
  finalizeHum();
}

function toggleMic(){ if (MIC.rec) stopMic(); else startMic(); }

function finalizeHum(){
  var snap = $('chk-snap').checked, quant = $('chk-quantize').checked;
  if (!MIC.buf.length) {
    var st = $('hum-status'); if (st) st.textContent = '감지된 음정이 없습니다. 조금 더 크게 흥얼거리거나 샘플 데모를 써 보세요.';
    toast('감지된 음정이 없습니다 — 샘플 데모를 써 보세요', 'warn');
    return;
  }
  var dur = Math.max(1.2, MIC.buf[MIC.buf.length - 1].t);
  var buckets = [];
  for (var i = 0; i < 16; i++) buckets.push([]);
  MIC.buf.forEach(function(p){
    var s = Math.floor((p.t / dur) * 16);
    if (quant) s = Math.floor(s / 2) * 2;
    if (s >= 0 && s < 16) buckets[s].push(p.midi);
  });
  S.hum = new Array(16).fill(null);
  buckets.forEach(function(arr, i2){
    if (!arr.length) return;
    var m = arr[Math.floor(arr.length / 2)];
    while (m < HUM_LOW + 2) m += 12;
    while (m > HUM_HIGH) m -= 12;
    S.hum[i2] = snap ? snapToScale(m) : m;
  });
  drawHum();
  var n = S.hum.filter(function(x){ return x != null; }).length;
  var st2 = $('hum-status');
  if (st2) st2.textContent = n + '개 음을 잡았습니다. 아래 [편곡에 반영]을 눌러 16마디 멜로디로 만드세요.';
  toast(n + '개 음정을 멜로디로 옮겼습니다', 'ok');
}

function humDemo(){
  var iv = SCALES[S.mode] || SCALES.minor;
  var base = HUM_LOW + 4;
  var pick2 = [0, 2, 4, 3, 2, 4, 6, 4];
  S.hum = new Array(16).fill(null);
  pick2.forEach(function(d, i){
    S.hum[i * 2] = base + iv[d % 7] + 12 * Math.floor(d / 7);
  });
  if ($('chk-snap').checked) S.hum = S.hum.map(function(m){ return m == null ? null : snapToScale(m); });
  drawHum();
  var rd = $('hum-pitch-readout'); if (rd) rd.textContent = midiToName(S.hum[0]) + ' (데모)';
  var st = $('hum-status'); if (st) st.textContent = '샘플 허밍을 넣었습니다. [가이드 듣기]로 확인하고 [편곡에 반영]을 눌러 보세요.';
  toast('샘플 허밍 데모를 채웠습니다', 'ok');
}

function playGuide(){
  ensureAudio()
    .then(function(){
      var trk = S.tracks.filter(function(t){ return t.role === 'melody'; })[0];
      return loadNeeded(null).then(function(){
        var out = trackOutput(trk);
        var sd = stepDur(), now = AU.ctx.currentTime + 0.1;
        var playable = S.hum.filter(function(m){ return m != null; });
        if (!playable.length) { toast('가이드가 비어 있습니다. 녹음하거나 데모를 눌러 주세요', 'warn'); return; }
        S.hum.forEach(function(m, i){
          if (m == null) return;
          fireEvent(AU.ctx, out, trk, { midi:m, dur:2, vel:0.9 }, now + i * sd * 2, sd * 2);
        });
      });
    })
    .catch(function(e){ toast('재생 실패: ' + (e && e.message || e), 'err'); });
}

function applyGuide(){
  if (!S.hum.some(function(m){ return m != null; })) { toast('가이드가 비어 있습니다', 'warn'); return; }
  var seed = (Date.now() & 0xffff);
  S.notes = genMelody(seed, true);
  if (!S.notes.length) S.notes = genMelody(seed, false);
  /* 첫 두 마디를 가이드 멜로디로 고정 — 흥얼거린 선율이 곡의 훅이 된다 */
  var firstBar = [];
  S.hum.forEach(function(m, i){ if (m != null) firstBar.push({ bar:0, step:i, midi:m, dur:2, vel:0.85 }); });
  var second = firstBar.map(function(n){ return { bar:1, step:n.step, midi:n.midi + (chance(.4) ? 2 : 0), dur:n.dur, vel:n.vel * .92 }; });
  S.notes = firstBar.concat(second, S.notes.filter(function(n){ return n.bar > 1; }));
  S.bass = genBass(5150); S.arp = genArp(3131);
  rebuildEvents(); drawAll(); refreshStats();
  toast('허밍 가이드를 16마디 편곡에 반영했습니다', 'ok');
}

/* ---------------------------------------------------------------- 11. 설정 · 부팅 */
function saveSettings(){
  try {
    localStorage.setItem('aura_settings', JSON.stringify({
      theme: isLight() ? 'light' : 'dark',
      bpm:S.bpm, key:S.key, mode:S.mode, preset:S.preset, prog:S.prog, ext:S.ext,
      bright:S.bright, energy:S.energy, swing:S.swing, humanize:S.humanize, fill:S.fill,
      master:S.master, loop:S.loop, exactSec:S.exactSec,
      tracks:S.tracks.map(function(t){ return { id:t.id, inst:t.inst, vol:t.vol, pan:t.pan, mute:t.mute, solo:t.solo }; })
    }));
  } catch (e) {}
}

function loadSettings(){
  var raw = null;
  try { raw = localStorage.getItem('aura_settings'); } catch (e) {}
  if (!raw) return;
  try {
    var s = JSON.parse(raw);
    if (s.bpm) S.bpm = clamp(s.bpm, 60, 170);
    if (s.key != null) S.key = s.key;
    if (s.mode) S.mode = s.mode;
    if (s.preset) S.preset = s.preset;
    if (s.prog) S.prog = s.prog;
    if (s.ext) S.ext = s.ext;
    if (s.bright != null) S.bright = s.bright;
    if (s.energy != null) S.energy = s.energy;
    if (s.swing != null) S.swing = s.swing;
    if (s.humanize != null) S.humanize = !!s.humanize;
    if (s.fill != null) S.fill = !!s.fill;
    if (s.master) S.master = Object.assign(S.master, s.master);
    if (s.loop) S.loop = s.loop;
    if (s.exactSec != null) S.exactSec = !!s.exactSec;
    if (s.tracks) s.tracks.forEach(function(t){
      var cur = S.tracks.filter(function(x){ return x.id === t.id; })[0];
      if (cur) { cur.inst = t.inst || cur.inst; cur.vol = t.vol != null ? t.vol : cur.vol; cur.pan = t.pan != null ? t.pan : cur.pan; cur.mute = !!t.mute; cur.solo = !!t.solo; }
    });
  } catch (e) {}
}

function applyStateToUI(){
  $('bpm-slider').value = S.bpm; $('header-bpm').value = S.bpm; $('bpm-val').textContent = S.bpm;
  $('bright-slider').value = S.bright; $('bright-val').textContent = S.bright;
  $('energy-slider').value = S.energy; $('energy-val').textContent = S.energy;
  $('swing-slider').value = S.swing; $('swing-val').textContent = S.swing;
  $('chk-humanize').checked = !!S.humanize;
  $('chk-fill').checked = !!S.fill;
  $('chk-normalize').checked = S.normalize !== false;
  if ($('chk-exactsec')) $('chk-exactsec').checked = S.exactSec !== false;
  $('key-select').value = String(S.key);
  $('mode-select').value = S.mode;
  Array.prototype.forEach.call(document.querySelectorAll('[data-bars]'), function(b){
    b.classList.toggle('on', +b.dataset.bars === S.bars);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-loop]'), function(b){
    var v = +b.dataset.loop;
    var kind = b.dataset.kind === 'bars' ? 'bars' : 'sec';
    b.classList.toggle('on', S.loop.type === kind && S.loop.value === v);
  });
  $('eq-low').value = S.master.low; $('val-eq-low').textContent = (S.master.low > 0 ? '+' : '') + (+S.master.low).toFixed(1) + 'dB';
  $('eq-mid').value = S.master.mid; $('val-eq-mid').textContent = (S.master.mid > 0 ? '+' : '') + (+S.master.mid).toFixed(1) + 'dB';
  $('eq-high').value = S.master.high; $('val-eq-high').textContent = (S.master.high > 0 ? '+' : '') + (+S.master.high).toFixed(1) + 'dB';
  $('fx-reverb').value = S.master.reverb; $('val-reverb').textContent = S.master.reverb + '%';
  $('fx-warmth').value = S.master.warmth; $('val-warmth').textContent = S.master.warmth + '%';
  $('fx-master').value = S.master.volume; $('val-master').textContent = S.master.volume + '%';
  $('toggle-limiter').checked = !!S.master.limiter;
  $('btn-loop').classList.toggle('on', S.isLoop);
  $('btn-theme-toggle').textContent = isLight() ? '☀️' : '🌙';
  var mt = $('metaThemeColor'); if (mt) mt.setAttribute('content', isLight() ? '#eef1f8' : '#0b0f1a');
  $('roll-zoom').textContent = S.rollBars === 2 ? '4마디' : '2마디';
}

function warmUp(){
  ensureAudio()
    .then(function(){ return loadNeeded(null); })
    .then(function(){ updateSamplerStatus(); })
    .catch(function(){});
}

var installEvt = null;
function boot(){
  loadSettings();
  renderPresets();
  renderMixer();
  bindControls();
  bindCanvasInput();
  if (!S.energyCurve || S.energyCurve.length !== 16) {
    var p = PRESETS.filter(function(x){ return x.id === S.preset; })[0] || PRESETS[0];
    S.energyCurve = presetEnergyCurve(p);
  }
  if (typeof S.isLoop === 'undefined') S.isLoop = true;

  composeAll(20261127, { newChords:true });
  applyStateToUI();
  syncPresetUI();
  refreshStats();
  refreshLoopInfo();
  updateSamplerStatus();
  drawAll();

  /* 리사이즈 */
  var rt = null;
  window.addEventListener('resize', function(){
    clearTimeout(rt);
    rt = setTimeout(function(){
      drawAll();
      var sw = $('spec-wrap'); if (sw) sw.style.display = window.innerWidth >= 780 ? 'block' : 'none';
    }, 160);
  });
  var sw = $('spec-wrap'); if (sw) sw.style.display = window.innerWidth >= 780 ? 'block' : 'none';

  /* 설치 */
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); installEvt = e;
    var b = $('btn-install'); if (b) b.style.display = 'inline-flex';
  });
  $('btn-install').addEventListener('click', function(){
    var b = $('btn-install');
    if (installEvt) { installEvt.prompt(); installEvt = null; b.style.display = 'none'; }
    else toast('브라우저 메뉴 → "홈 화면에 추가"로 설치할 수 있어요');
  });

  /* 서비스워커 */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    });
  }

  /* PIN 해제 직후 악기 미리 받기 */
  window.addEventListener('aura:unlocked', function(){ setTimeout(warmUp, 250); });
  if (!document.documentElement.classList.contains('pin-locked')) setTimeout(warmUp, 600);
  document.addEventListener('pointerdown', function(){ ensureAudio().catch(function(){}); }, { once:true });

  /* 화면 복귀 시 다시 그리기 */
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) drawAll(); });

  /* 매니페스트 바로가기(?tab=hum 등) */
  try {
    var q = new URLSearchParams(location.search), tb = q.get('tab');
    if (tb && ['compose','seq','hum','mix','export'].indexOf(tb) >= 0) switchTab(tb);
  } catch (e) {}
}

/* 테스트 훅 */
window.Aura = {
  S: S, AU: AU,
  play: function(){ return startPlayback(); },
  stop: stopPlayback,
  composeAI: composeAI,
  composeLocal: composeLocal,
  applyAI: applyAI,
  composeNow: function(){ S.chords = []; composeAll(Date.now() & 0xffff, { newChords:true }); drawAll(); refreshStats(); },
  applyGuide: applyGuide,
  humDemo: humDemo,
  planLoop: planLoop,
  renderLoop: function(plan){ return renderLoop(plan || planLoop()); },
  exportWav: exportWav,
  exportMidi: exportMidi,
  switchTab: switchTab,
  drawAll: drawAll,
  debug: {
    events: function(){ return S.eventCount; },
    notes: function(){ return S.notes.length; },
    drums: function(){ return S.drums.length; },
    hum: function(){ return S.hum.filter(function(x){ return x != null; }).length; },
    presets: function(){
      return PRESETS.map(function(p){
        return { id:p.id, name:p.name, bpm:p.bpm, key:p.key, mode:p.mode, ext:p.ext, prog:p.prog,
          swing:p.swing != null ? p.swing : S.swing,
          insts:{ melody:p.mel, chords:p.chd, bass:p.bas, drums:p.drm, arp:p.arp }, pat:p.pat || null, arpPat:p.arpPat || null };
      });
    },
    state: function(){
      return {
        bpm:S.bpm, key:S.key, mode:S.mode, bars:S.bars, preset:S.preset,
        chords:S.chords.length, notes:S.notes.length, drums:S.drums.length,
        events:S.eventCount, playing:AU.playing, step:AU.step,
        insts:S.tracks.map(function(t){ return t.inst; }),
        loaded:Object.keys(AU.instCache).filter(function(k){ var c = AU.instCache[k]; return c && c.inst && c.inst.ready; }),
        buffers:Object.keys(AU.buffers).length, loadTotal:AU.loadTotal, loadDone:AU.loadDone
      };
    },
    renderPeak: function(bars){
      var plan = { bars: bars || 2, bpm: S.bpm, exact:true };
      return renderLoop(plan).then(function(buf){
        var peak = 0, sum = 0, n = 0;
        for (var ch = 0; ch < buf.numberOfChannels; ch++) {
          var d = buf.getChannelData(ch);
          for (var i = 0; i < d.length; i += 7) { var a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; n++; }
        }
        return { peak: peak, rms: Math.sqrt(sum / Math.max(1, n)), seconds: buf.duration };
      });
    }
  }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
