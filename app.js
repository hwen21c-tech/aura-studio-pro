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
/* 스케일 9종 — 프리셋·무드·색감 분석이 알맞은 스케일을 자동으로 고른다 */
var SCALES = {
  major:          [0,2,4,5,7,9,11],
  minor:          [0,2,3,5,7,8,10],
  dorian:         [0,2,3,5,7,9,10],
  mixolydian:     [0,2,4,5,7,9,10],
  lydian:         [0,2,4,6,7,9,11],
  phrygian:       [0,1,3,5,7,8,10],
  harmonic_min:   [0,2,3,5,7,8,11],
  pentatonic_maj: [0,2,4,7,9],
  pentatonic_min: [0,3,5,7,10]
};
var SCALE_LABEL = {
  major:'장조', minor:'단조', dorian:'도리안', mixolydian:'믹솔리디안', lydian:'리디안',
  phrygian:'프리지안', harmonic_min:'하모닉 마이너', pentatonic_maj:'펜타토닉 장조', pentatonic_min:'펜타토닉 단조'
};
var SCALE_HINT = {
  major:'밝은 팝·브리핑', minor:'감성·시티팝', dorian:'재즈 네오소울', mixolydian:'시티팝·펑키',
  lydian:'몽환·청량', phrygian:'다크·서스펜스', harmonic_min:'긴장·오케스트라',
  pentatonic_maj:'밝은 동양·힐링', pentatonic_min:'힙합·블루스'
};
/* 화음(코드)은 7음 부모 스케일로 짓는다 — 5음 펜타토닉에서도 3화음이 무너지지 않게 */
var HARMONY_SCALE = { pentatonic_maj:'major', pentatonic_min:'minor' };
function scaleIv(mode){ return SCALES[mode] || SCALES.minor; }
function harmonyIv(){ return SCALES[HARMONY_SCALE[S.mode] || S.mode] || SCALES.minor; }
/* 도수 → 스케일 안의 반음 간격 (스케일 길이에 맞춰 옥타브를 넘긴다) */
function ivAt(iv, deg){
  var n = iv.length || 7;
  var oct = Math.floor(deg / n), i = ((deg % n) + n) % n;
  return iv[i] + 12 * oct;
}

/* 박자 — 왈츠(3/4)는 한 마디 12칸, 나머지는 16칸(4/4). 모든 생성·재생·내보내기가 이 값을 쓴다 */
function beatsPerBar(){ return S && S.meter === 3 ? 3 : 4; }
function barLen(){ return beatsPerBar() * 4; }
function barSecAt(bpm){ return beatsPerBar() * 60 / (bpm || (S && S.bpm) || 100); }

var SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/';
var DRUM_BASE   = 'https://tonejs.github.io/audio/drum-samples/';
var INST_BASE   = 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments/samples/';

/* 악기 정의 — kind:'sample' | 'synth' | 'drums' */
var INST = {
  piano:   { name:'그랜드 피아노', kind:'sample', base:SAMPLE_BASE, notes:['C2','Ds3','Fs3','A4','C5','Ds6'], atk:0.002, rel:0.85, gain:0.92, tone:9000, tag:'샘플' },
  ep:      { name:'일렉트릭 피아노', kind:'synth', synth:'fm', atk:0.004, dec:0.9, sus:0.22, rel:0.55, gain:0.55, tone:4200, bright:1.6, tag:'신스' },
  flute:   { name:'플루트', kind:'sample', base:INST_BASE+'flute/', notes:['C4','E5'], atk:0.06, rel:0.35, gain:0.75, tone:7000, tag:'샘플' },
  lead:    { name:'리드 신스', kind:'synth', synth:'saw', atk:0.02, dec:0.25, sus:0.45, rel:0.3, gain:0.42, tone:5200, bright:1.2, tag:'신스' },
  /* 리드 음색 6종 — 피아노(샘플) · 플럭 · 브라스 · 리드 신스 · 8비트 칩튠 · 감성 벨 */
  pluck:   { name:'플럭 신스', kind:'synth', synth:'pluck', atk:0.002, dec:0.26, sus:0.03, rel:0.22, gain:0.50, tone:8200, bright:1.7, lead:true, tag:'신스' },
  brass:   { name:'브라스 섹션', kind:'synth', synth:'brass', atk:0.05, dec:0.26, sus:0.70, rel:0.26, gain:0.40, tone:5600, bright:1.05, peak:1100, peakQ:2.1, peakGain:7, lead:true, tag:'신스' },
  chip:    { name:'8비트 칩튠', kind:'synth', synth:'chip', atk:0.001, dec:0.09, sus:0.12, rel:0.06, gain:0.30, tone:13000, bright:1.9, lead:true, tag:'신스' },
  bell:    { name:'감성 벨', kind:'synth', synth:'bell', atk:0.002, dec:1.45, sus:0.05, rel:1.05, gain:0.34, tone:11000, bright:1.4, lead:true, tag:'신스' },
  strings: { name:'첼로 스트링', kind:'sample', base:INST_BASE+'cello/', notes:['C2','G3','D4','A4'], atk:0.16, rel:0.85, gain:0.62, tone:5200, tag:'샘플' },
  pad:     { name:'따뜻한 패드', kind:'synth', synth:'pad', atk:0.5, dec:0.8, sus:0.75, rel:1.6, gain:0.3, tone:3000, bright:0.9, tag:'신스' },
  organ:   { name:'오르간', kind:'sample', base:INST_BASE+'organ/', notes:['C2','Ds3','Fs4'], atk:0.012, rel:0.28, gain:0.6, tone:6500, tag:'샘플' },
  bassEl:  { name:'일렉트릭 베이스', kind:'sample', base:INST_BASE+'bass-electric/', notes:['E1','G2'], atk:0.004, rel:0.28, gain:0.95, tone:1100, tag:'샘플' },
  bassSyn: { name:'서브 신스 베이스', kind:'synth', synth:'sub', atk:0.006, dec:0.3, sus:0.55, rel:0.18, gain:0.62, tone:700, bright:0.6, tag:'신스' },
  guitar:  { name:'어쿠스틱 기타', kind:'sample', base:INST_BASE+'guitar-acoustic/', notes:['C3','E4'], atk:0.004, rel:0.45, gain:0.7, tone:7500, tag:'샘플' },
  harp:    { name:'하프', kind:'sample', base:INST_BASE+'harp/', notes:['C3','D4'], atk:0.003, rel:1.0, gain:0.66, tone:8000, tag:'샘플' },
  xylo:    { name:'마림바/실로폰', kind:'sample', base:INST_BASE+'xylophone/', notes:['C5','G6'], atk:0.002, rel:0.3, gain:0.5, tone:9000, tag:'샘플' },
  /* 보컬 코러스 패드 — 샘플 없이 포먼트 신스로 (가볍게) */
  'vox-ooh':   { name:'보컬 Ooh 패드', kind:'synth', synth:'ooh',   atk:0.30, dec:0.7, sus:0.82, rel:1.2, gain:0.34, tone:2600, bright:0.9, formant:430,  tag:'신스' },
  'vox-aah':   { name:'보컬 Aah 합창', kind:'synth', synth:'aah',   atk:0.22, dec:0.6, sus:0.80, rel:1.1, gain:0.30, tone:4200, bright:1.1, formant:760,  tag:'신스' },
  'vox-chops': { name:'보컬 찹 리듬', kind:'synth', synth:'chops', atk:0.005, dec:0.16, sus:0.18, rel:0.14, gain:0.30, tone:5200, bright:1.2, formant:1100, tag:'신스' },
  /* 드럼 킷 */
  'kit-acoustic': { name:'어쿠스틱 킷', kind:'drums', folder:'acoustic-kit', gain:1.0, tag:'샘플' },
  'kit-cr78':     { name:'시티팝 (CR-78)', kind:'drums', folder:'CR78', gain:1.0, tag:'샘플' },
  'kit-kpr77':    { name:'로파이 (KPR-77)', kind:'drums', folder:'KPR77', gain:1.0, tag:'샘플' },
  'kit-linn':     { name:'80s (LINN)', kind:'drums', folder:'LINN', gain:1.0, tag:'샘플' },
  'kit-r8':       { name:'힙합 (R-8)', kind:'drums', folder:'R8', gain:1.0, tag:'샘플' },
  'kit-stark':    { name:'소프트 (Stark)', kind:'drums', folder:'Stark', gain:1.0, tag:'샘플' },
  /* 드럼 킷 4종 — 샘플 없이 킷별 신스 파라미터(피치·엔벨로프·필터·클릭)로 만든다 */
  'kit-808':      { name:'808 힙합', kind:'drumkit', kit:'hiphop808', gain:0.95, tone:12000, tag:'신스' },
  'kit-lofi':     { name:'로파이 빈티지', kind:'drumkit', kit:'lofi', gain:0.92, tone:5200, tag:'신스' },
  'kit-rock':     { name:'어쿠스틱 록', kind:'drumkit', kit:'rock', gain:1.0, tone:11000, tag:'신스' },
  'kit-electro':  { name:'일렉트로', kind:'drumkit', kit:'electro', gain:0.98, tone:13000, tag:'신스' }
};

var DRUM_FILES = { kick:'kick.mp3', snare:'snare.mp3', hat:'hihat.mp3', tom1:'tom1.mp3', tom2:'tom2.mp3', tom3:'tom3.mp3' };
var DRUM_ROWS = [
  { id:'kick',  label:'킥',   note:'C1'  },
  { id:'snare', label:'스네어', note:'D1'  },
  { id:'hat',   label:'하이햇', note:'F#1' },
  { id:'ohat',  label:'오픈햇', note:'G#1' }
];

/* ---------------------------------------------------------------- 리듬 패턴 8종
   드럼 16칸(A/B)만 바뀌는 게 아니라 베이스 리듬·코드 컴핑·아르페지오·스윙·박자까지 함께 바뀐다.
   bass: [칸, root|fifth|oct] · comp: [칸, 길이(칸)] · arpPat: 아르페지오 칸 */
var RHYTHMS = [
  { id:'pop', em:'🎈', name:'정박 팝', sub:'1·3 킥 / 2·4 스네어', meter:4, swing:0, bassDur:2,
    pat:{
      A:{ kick:'1000000010000000', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000000000000' },
      B:{ kick:'1000000010010000', snare:'0000100000001000', hat:'1010101110101110', ohat:'0000000000001000' }
    },
    bass:[[0,'root'],[6,'fifth'],[8,'root'],[12,'oct']],
    comp:[[0,16]], arpPat:[0,4,8,12] },

  { id:'boombap', em:'🥊', name:'힙합 붐뱁', sub:'스윙 8분 · 킥 엇박', meter:4, swing:22, bassDur:2,
    pat:{
      A:{ kick:'1000000000100100', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000000000010' },
      B:{ kick:'1000001000100100', snare:'0000100000001010', hat:'1010101110101011', ohat:'0000000000000100' }
    },
    bass:[[0,'root'],[7,'root'],[10,'fifth'],[14,'oct']],
    comp:[[0,7],[10,6]], arpPat:[0,3,6,10,12] },

  { id:'trap16', em:'🔥', name:'트랩 16비트', sub:'808 킥 · 롤 하이햇', meter:4, swing:0, bassDur:3, rollHat:true,
    pat:{
      A:{ kick:'1000001000100000', snare:'0000000010000000', hat:'1011101110111011', ohat:'0000000000000000' },
      B:{ kick:'1000001000100010', snare:'0000000010000000', hat:'1110111011101111', ohat:'0000000000000100' }
    },
    bass:[[0,'root'],[6,'root'],[10,'oct'],[14,'fifth']],
    comp:[[0,14]], arpPat:[0,2,4,6,8,10,12,14] },

  { id:'fourfloor', em:'🏠', name:'4온더플로어', sub:'하우스 · 오프비트 햇', meter:4, swing:0, bassDur:2,
    pat:{
      A:{ kick:'1000100010001000', snare:'0000100000001000', hat:'0000000000000000', ohat:'0010001000100010' },
      B:{ kick:'1000100010001000', snare:'0000100000001000', hat:'1010101010101010', ohat:'0010001000100010' }
    },
    bass:[[0,'root'],[2,'oct'],[4,'root'],[6,'oct'],[8,'root'],[10,'oct'],[12,'root'],[14,'oct']],
    comp:[[2,1],[6,1],[10,1],[14,1]], arpPat:[2,6,10,14] },

  { id:'citypop', em:'🌃', name:'시티팝 스윙', sub:'게이트 드럼 · 스윙', meter:4, swing:26, bassDur:2,
    pat:{
      A:{ kick:'1000000010000010', snare:'0000100000001000', hat:'1010101010101010', ohat:'0000000010000000' },
      B:{ kick:'1000000010010010', snare:'0000100000001010', hat:'1011101110111011', ohat:'0000000010001000' }
    },
    bass:[[0,'root'],[3,'oct'],[6,'fifth'],[8,'root'],[11,'oct'],[14,'fifth']],
    comp:[[0,8],[8,8]], arpPat:[0,3,6,10,12,14] },

  { id:'bossa', em:'☕', name:'보사노바', sub:'림샷 · 가벼운 라틴', meter:4, swing:14, bassDur:2,
    pat:{
      A:{ kick:'1000000010000000', snare:'0001000100010001', hat:'1010101010101010', ohat:'0000000000000000' },
      B:{ kick:'1000000010000010', snare:'0001000100010001', hat:'1010101010101110', ohat:'0000000000001000' }
    },
    bass:[[0,'root'],[3,'fifth'],[6,'oct'],[10,'root'],[13,'fifth']],
    comp:[[0,3],[4,3],[8,3],[12,4]], arpPat:[0,3,6,10,12] },

  { id:'waltz', em:'💃', name:'왈츠 3/4', sub:'3박자 · 1박 킥', meter:3, swing:0, bassDur:3,
    pat:{
      A:{ kick:'100000000000', snare:'000010001000', hat:'101010101010', ohat:'000000000000' },
      B:{ kick:'100000000000', snare:'000010001000', hat:'101010101011', ohat:'000000001000' }
    },
    bass:[[0,'root'],[4,'fifth'],[8,'oct']],
    comp:[[0,4],[4,8]], arpPat:[0,3,6,9] },

  { id:'tension', em:'🚨', name:'긴장감 스타카토', sub:'타이트한 16분 · 짧은 스탭', meter:4, swing:0, bassDur:1, rollHat:true,
    pat:{
      A:{ kick:'1000000010000000', snare:'0000010000000100', hat:'1111111111111111', ohat:'0000000000000000' },
      B:{ kick:'1000000010000010', snare:'0000010000000100', hat:'1111111111111111', ohat:'0000000000000100' }
    },
    bass:[[0,'root'],[3,'root'],[6,'root'],[10,'root'],[12,'fifth']],
    comp:[[0,1],[2,1],[4,1],[6,1],[8,1],[10,1],[12,1],[14,1]], arpPat:[0,2,4,6,8,10,12,14] }
];
function rhythmOf(id){ for (var i = 0; i < RHYTHMS.length; i++) if (RHYTHMS[i].id === id) return RHYTHMS[i]; return null; }
function rhythmNow(){ return rhythmOf(S.rhythm); }

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

/* 프리셋 → 스케일 자동 매핑 (장르에 자연스러운 9종 스케일) */
var PRESET_SCALE = {
  citypop:'minor', lofi:'minor', cinematic:'harmonic_min', synthwave:'minor', acoustic:'major',
  hiphop:'pentatonic_min', news:'major', breaking:'phrygian', bossa:'major', kpop:'lydian',
  ballad:'minor', funk:'mixolydian', chiptune:'major', ambient:'pentatonic_maj',
  techhouse:'minor', neosoul:'dorian'
};
function presetScale(p){ return (p && (p.scale || PRESET_SCALE[p.id])) || (p && p.mode) || 'minor'; }

/* 프리셋 ↔ 리듬 패턴 자동 연동 — 프리셋을 고르면 어울리는 리듬 칩이 함께 선택된다 */
var PRESET_RHYTHM = {
  citypop:'citypop', lofi:'boombap', cinematic:'pop', synthwave:'fourfloor', acoustic:'pop', hiphop:'trap16',
  news:'pop', breaking:'tension', bossa:'bossa', kpop:'pop', ballad:'pop', funk:'boombap',
  chiptune:'pop', ambient:'pop', techhouse:'fourfloor', neosoul:'boombap'
};
function presetRhythm(p){ return (p && p.rhythm) || PRESET_RHYTHM[p && p.id] || 'pop'; }

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
  neosoul:   { label:'네오소울 진행',  minor:[0,3,6,2],     major:[1,4,0,5] },
  /* 분위기 1클릭 변주용 */
  tension:   { label:'긴장/미스터리 진행', minor:[0,5,1,4],  major:[0,5,1,4] },
  twofive:   { label:'시티팝 투파이브원', minor:[1,4,0,5],   major:[1,4,0,5] },
  epic:      { label:'웅장한 오케스트라 진행', minor:[0,5,2,3], major:[0,5,3,4] }
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
  chords: [], notes: [], bass: [], arp: [], drums: [], vocal: [],
  events: [], eventsLen: 0,
  hum: new Array(16).fill(null),
  humMidi: [],
  aiTitle: '', aiTip: '', aiModel: '', aiSource: '',
  rollBars: 2, rollStart: 0, drumBar: 0,
  loop: { type:'sec', value: 15 },
  isPlaying: false, playing: false, step: 0, isLoop: true, normalize: true, exactSec: true,
  tracks: [
    { id:'melody', role:'melody', name:'멜로디', inst:'piano',  vol:0.85, pan:-0.08, mute:false, solo:false, locked:false },
    { id:'chords', role:'chords', name:'코드',   inst:'strings',vol:0.62, pan: 0.12, mute:false, solo:false, locked:false },
    { id:'bass',   role:'bass',   name:'베이스', inst:'bassEl', vol:0.80, pan: 0,    mute:false, solo:false, locked:false },
    { id:'drums',  role:'drums',  name:'드럼',   inst:'kit-cr78',vol:0.85, pan: 0,   mute:false, solo:false, locked:false },
    { id:'arp',    role:'arp',    name:'아르페지오', inst:'guitar', vol:0.42, pan: -0.22, mute:false, solo:false, locked:false },
    { id:'vocal',  role:'vocal',  name:'보컬',   inst:'vox-ooh', vol:0.34, pan: 0.04, mute:false, solo:false, locked:false }
  ],
  trackOpts: {
    melody: ['piano','pluck','brass','lead','chip','bell','ep','flute'],
    chords: ['strings','pad','organ','ep'],
    bass:   ['bassEl','bassSyn'],
    drums:  ['kit-cr78','kit-acoustic','kit-kpr77','kit-linn','kit-r8','kit-stark','kit-808','kit-lofi','kit-rock','kit-electro'],
    arp:    ['guitar','harp','xylo','pluck','bell','piano'],
    vocal:  ['vox-ooh','vox-aah','vox-chops']
  },

  /* v10 — 작곡 다양성: 리듬 패턴 8종 · 드럼 킷 4종 · 리드 음색 6종 */
  rhythm: 'pop', rhythmAuto: true, meter: 4,
  master: { low:1, mid:0, high:2, reverb:28, warmth:18, volume:80, limiter:true, tone:16000 },

  /* v1~v8 — 감정 패드 · 코드 롤링 · 사이드체인 · A/B */
  xy: { x: 0.68, y: 0.62 },
  roll: 30, pump: true,
  snap: { A: null, B: null }, snapActive: 'A',

  /* v8 — 영상 싱크 · 내레이션 덕킹 · 연주 · 환경음 · 공유 */
  videoDur: 30, hasVideo: false,
  duck: true, duckDepth: 60,
  script: [
    '네온 불빛 번지는 밤의 해안 도로 위로',
    '젖어든 아스팔트 위에 흐르는 우리만의 멜로디',
    '창문을 열면 불어오는 시원한 밤바람과 파도 소리',
    '멈추지 않을 이 밤의 리듬 속으로 함께 달려가'
  ],
  amb: { rain:0, fire:0, cafe:0, ocean:0 },
  overdub: false, overdubCursor: 0, kbOct: 4,
  /* v6 — 프로 연출 */
  riser: true, breakdown: true,
  /* v9 — 쇼츠 기승전결 편곡 · 음량 기준 */
  story: { on:false, len:15 },
  normMode: 'peak'
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
  var iv = scaleIv(S.mode);
  var out = [];
  for (var o = 0; o < 8; o++) for (var i = 0; i < iv.length; i++) out.push(36 + S.key + iv[i] + o * 12);
  return out;
}
function scaleInterval(deg){ return ivAt(scaleIv(S.mode), deg); }

/* 도수 → 절대 음 (C3 = 48 기준) — 화음은 부모 스케일 기준 */
function degreeMidi(deg){ return 48 + S.key + ivAt(harmonyIv(), deg); }

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
  var iv = harmonyIv();
  var rootPc = ((S.key + ivAt(iv, deg)) % 12 + 12) % 12;
  var third = ((ivAt(iv, deg + 2) - ivAt(iv, deg)) % 12 + 12) % 12;
  var fifth = ((ivAt(iv, deg + 4) - ivAt(iv, deg)) % 12 + 12) % 12;
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
  loadTotal: 0, loadDone: 0, failed: {}, ready: false,
  /* v8 — 반주 버스(덕킹 대상) · 내레이션 · 녹화 출력 */
  musicBus: null, narrSrc: null, narrGain: null, recDest: null, pumpBus: null
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
  var tone = ctx.createBiquadFilter();
  tone.type = 'lowpass'; tone.frequency.value = m.tone || 16000; tone.Q.value = 0.6;
  var dry = ctx.createGain(); dry.gain.value = 1;
  var wet = ctx.createGain(); wet.gain.value = m.reverb / 100 * 0.9;
  var conv = ctx.createConvolver(); conv.buffer = makeIR(ctx, 2.6, 0.42);
  var comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
  var lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -1.2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.09;
  var out = ctx.createGain(); out.gain.value = m.volume / 100;
  inp.connect(low); low.connect(mid); mid.connect(hi); hi.connect(warm);
  warm.connect(tone); tone.connect(dry); dry.connect(comp);
  tone.connect(conv); conv.connect(wet); wet.connect(comp);
  comp.connect(lim); lim.connect(out);
  return { in: inp, out: out, low: low, mid: mid, high: hi, warm: warm, tone: tone, wet: wet, lim: lim, master: out };
}

function setMasterParam(key, val){
  if (!AU.master) return;
  var m = S.master;
  if (key === 'low') AU.master.low.gain.setTargetAtTime(val, AU.ctx.currentTime, 0.03);
  if (key === 'mid') AU.master.mid.gain.setTargetAtTime(val, AU.ctx.currentTime, 0.03);
  if (key === 'high') AU.master.high.gain.setTargetAtTime(val, AU.ctx.currentTime, 0.03);
  if (key === 'reverb') AU.master.wet.gain.setTargetAtTime(val / 100 * 0.9, AU.ctx.currentTime, 0.03);
  if (key === 'warmth') AU.master.warm.curve = makeCurve(val);
  if (key === 'tone') AU.master.tone.frequency.setTargetAtTime(val, AU.ctx.currentTime, 0.03);
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
  /* 쇼츠 기승전결 게인 — 마지터 뒤에 두어 출력·계기·녹화가 모두 같은 소리를 받는다 */
  AU.dynGain = ctx.createGain();
  AU.dynGain.gain.value = 1;
  AU.master.out.connect(AU.dynGain);
  AU.dynGain.connect(ctx.destination);
  AU.analyser = ctx.createAnalyser(); AU.analyser.fftSize = 256;
  AU.dynGain.connect(AU.analyser);

  /* 반주(트랙·환경음)는 이 버스를 거쳐 마스터로 — 내레이션 덕킹은 이 버스만 줄인다 */
  AU.musicBus = ctx.createGain();
  AU.musicBus.gain.value = 1;
  AU.musicBus.connect(AU.master.in);
  /* 사이드체인 펌핑 — 킥이 칠 때 베이스·코드·보컬만 잠겼다 풀린다 */
  AU.pumpBus = ctx.createGain();
  AU.pumpBus.gain.value = 1;
  AU.pumpBus.connect(AU.musicBus);

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
  var dest = (t.role === 'bass' || t.role === 'chords' || t.role === 'vocal') && AU.pumpBus ? AU.pumpBus : (AU.musicBus || AU.master.in);
  filt.connect(dest);
  AU.trackNodes[t.id] = { gain: gain, pan: pan, filt: filt };
}
function instTone(id){ var d = INST[id]; return d && d.tone ? d.tone : 12000; }

/* 마지터 탭 — 출력·녹화·측정이 같은 지점을 쓴다 */
function masterTap(){ return AU.dynGain || (AU.master && AU.master.out); }

/* 재생에도 저장 파일과 같은 기승전결을 입힌다 (한 번 반복 = 한 곡 이야기) */
function scheduleStoryGain(when){
  if (!AU.dynGain || !AU.ctx) return;
  var t = Math.max(0.001, when || AU.ctx.currentTime);
  try { AU.dynGain.gain.cancelScheduledValues(t); } catch (e) {}
  if (!(S.story && S.story.on)){
    try { AU.dynGain.gain.setValueAtTime(1, t); } catch (e) {}
    return;
  }
  try {
    var plan = planLoop();
    AU.dynGain.gain.setValueCurveAtTime(storyCurveForWebAudio(plan), t, Math.max(0.5, plan.sec));
  } catch (e) {
    try { AU.dynGain.gain.setValueAtTime(1, t); } catch (e2) {}
  }
}

function trackOutput(t){
  var n = AU.trackNodes[t.id];
  if (!n) { attachTrack(t); n = AU.trackNodes[t.id]; }
  return n ? n.gain : AU.master.in;
}
function refreshMix(){  var anySolo = S.tracks.some(function(t){ return t.solo; });
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
  if (d.kind === 'drumkit') return [];
  if (d.kind === 'sample') return d.notes.map(function(n){ return d.base + n.replace('#','s') + '.mp3'; });
  if (d.kind === 'drums') return Object.keys(DRUM_FILES).map(function(k){ return DRUM_BASE + d.folder + '/' + DRUM_FILES[k]; });
  return [];
}

function prepareInst(id){
  var d = INST[id];
  if (!d) return Promise.resolve(null);
  if (AU.instCache[id]) return AU.instCache[id].promise;
  var ctx = AU.ctx;
  if (d.kind === 'synth' || d.kind === 'drumkit' || !ctx) {
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

/* ---------------------------------------------------------------- 드럼 킷 4종 (신스)
   킷마다 피치 하강·감쇠·클릭·드라이브·필터·금속도가 다르다.
   샘플을 받지 않으므로 오프라인 WAV 렌더에도 완전히 같은 소리가 난다. */
var DRUM_KITS = {
  hiphop808: {
    kick:  { f0:160, f1:32, pd:0.16, dec:1.10, click:0.10, drive:2.4 },
    snare: { band:1800, q:0.9, dec:0.19, noise:0.70, body:0.34, bodyF:180, bodyDec:0.11 },
    hat:   { hp:9400, dec:0.030, metal:0.55 },
    ohat:  { hp:7200, dec:0.28, metal:0.45 }
  },
  lofi: {
    kick:  { f0:105, f1:44, pd:0.08, dec:0.34, click:0.04, drive:1.2, lp:1500 },
    snare: { band:1350, q:1.6, dec:0.16, noise:0.55, body:0.28, bodyF:170, bodyDec:0.10, lp:4200 },
    hat:   { hp:6200, dec:0.048, metal:0.12, lp:7000, crackle:0.05 },
    ohat:  { hp:5200, dec:0.19, metal:0.08, lp:6500, crackle:0.04 }
  },
  rock: {
    kick:  { f0:130, f1:52, pd:0.06, dec:0.30, click:0.34 },
    snare: { band:2300, q:0.8, dec:0.17, noise:0.80, body:0.52, bodyF:195, bodyDec:0.13, bodyType:'triangle' },
    hat:   { hp:7000, dec:0.055, metal:0.20 },
    ohat:  { hp:6200, dec:0.34, metal:0.14 }
  },
  electro: {
    kick:  { f0:190, f1:48, pd:0.045, dec:0.24, click:0.62, drive:3.0 },
    snare: { band:1200, q:1.2, dec:0.26, noise:0.72, clap:3 },
    hat:   { hp:10500, dec:0.028, metal:0.60 },
    ohat:  { hp:8800, dec:0.16, metal:0.50 }
  }
};

function kitDist(ctx, drive){
  var ws = ctx.createWaveShaper(); ws.curve = makeCurve(drive * 22); ws.oversample = '2x';
  return ws;
}
function kitNoise(ctx, out, when, dur, level, type, freq, q){
  if (!level) return;
  var src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
  var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1800; f.Q.value = q || 1;
  var g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.0001, level), when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.01, dur));
  src.connect(f); f.connect(g); g.connect(out);
  src.start(when); src.stop(when + dur + 0.04);
}

function kitKick(ctx, out, k, when, vel){
  var v = clamp(vel, 0.05, 1);
  var o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(k.f0, when);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, k.f1), when + k.pd);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(v * 0.95, when + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when + k.dec);
  var tail = g;
  if (k.drive) { var ws = kitDist(ctx, k.drive); tail.connect(ws); tail = ws; }
  if (k.lp) { var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = k.lp; tail.connect(lp); tail = lp; }
  o.connect(g); tail.connect(out);
  o.start(when); o.stop(when + k.dec + 0.05);
  if (k.click) kitNoise(ctx, out, when, 0.022, v * k.click * 0.45, 'bandpass', 2600, 0.8);
}

function kitSnare(ctx, out, s, when, vel){
  var v = clamp(vel, 0.05, 1);
  var bursts = s.clap ? s.clap : 1, rep = s.clap ? 0.011 : 0;
  for (var b = 0; b < bursts; b++){
    var t = when + b * rep;
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = s.band; bp.Q.value = s.q || 1;
    var g = ctx.createGain();
    var lv = v * (s.noise || 0.6) * (b === 0 ? 1 : 0.62);
    g.gain.setValueAtTime(Math.max(0.0001, lv), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, s.dec * (b === 0 ? 1 : 0.55)));
    var tail = g;
    if (s.lp) { var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = s.lp; tail.connect(lp); tail = lp; }
    src.connect(bp); bp.connect(g); tail.connect(out);
    src.start(t); src.stop(t + s.dec + 0.05);
  }
  if (s.body){
    var o = ctx.createOscillator(); o.type = s.bodyType || 'triangle';
    o.frequency.setValueAtTime(s.bodyF, when);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, s.bodyF * 0.7), when + s.bodyDec);
    var og = ctx.createGain();
    og.gain.setValueAtTime(v * s.body, when);
    og.gain.exponentialRampToValueAtTime(0.0001, when + s.bodyDec);
    o.connect(og); og.connect(out);
    o.start(when); o.stop(when + s.bodyDec + 0.03);
  }
}

function kitHat(ctx, out, h, when, vel, open){
  var v = clamp(vel, 0.03, 1);
  var src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
  var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = h.hp; hp.Q.value = 0.7;
  var g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.0001, v * (open ? 0.34 : 0.30)), when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + h.dec);
  var tail = g;
  if (h.lp) { var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = h.lp; tail.connect(lp); tail = lp; }
  src.connect(hp); hp.connect(g); tail.connect(out);
  src.start(when); src.stop(when + h.dec + 0.03);
  if (h.metal){
    [1.41, 1.73, 2.11, 2.53, 2.97].forEach(function(r){
      var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 3200 * r;
      var og = ctx.createGain(); og.gain.value = v * h.metal * 0.030;
      o.connect(og); og.connect(g); o.start(when); o.stop(when + h.dec + 0.03);
    });
  }
  /* 로파이 비닐 질감 — 아주 짧은 먼지 소리 */
  if (h.crackle) kitNoise(ctx, out, when, 0.055, v * h.crackle, 'lowpass', 3200, 0.7);
}

function synthDrumKit(ctx, out, def, row, when, vel){
  var kit = DRUM_KITS[def.kit];
  if (!kit) return false;
  var g = def.gain || 1;
  var v = clamp(vel, 0.05, 1) * g;
  if (row === 'kick') { kitKick(ctx, out, kit.kick, when, v); return true; }
  if (row === 'snare') { kitSnare(ctx, out, kit.snare, when, v); return true; }
  if (row === 'hat') { kitHat(ctx, out, kit.hat, when, v, false); return true; }
  if (row === 'ohat') { kitHat(ctx, out, kit.ohat, when, v, true); return true; }
  /* tom 행이 생기면 킥 파라미터를 피치만 올려 쓴다 */
  kitKick(ctx, out, { f0:kit.kick.f0 * 1.6, f1:kit.kick.f1 * 1.9, pd:kit.kick.pd, dec:kit.kick.dec * 0.5, click:0.05 }, when, v);
  return true;
}

/* ---------------------------------------------------------------- 키트 미리듣기 */
function previewKit(id){
  if (!AU.ctx) return;
  var def = INST[id]; if (!def) return;
  var t = AU.ctx.currentTime + 0.02, sd = stepDur();
  var out = AU.musicBus || AU.master.in;
  try {
    synthDrumKit(AU.ctx, out, def, 'kick', t, 0.92);
    synthDrumKit(AU.ctx, out, def, 'hat', t + sd * 2, 0.55);
    synthDrumKit(AU.ctx, out, def, 'snare', t + sd * 4, 0.85);
    synthDrumKit(AU.ctx, out, def, 'ohat', t + sd * 6, 0.5);
  } catch (e) {}
}

function synthVoice(ctx, out, def, midi, when, durSec, vel){
  var f0 = 440 * Math.pow(2, (midi - 69) / 12);
  var v = Math.max(0.03, Math.min(1, vel));
  var atk = def.atk || 0.01, dec = def.dec || 0.2, sus = def.sus || 0.5, rel = def.rel || 0.3;
  var g = ctx.createGain();
  var filt = ctx.createBiquadFilter();
  filt.type = 'lowpass'; filt.Q.value = 1.1;
  var bri = def.bright || 1;
  var openF = def.synth === 'chip' ? 15000 : Math.min(14000, 600 + v * 3200 * bri);
  filt.frequency.setValueAtTime(openF, when);
  if (def.synth !== 'chip') filt.frequency.exponentialRampToValueAtTime(Math.max(280, openF * 0.32), when + Math.max(0.08, durSec * 0.8));
  var peak = v * (def.gain || 0.5);
  var holdEnd = Math.max(when + atk + dec, when + durSec);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + atk);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), when + atk + dec);
  g.gain.setValueAtTime(Math.max(0.0001, peak * sus), holdEnd);
  g.gain.exponentialRampToValueAtTime(0.0001, holdEnd + rel);
  /* 보컬 패드 — 포먼트(공명) 필터를 한 장 더 걸어 '우/아' 느낌을 만든다 */
  var tail = filt;
  if (def.formant) {
    var fmf = ctx.createBiquadFilter();
    fmf.type = 'peaking'; fmf.frequency.value = def.formant; fmf.Q.value = 1.6; fmf.gain.value = 9;
    filt.connect(fmf); tail = fmf;
  }
  /* 브라스·벨 같은 음색용 포먼트 강조 한 단 */
  if (def.peak) {
    var pkf = ctx.createBiquadFilter();
    pkf.type = 'peaking'; pkf.frequency.value = def.peak; pkf.Q.value = def.peakQ || 1.8; pkf.gain.value = def.peakGain || 6;
    tail.connect(pkf); tail = pkf;
  }
  tail.connect(g); g.connect(out);

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
  } else if (def.synth === 'ooh') {
    osc('triangle', -7, 0.44); osc('sine', 0, 0.48); osc('triangle', 8, 0.22);
  } else if (def.synth === 'aah') {
    osc('sawtooth', -6, 0.30); osc('sawtooth', 6, 0.30); osc('triangle', 0, 0.26);
  } else if (def.synth === 'chops') {
    osc('sawtooth', 0, 0.5); osc('square', 9, 0.16);
  } else if (def.synth === 'brass') {
    /* 브라스 섹션 — 살짝 붙었다가 열리는 톱니 스택 + 비브라토 */
    osc('sawtooth', -6, 0.30); osc('sawtooth', 5, 0.30); osc('square', 0, 0.13);
    var vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.2;
    var vibG = ctx.createGain(); vibG.gain.setValueAtTime(0, when);
    vibG.gain.linearRampToValueAtTime(6, when + Math.min(0.45, Math.max(0.12, durSec * 0.5)));
    vib.connect(vibG);
    oscs.forEach(function(o){ try { vibG.connect(o.detune); } catch (e) {} });
    vib.start(when);
    try { vib.stop(holdEnd + rel + 0.05); } catch (e) {}
  } else if (def.synth === 'chip') {
    /* 8비트 칩튠 — 펄스 느낌의 사각파 두 장, 필터를 거의 닫지 않는다 */
    osc('square', 0, 0.40); osc('square', 11, 0.15);
    oscs.forEach(function(o){
      try {
        o.frequency.setValueAtTime(f0 * 1.06, when);
        o.frequency.exponentialRampToValueAtTime(f0, when + 0.035);
      } catch (e) {}
    });
  } else if (def.synth === 'bell') {
    /* 감성 벨 — 비화성 비율(3.51) FM + 2배음 반짝임, 긴 여운 */
    var bcar = ctx.createOscillator(); bcar.type = 'sine'; bcar.frequency.value = f0;
    var bmod = ctx.createOscillator(); bmod.type = 'sine'; bmod.frequency.value = f0 * 3.51;
    var bmg = ctx.createGain();
    bmg.gain.setValueAtTime(f0 * 2.1, when);
    bmg.gain.exponentialRampToValueAtTime(Math.max(1, f0 * 0.04), when + Math.max(0.5, durSec * 1.4));
    bmod.connect(bmg); bmg.connect(bcar.frequency);
    var bog = ctx.createGain(); bog.gain.value = 0.85;
    bcar.connect(bog); bog.connect(filt); oscs.push(bcar, bmod);
    var b2 = ctx.createOscillator(); b2.type = 'sine'; b2.frequency.value = f0 * 2.01;
    var b2g = ctx.createGain(); b2g.gain.value = 0.22; b2.connect(b2g); b2g.connect(filt); oscs.push(b2);
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
  if (def.kind === 'drums' || def.kind === 'drumkit') {
    /* 킷 4종은 샘플 없이 킷별 신스 파라미터로 — 오프라인 렌더에도 같은 소리 */
    if (def.kind === 'drumkit') { synthDrumKit(ctx, out, def, ev.row, when, ev.vel); return; }
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

function totalSteps(){ return S.bars * barLen(); }
function stepDur(){ return (60 / S.bpm) / 4; }

function scheduleStep(step, when, stepDurS){
  /* 구간 전환 라이저 — 섹션이 바뀌기 전 마지막 마디에서 다음 파트로올라가는 스웰 */
  if (S.riser && step % barLen() === 0){
    var rb = Math.floor(step / barLen());
    if (riserBars().indexOf(rb) > -1) riserFx(AU.ctx, AU.musicBus || AU.master.in, when, barLen() * stepDurS);
  }
  var evs = S.events[step];
  if (!evs || !evs.length) return;
  var anySolo = S.tracks.some(function(t){ return t.solo; });
  for (var i = 0; i < evs.length; i++) {
    var ev = evs[i], trk = S.tracks[ev.t];
    if (!trk || trk.mute || (anySolo && !trk.solo)) continue;
    var out = trackOutput(trk);
    if (!out) continue;
    var at = when + (ev.jit || 0) * stepDurS;
    if (S.pump && AU.pumpBus && trk.role === 'drums' && ev.row === 'kick') pumpAt(AU.ctx, AU.pumpBus, at);
    fireEvent(AU.ctx, out, trk, ev, at, stepDurS);
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
      var bar = Math.floor(st / barLen()) + 1, beat = Math.floor((st % barLen()) / 4) + 1;
      var el2 = $('bar-display'); if (el2) el2.textContent = pad2(bar) + '.' + beat;
      S.step = st;
      if (document.querySelector('#tab-seq:not(.hidden)')) drawEnergy();
    }, delay);
    AU.nextTime += sd;
    AU.step++;
    if (AU.step >= totalSteps()) {
      if (S.isLoop === false) { AU.endAt = AU.nextTime; AU.step = 0; break; }
      AU.step = 0;
      scheduleStoryGain(AU.nextTime);
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
      scheduleStoryGain(AU.nextTime);
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
  if (AU.dynGain && AU.ctx){
    try { AU.dynGain.gain.cancelScheduledValues(AU.ctx.currentTime); AU.dynGain.gain.setValueAtTime(1, AU.ctx.currentTime); } catch (e) {}
  }
  if (AU.pumpBus && AU.ctx){
    try { AU.pumpBus.gain.cancelScheduledValues(AU.ctx.currentTime); AU.pumpBus.gain.value = 1; } catch (e) {}
  }
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
    if (INST[id] && (INST[id].kind === 'synth' || INST[id].kind === 'drumkit')) synth++;
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
  var v = S.energyCurve && S.energyCurve.length ? S.energyCurve[mapCurveIndex(bar)] : null;
  if (v == null) {
    var sec = sections().filter(function(s){ return bar >= s.start && bar < s.start + s.len; })[0];
    v = sec ? sec.e : .6;
  }
  return clamp(v, .1, 1);
}
/* 에너지 곡선은 16칸 기준 — 마디 수가 다르면(영상 길이 맞춤 등) 비율로 당겨 쓴다 */
function mapCurveIndex(bar){
  var n = S.energyCurve ? S.energyCurve.length : 16;
  if (!n) return 0;
  if (S.bars <= n) return clamp(bar, 0, n - 1);
  return clamp(Math.round(bar * (n - 1) / Math.max(1, S.bars - 1)), 0, n - 1);
}
function curveBars(){ return Math.max(16, S.bars || 16); }
function curveValueAt(i){
  if (!S.energyCurve || !S.energyCurve.length) return .5;
  var idx = S.bars > 16 ? Math.round(i * (S.energyCurve.length - 1) / Math.max(1, curveBars() - 1)) : i;
  var v = S.energyCurve[clamp(idx, 0, S.energyCurve.length - 1)];
  return v == null ? .5 : v;
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
      if (step >= barLen()) continue;
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

      var nextStep = k + 1 < rhythm.length ? rhythm[k + 1] : barLen();
      var dur = Math.max(1, Math.min(barLen(), nextStep - step));
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
  var ry = (!S.rhythmAuto) ? rhythmNow() : null;
  var style = { citypop:'funk', lofi:'straight', cinematic:'sub', synthwave:'pulse', acoustic:'straight', hiphop:'sub',
    news:'straight', breaking:'pulse', bossa:'bossa', kpop:'funk', ballad:'straight', funk:'funk',
    chiptune:'pulse', ambient:'sub', techhouse:'pulse', neosoul:'walk' }[S.preset] || 'straight';
  var out = [];
  var BL = barLen();
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
    if (ry && ry.bass && ry.bass.length) {
      /* 리듬 패턴 전용 베이스 리듬 */
      steps = ry.bass.filter(function(p2){ return p2[0] < BL; }).map(function(p2){
        return [p2[0], p2[1] === 'fifth' ? fifth : p2[1] === 'oct' ? oct : root];
      });
    }
    else if (style === 'funk')  steps = e > .6 ? [[0,root],[3,oct],[6,fifth],[8,root],[11,oct],[14,fifth]] : [[0,root],[6,fifth],[8,root],[14,oct]];
    else if (style === 'pulse') steps = [[0,root],[2,oct],[4,root],[6,oct],[8,root],[10,oct],[12,root],[14,oct]];
    else if (style === 'sub')   steps = [[0,root],[8,root],[14,chance(.5) ? fifth : oct]];
    else if (style === 'bossa') steps = e > .5 ? [[0,root],[3,fifth],[6,oct],[10,root],[13,fifth]] : [[0,root],[6,fifth],[10,oct]];
    else if (style === 'walk')  steps = [[0,root],[4,fifth],[8,oct],[12,fifth],[14,chance(.5) ? fifth : oct]];
    else                        steps = [[0,root],[6,fifth],[8,root],[12,oct]];
    steps = steps.filter(function(p2){ return p2[0] < BL; });
    var bdur = (ry && ry.bassDur) ? ry.bassDur : null;
    steps.forEach(function(p2){
      out.push({ bar:b, step:p2[0], midi:p2[1], dur: bdur || (p2[0] === 0 ? 3 : 2), vel: clamp(.62 + e * .3, .3, 1) });
    });
    /* 다음 코드로 넘어가는 접근음 */
    var nextRoot = S.chords[(b + 1) % S.bars].notes[0] - 12;
    while (nextRoot > 48) nextRoot -= 12;
    while (nextRoot < 33) nextRoot += 12;
    if (e > .5 && chance(.55) && !bdur) out.push({ bar:b, step: BL - 1, midi: nextRoot > root ? nextRoot - 1 : nextRoot + 1, dur:1, vel:.5 });
  }
  return out;
}

function genArp(seed){
  seedRand(seed || 3131);
  var out = [];
  var pObj = PRESETS.filter(function(x){ return x.id === S.preset; })[0];
  var ry = (!S.rhythmAuto) ? rhythmNow() : null;
  var fixedSteps = (ry && ry.arpPat && ry.arpPat.length) ? ry.arpPat.slice()
    : (pObj && pObj.arpPat && pObj.arpPat.length ? pObj.arpPat : null);
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
    var count = e > .8 ? barLen() : e > .5 ? 8 : 4;
    var gap = barLen() / count;
    for (var k = 0; k < count; k++) {
      var idx = seq[k % seq.length] % tones.length;
      out.push({ bar:b, step: Math.round(k * gap), midi: tones[idx], dur: Math.max(1, Math.round(gap * .8)), vel: (k % 4 === 0 ? .55 : .34) + e * .18 });
    }
  }
  return out;
}

/* 보컬 코러스 패드 — Ooh/Aah 는 길게 깔리고, Chops 는 리듬으로 끊어 준다 */
function genVocal(seed){
  seedRand((seed || 1) + 101);
  var trk = S.tracks.filter(function(t){ return t.role === 'vocal'; })[0];
  var inst = trk ? trk.inst : 'vox-ooh';
  var out = [];
  for (var b = 0; b < S.bars; b++){
    var ch = S.chords[b]; if (!ch || !ch.notes) continue;
    var e = barEnergy(b);
    var sec = sectionOf(b);
    if (sec.name === 'Intro' && e < .55) continue;
    if (e < .24) continue;
    var top = ch.notes[ch.notes.length - 1] + 12;
    var mid = ch.notes[Math.max(0, ch.notes.length - 2)] + 12;
    if (inst === 'vox-chops'){
      for (var s = 0; s < barLen(); s += 2){
        if (chance(.58)) continue;
        out.push({ bar:b, step:s, midi: chance(.3) ? top : mid, dur:1, vel: clamp(.24 + e * .2, .2, .62) });
      }
    } else {
      out.push({ bar:b, step:0, midi:top, dur:barLen(), vel: clamp(.24 + e * .2, .2, .6) });
      if (e > .5) out.push({ bar:b, step:Math.floor(barLen() / 2), midi:mid, dur:Math.floor(barLen() / 2), vel: clamp(.2 + e * .16, .18, .5) });
    }
  }
  return out;
}

function genDrums(seed){
  seedRand(seed || 4242);
  var kitId = S.tracks.filter(function(t){ return t.role === 'drums'; })[0].inst;
  var pObj = PRESETS.filter(function(x){ return x.id === S.preset; })[0];
  var ry = rhythmNow();
  var pat = null;
  /* 리듬 칩을 직접 골랐으면 그 리듬이, 프리셋을 고른 직후엔 프리셋 전용 패턴이 우선 */
  if (!S.rhythmAuto && ry) pat = ry.pat;
  else if (pObj && pObj.pat && DRUM_PAT[pObj.pat]) pat = DRUM_PAT[pObj.pat];
  else if (ry) pat = ry.pat;
  else pat = DRUM_PAT[kitId] || DRUM_PAT['kit-cr78'];
  var BL = barLen();
  var out = [];
  function hit(p, row, s){ return p && p[row] ? p[row].charAt(s) === '1' : false; }
  for (var b = 0; b < S.bars; b++) {
    var e = barEnergy(b);
    var sec = sectionOf(b);
    var useB = (sec.name === 'B' || sec.name === "A′") && e > .55;
    var p2 = useB ? pat.B : pat.A;
    var isFill = S.fill && ((b + 1) % 4 === 0) && b > 0;
    for (var s = 0; s < BL; s++) {
      var accent = (s % 4 === 0) ? 1 : (s % 2 === 0 ? .82 : .68);
      if (isFill && s >= BL - 4) {
        var rowF = s === BL - 4 ? 'snare' : s === BL - 3 ? 'tom1' : s === BL - 2 ? 'tom2' : 'tom3';
        out.push({ bar:b, step:s, row:rowF, vel: clamp(.5 + (s - (BL - 4)) * .12 + e * .2, .3, 1) });
        continue;
      }
      if (hit(p2, 'kick', s) && (e > .28 || s === 0)) out.push({ bar:b, step:s, row:'kick', vel: clamp(.72 + e * .28, .3, 1) });
      if (hit(p2, 'snare', s) && e > .42) out.push({ bar:b, step:s, row:'snare', vel: clamp(.66 + e * .3, .3, 1) });
      if (hit(p2, 'hat', s) && e > .22) out.push({ bar:b, step:s, row:'hat', vel: clamp(accent * (.24 + e * .26), .12, .78) });
      if (hit(p2, 'ohat', s) && e > .5) out.push({ bar:b, step:s, row:'ohat', vel: clamp(.42 + e * .22, .2, .9) });
    }
    /* 고에너지 구간 16분 하이햇 롤 — 리듬 칩을 직접 고른 경우엔 그 패턴의 하이햇 모양을 지킨다 */
    var rollOk = S.rhythmAuto || !ry || !!ry.rollHat;
    if (e > .88 && !isFill && rollOk) {
      for (var s2 = 1; s2 < BL; s2 += 2) {
        if (!hit(p2, 'hat', s2)) out.push({ bar:b, step:s2, row:'hat', vel:.26 });
      }
    }
    /* 트랩 리듬은 중간 에너지에서도 16분 롤로 굴린다 */
    if (!S.rhythmAuto && ry && ry.id === 'trap16' && e > .58 && !isFill) {
      for (var s3 = 1; s3 < BL; s3 += 2) {
        if (!hit(p2, 'hat', s3)) out.push({ bar:b, step:s3, row:'hat', vel: clamp(.16 + e * .12, .12, .34) });
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
  var BL = barLen();
  var ry = (!S.rhythmAuto) ? rhythmNow() : null;

  S.chords.forEach(function(ch, b){
    var step0 = b * BL;
    if (step0 >= total) return;
    /* 리듬 칩을 골랐으면 코드 컴핑도 그 리듬대로 (하우스 스탭·보사노바 컴핑·스타카토 등) */
    var comps = (ry && ry.comp && ry.comp.length) ? ry.comp : [[0, BL]];
    comps.forEach(function(cp){
      var base = step0 + cp[0];
      if (base >= total) return;
      ch.notes.forEach(function(n, ni){
        /* 코드 롤링 — 위 음으로 갈수록 살짝 늦게 (기타 스트럼처럼) */
        ev[base].push({ t: tIdx.chords, midi: n, dur: Math.max(1, Math.min(cp[1] || BL, total - base)), vel: .52, roll: (S.roll / 100) * 0.14 * ni });
      });
    });
  });
  S.notes.forEach(function(n){
    var s = n.bar * BL + n.step;
    if (s < total) ev[s].push({ t: tIdx.melody, midi: n.midi, dur: n.dur || 2, vel: n.vel || .75 });
  });
  S.bass.forEach(function(n){
    var s = n.bar * BL + n.step;
    if (s < total) ev[s].push({ t: tIdx.bass, midi: n.midi, dur: n.dur || 2, vel: n.vel || .8 });
  });
  if (tIdx.vocal != null) (S.vocal || []).forEach(function(n){
    var s = n.bar * BL + n.step;
    if (s < total) ev[s].push({ t: tIdx.vocal, midi: n.midi, dur: n.dur || 8, vel: n.vel || .4 });
  });
  S.arp.forEach(function(n){
    var s = n.bar * BL + n.step;
    if (s < total) ev[s].push({ t: tIdx.arp, midi: n.midi, dur: n.dur || 1, vel: n.vel || .4 });
  });
  S.drums.forEach(function(n){
    /* 마지막 마디 드럼 브레이크다운 — 킥만 1·3박에 남긴다 */
    if (S.breakdown && S.bars > 2 && n.bar === S.bars - 1 && (n.row !== 'kick' || n.step % 8 !== 0)) return;
    var s = n.bar * BL + n.step;
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
      if (e2.roll) e2.jit += e2.roll;
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
  S.vocal = genVocal((seed || 1) + 41);
  rebuildEvents();
  refreshStats();
}

/* ---------------------------------------------------------------- 4-b. 분위기별 코드 진행 1클릭 변주 */
var MOOD_VARIATIONS = {
  canon:  { prog:'canon',  ext:'9', label:'감동 · 카논 진행',   tip:'피아노·스트링이 이어지는 카논 진행으로 감동 라인을 만들었습니다.' },
  tension:{ prog:'tension',ext:'7', label:'긴장 · 미스터리',   tip:'단조 안에서 ii°-v로 떨어지는 미스터리 진행으로 바꿨습니다.' },
  twofive:{ prog:'twofive',ext:'9', label:'시티팝 · 투파이브원', tip:'ii-V-I-vi 투파이브원 진행 — 시티팝·재즈의 기본 문법입니다.' },
  epic:   { prog:'epic',   ext:'9', label:'웅장한 오케스트라',  tip:'i-VI-III-iv로 넓게 쌓는 웅장한 진행으로 바꿨습니다.' }
};
function applyMoodVariation(kind){
  var v = MOOD_VARIATIONS[kind];
  if (!v) return;
  var seed = (Date.now() ^ (Math.random() * 1e6)) & 0xffff;
  S.prog = v.prog;
  S.ext = v.ext;

  /* 진행의 성격에 맞는 조성 — 단조 계열이 아닐 때만 강제로 바꾼다 */
  var minorish = ['minor','phrygian','harmonic_min','dorian','pentatonic_min'];
  var majorishS = ['major','lydian','mixolydian','pentatonic_maj'];
  if (kind === 'tension' && minorish.indexOf(S.mode) < 0) S.mode = 'minor';
  if (kind === 'twofive' && majorishS.indexOf(S.mode) < 0) S.mode = 'major';
  /* 카논은 장조 계열이 가장 자연스럽다 — 모달(도리안·프리지안)에서는 단조로 내려 이상한 감화음을 피한다 */
  if (kind === 'canon' && majorishS.indexOf(S.mode) < 0 && minorish.indexOf(S.mode) < 0) S.mode = 'minor';

  if (kind === 'tension'){
    S.bright = clamp(S.bright - 10, 10, 100);
    S.energy = clamp(Math.max(S.energy, 62), 10, 100);
    S.swing = 0;
    S.energyCurve = defaultCurve('buildup');
    var ct = S.tracks.filter(function(t){ return t.role === 'chords'; })[0];
    if (ct && !ct.locked) ct.inst = 'pad';
  } else if (kind === 'canon'){
    S.bright = clamp(S.bright + 6, 10, 100);
    S.energy = clamp(Math.min(S.energy, 72), 20, 100);
    S.energyCurve = defaultCurve('standard');
  } else if (kind === 'twofive'){
    S.bright = clamp(S.bright + 8, 10, 100);
    S.swing = Math.max(S.swing, 14);
    S.energy = clamp(Math.max(S.energy, 66), 20, 100);
    S.energyCurve = defaultCurve('wave');
  } else if (kind === 'epic'){
    S.energy = clamp(Math.max(S.energy, 80), 20, 100);
    S.bright = clamp(S.bright - 4, 10, 100);
    S.energyCurve = defaultCurve('buildup');
  }

  /* 코드·베이스·패드·드럼을 새 진행에 맞춰 다시 짠다 (멜로디는 잠겨 있으면 그대로) */
  var melTrk = S.tracks.filter(function(t){ return t.role === 'melody'; })[0];
  var keepMelody = melTrk && melTrk.locked ? S.notes.slice() : null;
  S.chords = [];
  composeAll(seed, { newChords:true });
  if (keepMelody){ S.notes = keepMelody; rebuildEvents(); refreshStats(); }

  S.aiTitle = v.label;
  S.aiTip = v.tip + ' 코드·베이스·반주를 새로 짰습니다. 마음에 안 들면 한 번 더 누르면 같은 진행에서 다른 편곡이 나옵니다.';
  S.aiSource = 'variation';
  S.aiModel = '';
  if (typeof showAiCard === 'function') showAiCard();
  syncPresetUI(); refreshStats(); refreshLoopInfo(); drawAll();
  toast('코드 진행 변주 · ' + v.label, 'ok');
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
  S.key = p.key; S.mode = presetScale(p); S.bpm = p.bpm; S.bright = p.bright; S.energy = p.energy;
  /* 프리셋 ↔ 리듬 패턴 자동 연동 (프리셋은 자기 드럼 패턴을 그대로 유지) */
  S.rhythm = presetRhythm(p);
  S.rhythmAuto = true;
  S.meter = (rhythmOf(S.rhythm) && rhythmOf(S.rhythm).meter === 3) ? 3 : 4;
  if (p.swing != null) S.swing = clamp(p.swing, 0, 60);
  var byRole = { melody:p.mel, chords:p.chd, bass:p.bas, drums:p.drm, arp:p.arp || 'guitar' };
  /* 잠근 트랙은 프리셋을 바꿔도 악기를 그대로 둔다 */
  S.tracks.forEach(function(t){ if (t.locked) return; if (byRole[t.role]) t.inst = byRole[t.role]; });
  S.energyCurve = presetEnergyCurve(p);
  if (!keepMood) {
    var mt = $('mood-text'); if (mt) mt.value = p.mood;
  }
  syncPresetUI();
  saveSettings();
}

function refreshScaleHint(){
  var el = $('scale-hint');
  if (!el) return;
  var lab = SCALE_LABEL[S.mode] || S.mode;
  var hint = SCALE_HINT[S.mode] || '';
  var p = PRESETS.filter(function(x){ return x.id === S.preset; })[0];
  var auto = p && presetScale(p) === S.mode;
  el.innerHTML = '<b style="color:var(--violet);">' + lab + '</b>' + (hint ? ' · ' + hint : '') +
    ' · <span class="faint">' + (auto ? '프리셋 자동 맞춤' : '직접 선택') + '</span>';
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
  if (typeof refreshScaleHint === 'function') refreshScaleHint();
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
  if (typeof renderSoundPalette === 'function') { try { renderSoundPalette(); } catch (e) {} }
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
  var barSec = barSecAt(S.bpm);
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
    var cols = curveBars();
    for (var b = 0; b < cols; b++) {
      var i2 = el('i');
      var v = curveValueAt(b);
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
  var BPB = beatsPerBar();
  var barSec = BPB * 60 / S.bpm;
  var L = S.loop;
  if (L.type === 'sec') {
    var bars = Math.max(1, Math.round(L.value / barSec));
    if (S.exactSec === false) {
      /* 템포를 지키고 마디에 맞춘 근사 길이 — 미리 들은 그대로 저장된다 */
      var realSec = bars * BPB * 60 / S.bpm;
      return { bars:bars, bpm:S.bpm, sec: realSec, exact: Math.abs(realSec - L.value) < 0.05, adjusted:false };
    }
    var bpmExact = bars * BPB * 60 / L.value;
    var diff = Math.abs(bpmExact - S.bpm) / S.bpm;
    if (diff <= 0.1 && bpmExact >= 60 && bpmExact <= 175) {
      var adjBpm = Math.round(bpmExact * 10) / 10;
      return { bars:bars, bpm: adjBpm, sec: bars * BPB * 60 / adjBpm, exact:true, adjusted: Math.abs(bpmExact - S.bpm) > 0.15 };
    }
    return { bars:bars, bpm:S.bpm, sec: bars * BPB * 60 / S.bpm, exact:false, adjusted:false };
  }
  return { bars:L.value, bpm:S.bpm, sec: L.value * BPB * 60 / S.bpm, exact:true, adjusted:false };
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
  if (typeof paintStoryTrack === 'function') paintStoryTrack();
  return p;
}

/* ---------------------------------------------------------------- 5-b. 쇼츠 기승전결 엔벨로프 */
/* x(0~1) → 게인. 0.61에서 숨을 죽였다가 0.655에서 드롭, 마지막은 1.5초 페이드아웃 */
var STORY_POINTS = [[0,0.42],[0.05,0.5],[0.18,0.6],[0.42,0.8],[0.56,0.94],[0.61,0.7],[0.655,1.0],[0.84,1.0],[0.92,0.96],[1,0.93]];
function storyGainAt(t, dur){
  dur = dur || 1;
  var x = clamp(t / dur, 0, 1);
  var g = STORY_POINTS[STORY_POINTS.length - 1][1];
  for (var i = 1; i < STORY_POINTS.length; i++){
    if (x <= STORY_POINTS[i][0]){
      var a = STORY_POINTS[i - 1], b = STORY_POINTS[i];
      var k = clamp((x - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
      g = a[1] + (b[1] - a[1]) * k;
      break;
    }
  }
  /* 마지막 1.5초 이퀄파워 페이드아웃 */
  var fade = Math.min(1.5, dur * 0.2);
  var fs = dur - fade;
  if (t > fs){
    var k2 = clamp((t - fs) / fade, 0, 1);
    g *= Math.cos(k2 * Math.PI / 2);
  }
  return g;
}
function applyStoryEnvelope(buf){
  var n = buf.length, sr = buf.sampleRate, dur = buf.duration;
  var gains = new Float32Array(n);
  for (var i = 0; i < n; i++) gains[i] = storyGainAt(i / sr, dur);
  for (var ch = 0; ch < buf.numberOfChannels; ch++){
    var d = buf.getChannelData(ch);
    for (var j = 0; j < n; j++) d[j] *= gains[j];
  }
  return buf;
}
/* 검증용 — 구간별 RMS(cm)로 기승전결이 실제로 입혀졌는지 본다 */
function audioWindowStats(buf){
  var sr = buf.sampleRate, dur = buf.duration;
  var d0 = buf.getChannelData(0);
  var d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0;
  function rms(a, b){
    var i0 = Math.max(0, Math.floor(a * sr)), i1 = Math.min(buf.length, Math.floor(b * sr));
    var s = 0, n = 0;
    for (var i = i0; i < i1; i++){ var v = (d0[i] + d1[i]) / 2; s += v * v; n++; }
    return n ? Math.sqrt(s / n) : 0;
  }
  var last = rms(dur - 0.25, dur);
  return {
    dur: dur, head: rms(0, 0.15), build: rms(dur * 0.4, dur * 0.5),
    predrop: rms(dur * 0.585, dur * 0.605), drop: rms(dur * 0.67, dur * 0.72),
    tail: last, tailDb: 20 * Math.log10(Math.max(last, 1e-9))
  };
}

function storyCurveForWebAudio(plan){
  var pts = 128, arr = new Float32Array(pts);
  var dur = plan.sec;
  for (var i = 0; i < pts; i++) arr[i] = storyGainAt(dur * i / (pts - 1), dur);
  return arr;
}

/* 15·30·60초 쇼츠 버튼 — 길이와 엔벨로프를 한 번에 */
function setStoryLength(len){
  len = [15, 30, 60].indexOf(+len) > -1 ? +len : 15;
  S.story = { on:true, len:len };
  S.loop = { type:'sec', value:len };
  S.exactSec = true;
  var ex = $('chk-exactsec'); if (ex) ex.checked = true;
  /* 쇼츠·유튜브는 −14 LUFS가 기본감각 — 사용자가 체크해 끄지 않는 한 맞춘다 */
  if (S.normMode !== 'lufs'){ S.normMode = 'lufs'; var nm = $('norm-mode'); if (nm) nm.value = 'lufs'; }
  var plan = refreshLoopInfo();
  renderStoryUI(); paintStoryTrack();
  if (AU.playing && AU.ctx) scheduleStoryGain(AU.ctx.currentTime + 0.05);
  saveSettings();
  toast(len + '초 ' + (len === 15 ? '쇼츠' : len === 30 ? '릴스' : '유튜브') + ' 편곡 · ' + plan.bars + '마디 / ' + plan.sec.toFixed(1) + '초 · 기승전결 적용', 'ok');
  return plan;
}

function renderStoryUI(){
  var on = !!(S.story && S.story.on);
  var badge = $('story-badge');
  if (badge){
    badge.textContent = on ? (S.story.len + '초 · 기승전결') : '꺼짐';
    badge.className = 'badge' + (on ? ' ok' : '');
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-story]'), function(b){
    b.classList.toggle('on', on && +b.dataset.story === S.story.len);
  });
  var chk = $('chk-story'); if (chk) chk.checked = on;
  Array.prototype.forEach.call(document.querySelectorAll('[data-loop]'), function(b){
    var v = +b.dataset.loop, kind = b.dataset.kind === 'bars' ? 'bars' : 'sec';
    b.classList.toggle('on', !!(S.loop && S.loop.type === kind && S.loop.value === v));
  });
  var nm = $('norm-mode'); if (nm) nm.value = S.normMode || 'peak';
  paintStoryTrack();
}

function paintStoryTrack(){
  var track = $('story-track'); if (!track) return;
  var dur = 15;
  try { dur = planLoop().sec; } catch (e) {}
  var n = 44;
  if (track.children.length !== n){
    track.innerHTML = '';
    for (var i = 0; i < n; i++) track.appendChild(document.createElement('i'));
  }
  var on = !!(S.story && S.story.on);
  var fade = Math.min(1.5, dur * 0.2);
  for (var k = 0; k < n; k++){
    var t = dur * k / (n - 1);
    var g = on ? storyGainAt(t, dur) : 0.6;
    var bar = track.children[k];
    bar.style.height = Math.round(3 + g * 23) + 'px';
    bar.className = (on && t > dur - fade) ? 'fade' : '';
  }
}

/* ---------------------------------------------------------------- 5-c. −14 LUFS 감각 측정 (K-weighting 근사) */
function biquadCoef(type, sr, f0, q, dbGain){
  var w0 = 2 * Math.PI * f0 / sr, cw = Math.cos(w0), sw = Math.sin(w0);
  if (type === 'highpass'){
    var alpha = sw / (2 * Math.max(0.05, q));
    var a0 = 1 + alpha;
    return { b0:(1 + cw) / 2 / a0, b1:-(1 + cw) / a0, b2:(1 + cw) / 2 / a0, a1:(-2 * cw) / a0, a2:(1 - alpha) / a0 };
  }
  /* high shelf, S = 1 */
  var A = Math.pow(10, dbGain / 40);
  var alpha2 = sw / 2 * Math.sqrt((A + 1 / A) * (1 / 1 - 1) + 2);
  var ra = Math.sqrt(A);
  var a0s = (A + 1) - (A - 1) * cw + 2 * ra * alpha2;
  return {
    b0: A * ((A + 1) + (A - 1) * cw + 2 * ra * alpha2) / a0s,
    b1: -2 * A * ((A - 1) + (A + 1) * cw) / a0s,
    b2: A * ((A + 1) + (A - 1) * cw - 2 * ra * alpha2) / a0s,
    a1: 2 * ((A - 1) - (A + 1) * cw) / a0s,
    a2: ((A + 1) - (A - 1) * cw - 2 * ra * alpha2) / a0s
  };
}
function measureLufs(buf){
  var sr = buf.sampleRate, n = buf.length, nch = buf.numberOfChannels;
  var hp = biquadCoef('highpass', sr, 38, 0.5, 0);
  var sh = biquadCoef('highshelf', sr, 1500, 0.707, 4);
  var blockLen = Math.max(1, Math.round(sr * 0.4));
  var blocks = Math.floor(n / blockLen);
  if (blocks < 1) return null;
  var sums = new Float64Array(blocks);
  for (var c = 0; c < nch; c++){
    var d = buf.getChannelData(c);
    var x1 = 0, x2 = 0, y1 = 0, y2 = 0, s1 = 0, s2 = 0, t1 = 0, t2 = 0;
    for (var i = 0; i < blocks * blockLen; i++){
      var x = d[i];
      var y = hp.b0 * x + hp.b1 * x1 + hp.b2 * x2 - hp.a1 * y1 - hp.a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      var z = sh.b0 * y + sh.b1 * s1 + sh.b2 * s2 - sh.a1 * t1 - sh.a2 * t2;
      s2 = s1; s1 = y; t2 = t1; t1 = z;
      sums[Math.floor(i / blockLen)] += z * z;
    }
  }
  var lufs = [], denom = nch * blockLen;
  for (var b = 0; b < blocks; b++){
    var ms = sums[b] / denom;
    lufs.push(ms > 0 ? -0.691 + 10 * Math.log10(ms) : -140);
  }
  var absSum = 0, absCnt = 0;
  lufs.forEach(function(l){ if (l > -70){ absSum += Math.pow(10, (l + 0.691) / 10); absCnt++; } });
  if (!absCnt) return null;
  var relTh = -0.691 + 10 * Math.log10(absSum / absCnt) - 10;
  var sum = 0, cnt = 0;
  lufs.forEach(function(l){ if (l > -70 && l > relTh){ sum += Math.pow(10, (l + 0.691) / 10); cnt++; } });
  if (!cnt) return null;
  return -0.691 + 10 * Math.log10(sum / cnt);
}

function encodeWav(buffer, opts){
  opts = (typeof opts === 'boolean') ? { mode: opts ? 'peak' : 'off' } : (opts || {});
  var mode = opts.mode || 'peak';
  var target = opts.target != null ? opts.target : -14;
  var chs = buffer.numberOfChannels, len = buffer.length;
  var data = [];
  for (var c = 0; c < chs; c++) data.push(buffer.getChannelData(c));
  var peak = 0;
  for (var c2 = 0; c2 < chs; c2++) {
    var d = data[c2];
    for (var i = 0; i < len; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; }
  }
  var gain = 1;
  var measured = null;
  if (mode === 'lufs'){
    measured = measureLufs(buffer);
    if (measured != null) gain = clamp(Math.pow(10, (target - measured) / 20), 0.05, 20);
  } else if (mode === 'peak'){
    if (peak > 0.0001) gain = Math.min(4, 0.891 / peak);
  }
  /* 어떤 경우에도 디지털 클리핑은 막는다 (−1dBFS) */
  if (peak * gain > 0.891) gain = 0.891 / Math.max(1e-6, peak);
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
  return { blob: new Blob([arr], { type:'audio/wav' }), peak: peak, gain: gain, bytes: bytes, lufs: measured, target: target, mode: mode };
}

/* 들리는 그대로 오프라인 렌더 + 루프 이음매를 위해 꼬리를 앞에 감아 넣는다 */
function renderLoop(plan){
  var sr = 44100;
  var barSec = barSecAt(plan.bpm);
  var bodySec = plan.bars * barSec;
  var tailSec = Math.min(2.6, Math.max(1.2, barSec));
  var totalSamples = Math.ceil((bodySec + tailSec) * sr);
  var octx = new OfflineAudioContext(2, totalSamples, sr);
  var master = buildMaster(octx, S.master);
  master.out.connect(octx.destination);

  var anySolo = S.tracks.some(function(t){ return t.solo; });
  var nodes = {};
  /* 사이드체인 펌핑도 오프라인에서 같은 그래프로 */
  var pump = octx.createGain(); pump.gain.value = 1; pump.connect(master.in);
  S.tracks.forEach(function(t){
    var audible = !t.mute && (!anySolo || t.solo);
    var gain = octx.createGain(); gain.gain.value = audible ? t.vol : 0;
    var pan = octx.createStereoPanner(); pan.pan.value = t.pan || 0;
    var filt = octx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = instTone(t.inst);
    gain.connect(pan); pan.connect(filt);
    filt.connect((t.role === 'bass' || t.role === 'chords' || t.role === 'vocal') ? pump : master.in);
    nodes[t.id] = gain;
  });

  var sd = barSec / barLen();
  var arrSteps = S.bars * barLen(), loopSteps = plan.bars * barLen();
  var reps = Math.ceil(loopSteps / arrSteps);
  for (var rep = 0; rep < reps; rep++) {
    for (var st = 0; st < arrSteps; st++) {
      var gs = rep * arrSteps + st;
      if (gs >= loopSteps) break;
      /* 라이저도 오프라인 렌더에 포함 — 저장한 WAV 가 들리는 것과 같아진다 */
      if (S.riser && gs % barLen() === 0){
        var rbar = Math.floor(gs / barLen()) % Math.max(1, S.bars);
        if (riserBars().indexOf(rbar) > -1) riserFx(octx, master.in, gs * sd, barLen() * sd);
      }
      var list = S.events[st];
      if (!list || !list.length) continue;
      for (var i = 0; i < list.length; i++) {
        var ev = list[i], trk = S.tracks[ev.t];
        if (!trk || !nodes[trk.id]) continue;
        var tAt = gs * sd + (ev.jit || 0) * sd;
        if (S.pump && trk.role === 'drums' && ev.row === 'kick') pumpAt(octx, pump, tAt);
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
    /* 쇼츠 기승전결 — 저장 파일에 실제로 입힌다 (잔잔한 인트로 → 빌드업 → 드롭 → 1.5초 페이드아웃) */
    if (S.story && S.story.on) applyStoryEnvelope(out);
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

/* 렌더 한 번으로 WAV · 경량 오디오 · 쇼츠 넘기기가 모두 같은 소리를 쓴다 */
function renderForExport(){
  var plan = refreshLoopInfo();
  var t0 = performance.now();
  setExportProgress(6, '악기 샘플을 확인하는 중…');
  return ensureAudio()
    .then(function(){ return loadNeeded(null); })
    .then(function(){
      setExportProgress(30, '오프라인으로 렌더링하는 중… (' + plan.bars + '마디 / ' + plan.sec.toFixed(1) + '초' +
        (S.story && S.story.on ? ' · 기승전결' : '') + ')');
      return new Promise(function(r){ setTimeout(r, 40); });
    })
    .then(function(){ return renderLoop(plan); })
    .then(function(buf){ return { buf:buf, plan:plan, t0:t0 }; });
}

function normText(enc){
  if (enc.mode === 'lufs'){
    return '−' + Math.abs(Math.round(enc.target)) + ' LUFS 감각' + (enc.lufs != null ? ' (측정 ' + enc.lufs.toFixed(1) + ')' : '') +
      ' · 게인 ' + (20 * Math.log10(enc.gain)).toFixed(1) + 'dB';
  }
  if (enc.mode === 'peak') return '피크 −1dBFS 정규화 · 게인 ' + (20 * Math.log10(enc.gain)).toFixed(1) + 'dB';
  return '정규화 없음';
}

function exportWav(){
  if (exporting) return;
  var btn = $('btn-export-wav');
  exporting = true;
  if (btn) btn.disabled = true;
  renderForExport()
    .then(function(o){
      setExportProgress(88, 'WAV 로 만드는 중…');
      var enc = encodeWav(o.buf, { mode:(S.normMode || 'peak'), target: -14 });
      var name = 'AURA_' + o.plan.bpm + 'bpm_' + o.plan.sec.toFixed(1) + 's' + (S.story && S.story.on ? '_shorts' : '_loop') + '.wav';
      downloadBlob(enc.blob, name);
      var secs = ((performance.now() - o.t0) / 1000).toFixed(1);
      var pk = 20 * Math.log10(Math.max(enc.peak * enc.gain, 1e-6));
      setExportProgress(100, '완료 · ' + (enc.bytes / 1024 / 1024).toFixed(2) + 'MB · ' + normText(enc) +
        ' · 피크 ' + pk.toFixed(1) + 'dBFS (' + secs + '초)');
      toast('WAV 저장 완료 · ' + o.plan.sec.toFixed(1) + '초 ' + name, 'ok');
      setTimeout(function(){ setExportProgress(null); }, 4000);
    })
    .catch(function(e){
      console.error(e);
      setExportProgress(null);
      toast('WAV 렌더 실패: ' + (e && e.message || e), 'err');
    })
    .then(function(){ exporting = false; if (btn) btn.disabled = false; });
}

/* ---------------------------------------------------------------- 경량 오디오 (WebM/OGG Opus) */
function opusMime(){
  if (typeof MediaRecorder === 'undefined') return '';
  var cands = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
  for (var i = 0; i < cands.length; i++){
    try { if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(cands[i])) return cands[i]; } catch (e) {}
  }
  return '';
}

/* 오프라인 렌더 버퍼 → Opus. MediaRecorder는 실시간이라 곱 길이만큼 걸린다 */
function encodeOpusBlob(buf, onProgress){
  return new Promise(function(resolve, reject){
    var mime = opusMime();
    if (!mime) { reject(new Error('이 브라우저는 경량 오디오(Opus) 녹음을 지원하지 않습니다 — WAV로 저장해 주세요')); return; }
    ensureAudio().then(function(ctx){
      var dest = ctx.createMediaStreamDestination();
      var src = ctx.createBufferSource(); src.buffer = buf;
      var g = ctx.createGain(); g.gain.value = 1;
      src.connect(g); g.connect(dest);
      var chunks = [], stopped = false;
      var rec;
      try { rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 96000 }); }
      catch (e) { reject(e); return; }
      rec.ondataavailable = function(e){ if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function(){
        var type = mime.indexOf('ogg') > -1 ? 'audio/ogg' : 'audio/webm';
        resolve(new Blob(chunks, { type: type }));
      };
      var t0 = performance.now();
      var iv = setInterval(function(){
        var done = Math.min(1, (performance.now() - t0) / 1000 / Math.max(0.5, buf.duration));
        if (onProgress) onProgress(20 + 70 * done, '경량 오디오(Opus)로 변환 중… ' + Math.round(done * 100) + '%');
      }, 240);
      var finish = function(){
        if (stopped) return;
        stopped = true;
        clearInterval(iv);
        setTimeout(function(){ try { rec.stop(); } catch (e) {} }, 260);
      };
      src.onended = finish;
      setTimeout(finish, Math.round(buf.duration * 1000) + 1200);
      rec.start(120);
      try { ctx.resume(); } catch (e) {}
      src.start(0);
    }).catch(reject);
  });
}

function exportWebm(){
  if (exporting) return;
  var btn = $('btn-export-webm');
  exporting = true;
  if (btn) btn.disabled = true;
  renderForExport()
    .then(function(o){
      setExportProgress(20, '경량 오디오로 바꾸는 중… (실시간 · ' + Math.ceil(o.plan.sec) + '초)');
      return encodeOpusBlob(o.buf, function(p, m){ setExportProgress(p, m); }).then(function(blob){ return { blob:blob, plan:o.plan, t0:o.t0, wavBytes: o.buf.length * o.buf.numberOfChannels * 2 }; });
    })
    .then(function(r){
      var ext = (r.blob.type || '').indexOf('ogg') > -1 ? 'ogg' : 'webm';
      var name = 'AURA_' + r.plan.bpm + 'bpm_' + r.plan.sec.toFixed(1) + 's' + (S.story && S.story.on ? '_shorts' : '_loop') + '.' + ext;
      downloadBlob(r.blob, name);
      var mb = (r.blob.size / 1024 / 1024);
      var save = Math.max(0, Math.round((1 - r.blob.size / Math.max(1, r.wavBytes)) * 100));
      setExportProgress(100, '완료 · ' + (r.blob.size / 1024).toFixed(0) + 'KB (WAV 대비 −' + save + '%) · 폰에서 바로 쓰기 좋은 크기');
      toast('경량 오디오 저장 · ' + (mb < 1 ? (r.blob.size / 1024).toFixed(0) + 'KB' : mb.toFixed(1) + 'MB'), 'ok');
      setTimeout(function(){ setExportProgress(null); }, 4500);
    })
    .catch(function(e){
      console.error(e);
      setExportProgress(null);
      toast('경량 오디오 실패: ' + (e && e.message || e), 'err');
    })
    .then(function(){ exporting = false; if (btn) btn.disabled = false; });
}

/* ---------------------------------------------------------------- 쇼츠 편집기로 바로 넘기기 */
var SHORTS_URL = 'https://hwen21c-tech.github.io/shorts-studio-pro/';
var HANDOFF_KEY = 'aura_handoff_bgm';
var handoffBusy = false;

function idbOpen(){
  return new Promise(function(resolve, reject){
    if (!window.indexedDB) { reject(new Error('IndexedDB 없음')); return; }
    var rq = indexedDB.open('aura_studio', 1);
    rq.onupgradeneeded = function(){ var db = rq.result; if (!db.objectStoreNames.contains('handoff')) db.createObjectStore('handoff'); };
    rq.onsuccess = function(){ resolve(rq.result); };
    rq.onerror = function(){ reject(rq.error || new Error('IndexedDB 열기 실패')); };
  });
}
function idbPut(key, val){
  return idbOpen().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction('handoff', 'readwrite');
      tx.objectStore('handoff').put(val, key);
      tx.oncomplete = function(){ try { db.close(); } catch (e) {} resolve(true); };
      tx.onerror = function(){ reject(tx.error || new Error('저장 실패')); };
    });
  });
}
function idbGet(key){
  return idbOpen().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction('handoff', 'readonly');
      var rq = tx.objectStore('handoff').get(key);
      rq.onsuccess = function(){ try { db.close(); } catch (e) {} resolve(rq.result || null); };
      rq.onerror = function(){ reject(rq.error); };
    });
  });
}

/* 호환용 경량 데이터 URL — 22kHz 모노 WAV(내려받기 없이 겁내기 위함) */
function compactWavDataUrl(buf, rate){
  rate = rate || 22050;
  var ratio = buf.sampleRate / rate;
  var outLen = Math.max(1, Math.floor(buf.length / ratio));
  var ab = new ArrayBuffer(44 + outLen * 2);
  var view = new DataView(ab);
  var ws = function(o, s){ for (var i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); view.setUint32(4, 44 - 8 + outLen * 2, true); ws(8, 'WAVE');
  ws(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ws(36, 'data'); view.setUint32(40, outLen * 2, true);
  var d0 = buf.getChannelData(0);
  var d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0;
  var off = 44;
  for (var i2 = 0; i2 < outLen; i2++){
    var pos = i2 * ratio, i0 = Math.floor(pos), fr = pos - i0;
    var a = (d0[i0] || 0) * (1 - fr) + (d0[i0 + 1] || 0) * fr;
    var b = (d1[i0] || 0) * (1 - fr) + (d1[i0 + 1] || 0) * fr;
    var v = Math.max(-1, Math.min(1, (a + b) / 2));
    view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7FFF, true);
    off += 2;
  }
  var bytes = new Uint8Array(ab), chunk = 0x8000, parts = [];
  for (var k = 0; k < bytes.length; k += chunk){
    parts.push(String.fromCharCode.apply(null, bytes.subarray(k, k + chunk)));
  }
  return 'data:audio/wav;base64,' + btoa(parts.join(''));
}

function handoffToShorts(){
  if (handoffBusy) return;
  handoffBusy = true;
  var btn = $('btn-to-shorts');
  if (btn) btn.disabled = true;
  var tab = null;
  try { tab = window.open('', '_blank'); } catch (e) {}   /* 팝업 차단을 피하려고 클릭 순간에 미리 연다 */
  renderForExport()
    .then(function(o){
      setExportProgress(70, '쇼츠 편집기로 넘기는 중…');
      var enc = encodeWav(o.buf, { mode:'lufs', target: -14 });
      var ext = '';
      var name = 'AURA_' + o.plan.bpm + 'bpm_' + o.plan.sec.toFixed(1) + 's_shorts' + ext + '.wav';
      var meta = {
        v: 1,
        src: 'aura-studio-pro',
        at: Date.now(),
        name: name,
        mime: 'audio/wav',
        kind: 'bgm',
        duration: +o.plan.sec.toFixed(3),
        bpm: o.plan.bpm,
        key: NOTE_NAMES[S.key],
        keyLabel: KEY_LABEL[S.key],
        keyIndex: S.key,
        mode: S.mode,
        scaleLabel: SCALE_LABEL[S.mode] || S.mode,
        preset: S.preset,
        title: S.aiTitle || 'AURA BGM',
        story: !!(S.story && S.story.on),
        lufs: enc.lufs != null ? +enc.lufs.toFixed(1) : null,
        size: enc.bytes,
        storage: 'idb'
      };
      /* 15초 이하는 데이터 URL 을 같이 넣어 둔다 — 수신 측이 IndexedDB 를 안 읽어도 바로 쓸 수 있게 */
      if (o.plan.sec <= 15.5){
        try {
          var du = compactWavDataUrl(o.buf, 22050);
          if (du.length <= 1000000){ meta.dataUrl = du; meta.dataMime = 'audio/wav'; meta.dataNote = '22kHz 모노 경량본'; }
        } catch (e) {}
      }
      var rec = {
        blob: enc.blob, audio: enc.blob, meta: meta,
        name: meta.name, mime: meta.mime, duration: meta.duration, bpm: meta.bpm,
        key: meta.key, keyIndex: meta.keyIndex, mode: meta.mode, title: meta.title,
        at: meta.at, size: meta.size, story: meta.story, lufs: meta.lufs, dataUrl: meta.dataUrl || null
      };
      return idbPut(HANDOFF_KEY, rec)
        .then(function(){ return meta; })
        .catch(function(e){
          /* IndexedDB가 막힌 환경 — 데이터 URL로라도 넘긴다 */
          return new Promise(function(resolve){
            var fr = new FileReader();
            fr.onload = function(){ meta.storage = 'dataUrl'; meta.dataUrl = String(fr.result); resolve(meta); };
            fr.onerror = function(){ resolve(meta); };
            fr.readAsDataURL(enc.blob);
          });
        });
    })
    .then(function(meta){
      try { localStorage.setItem(HANDOFF_KEY, JSON.stringify(meta)); }
      catch (e) {
        /* 저장 공간이 모자라면 데이터 URL 없이라도 남긴다 */
        try { var slim = Object.assign({}, meta); delete slim.dataUrl; localStorage.setItem(HANDOFF_KEY, JSON.stringify(slim)); } catch (e2) {}
      }
      var url = SHORTS_URL + '?from=aura&t=' + Date.now();
      if (tab && !tab.closed) { try { tab.location.href = url; } catch (e) { tab = null; } }
      if (!tab) { try { tab = window.open(url, '_blank'); } catch (e2) { tab = null; } }
      if (!tab) { location.href = url; }
      setExportProgress(100, '넘겼습니다 · 쇼츠 편집기의 BGM 칸에 들어갑니다');
      toast('쇼츠 편집기로 BGM을 넘겼습니다 · ' + meta.duration.toFixed(1) + '초 · ' + normText({ mode:'lufs', target:-14, lufs:meta.lufs, gain:1 }), 'ok');
      setTimeout(function(){ setExportProgress(null); }, 4200);
    })
    .catch(function(e){
      console.error(e);
      setExportProgress(null);
      try { if (tab && !tab.closed) tab.close(); } catch (e2) {}
      toast('쇼츠로 넘기기 실패: ' + (e && e.message || e), 'err');
    })
    .then(function(){ handoffBusy = false; if (btn) btn.disabled = false; });
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
  var barTicks = tpq * beatsPerBar();
  var secPerBeat = 60 / plan.bpm;
  var secs = plan.bars * beatsPerBar() * secPerBeat;
  var tracksOut = [];
  var seq = 0;

  function collect(role, channel, program){
    var evs = [], t = S.tracks.filter(function(x){ return x.role === role; })[0];
    if (!t) return null;
    var chBase = channel;
    var arrSteps = S.bars * barLen(), loopSteps = plan.bars * barLen(), reps = Math.ceil(loopSteps / arrSteps);
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
  var t6 = collect('vocal', 4, 53);
  [t1, t2, t3, t4, t5, t6].forEach(function(t){ if (t) tracksOut.push(t); });
  if (!tracksOut.length) { toast('먼저 곡을 만들어 주세요', 'warn'); return; }

  var usPerQuarter = Math.round(60000000 / plan.bpm);
  var tempoBytes = [0xFF, 0x51, 0x03, (usPerQuarter >> 16) & 0xFF, (usPerQuarter >> 8) & 0xFF, usPerQuarter & 0xFF];
  var meta = [{ tick:0, seq:-9, bytes: tempoBytes },
              { tick:0, seq:-8, bytes:[0xFF, 0x58, 0x04, beatsPerBar(), 0x02, 0x18, 0x08] }];
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
    meter:S.meter, rhythm:S.rhythm, rhythmAuto:!!S.rhythmAuto,
    bright:S.bright, energy:S.energy, swing:S.swing, humanize:S.humanize, fill:S.fill,
    energyCurve:S.energyCurve, chords:S.chords, notes:S.notes, bass:S.bass, arp:S.arp, drums:S.drums, vocal:S.vocal,
    hum:S.hum, tracks:S.tracks.map(function(t){ return { id:t.id, inst:t.inst, vol:t.vol, pan:t.pan, mute:t.mute, solo:t.solo, locked:!!t.locked }; }),
    master:S.master, loop:S.loop, riser:S.riser, breakdown:S.breakdown,
    amb:S.amb, script:S.script, duck:S.duck, duckDepth:S.duckDepth, xy:S.xy, roll:S.roll, pump:S.pump
  };
}
function applyProject(p){
  if (!p || !p.chords) { toast('프로젝트 파일을 읽을 수 없습니다', 'err'); return false; }
  S.bpm = p.bpm || S.bpm; S.key = p.key != null ? p.key : S.key; S.mode = p.mode || S.mode;
  S.bars = p.bars || S.bars; S.preset = p.preset || S.preset;
  S.meter = p.meter === 3 ? 3 : 4;
  if (p.rhythm && rhythmOf(p.rhythm)) S.rhythm = p.rhythm;
  S.rhythmAuto = p.rhythmAuto !== false;
  S.prog = p.prog || S.prog; S.ext = p.ext || S.ext;
  S.bright = p.bright != null ? p.bright : S.bright;
  S.energy = p.energy != null ? p.energy : S.energy;
  S.swing = p.swing != null ? p.swing : S.swing;
  S.humanize = p.humanize !== false; S.fill = p.fill !== false;
  S.energyCurve = p.energyCurve && p.energyCurve.length === 16 ? p.energyCurve : defaultCurve('standard');
  S.chords = p.chords || []; S.notes = p.notes || []; S.bass = p.bass || []; S.arp = p.arp || [];
  S.drums = p.drums || []; S.hum = p.hum || new Array(16).fill(null);
  S.vocal = p.vocal || [];
  if (p.riser != null) S.riser = !!p.riser;
  if (p.breakdown != null) S.breakdown = !!p.breakdown;
  if (p.amb) ['rain','fire','cafe','ocean'].forEach(function(k){ if (p.amb[k] != null) S.amb[k] = clamp(+p.amb[k] || 0, 0, 100); });
  if (Array.isArray(p.script) && p.script.length) S.script = p.script.map(String).slice(0, 24);
  if (p.duck != null) S.duck = !!p.duck;
  if (p.duckDepth != null) S.duckDepth = clamp(+p.duckDepth || 60, 20, 85);
  if (p.xy && p.xy.x != null && p.xy.y != null) S.xy = { x:clamp(+p.xy.x, 0, 1), y:clamp(+p.xy.y, 0, 1) };
  if (p.roll != null) S.roll = clamp(+p.roll || 0, 0, 100);
  if (p.pump != null) S.pump = !!p.pump;
  S.master = Object.assign(S.master, p.master || {});
  S.loop = p.loop || S.loop;
  if (p.tracks) p.tracks.forEach(function(t){
    var cur = S.tracks.filter(function(x){ return x.id === t.id; })[0];
    if (cur) { cur.inst = t.inst || cur.inst; cur.vol = t.vol != null ? t.vol : cur.vol; cur.pan = t.pan != null ? t.pan : cur.pan; cur.mute = !!t.mute; cur.solo = !!t.solo; cur.locked = !!t.locked; }
  });
  if (p.title) { S.aiTitle = p.title; }
  rebuildEvents();
  syncPresetUI();
  renderMixer();
  refreshStats();
  refreshLoopInfo();
  drawAll();
  updateSamplerStatus();
  if (typeof renderDrumSeq === 'function') renderDrumSeq();
  if (typeof renderVocalBadge === 'function') renderVocalBadge();
  if (typeof renderAmb === 'function') renderAmb();
  if (typeof renderTeleprompter === 'function') renderTeleprompter();
  if (typeof drawXYPad === 'function') drawXYPad();
  if (typeof syncV6Controls === 'function') syncV6Controls();
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
  var cols = curveBars();
  var barW = W / cols, pad = 8 * d;
  c.font = '600 ' + (9.5 * d) + 'px "Pretendard Variable", Pretendard, sans-serif';
  for (var i = 0; i < cols; i++) {
    var on = i < S.bars;
    c.strokeStyle = i % 4 === 0 ? P.beat : P.gridSoft;
    c.beginPath(); c.moveTo(i * barW, 0); c.lineTo(i * barW, H); c.stroke();
    if (i % 4 === 0) { c.fillStyle = P.tx2; c.fillText('BAR ' + (i + 1), i * barW + 4 * d, 13 * d); }
  }
  var curBar = AU.playing ? Math.floor(S.step / barLen()) % Math.max(1, S.bars) : -1;
  for (var b = 0; b < cols; b++) {
    var v = curveValueAt(b);
    var bh = Math.max(4 * d, v * (H - 26 * d));
    c.fillStyle = b === curBar ? P.barOn : (b < S.bars ? P.bar : 'rgba(148,163,184,.12)');
    c.fillRect(b * barW + 3 * d, H - bh, barW - 6 * d, bh);
  }
  c.strokeStyle = P.line; c.lineWidth = 1.6 * d; c.beginPath();
  for (var k = 0; k < cols; k++) {
    var vv = curveValueAt(k);
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
  var cols = S.rollBars * barLen(), rows = ROLL_HIGH - ROLL_LOW + 1;
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
    c.strokeStyle = i % barLen() === 0 ? P.beat : (i % 4 === 0 ? P.grid : P.gridSoft);
    c.beginPath(); c.moveTo(i * cw, 0); c.lineTo(i * cw, H); c.stroke();
  }
  for (var r2 = 0; r2 <= rows; r2++) {
    c.strokeStyle = P.gridSoft; c.beginPath(); c.moveTo(0, r2 * rh); c.lineTo(W, r2 * rh); c.stroke();
  }
  var endBar = S.rollStart + S.rollBars;
  S.notes.forEach(function(n){
    if (n.bar < S.rollStart || n.bar >= endBar) return;
    if (n.midi < ROLL_LOW || n.midi > ROLL_HIGH) return;
    var col = (n.bar - S.rollStart) * barLen() + n.step;
    var row = ROLL_HIGH - n.midi;
    var x = col * cw, y = row * rh;
    var w = Math.max(cw * 0.92, (n.dur || 1) * cw - 1);
    c.fillStyle = P.note;
    c.globalAlpha = clamp(0.55 + (n.vel || .7) * 0.45, .4, 1);
    c.fillRect(x + 1, y + 1, w, rh - 2);
    c.globalAlpha = 1;
  });
  if (AU.playing) {
    var st = S.step % (S.bars * barLen());
    var barNow = Math.floor(st / barLen()), stepNow = st % barLen();
    if (barNow >= S.rollStart && barNow < endBar) {
      var px = ((barNow - S.rollStart) * barLen() + stepNow) * cw;
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
  var BL = barLen();
  var gutter = 46 * d, cw = (W - gutter) / BL, rh = H / DRUM_ROWS.length;
  c.font = '700 ' + (9 * d) + 'px "Pretendard Variable", Pretendard, sans-serif';
  DRUM_ROWS.forEach(function(row, ri){
    c.fillStyle = P.tx2;
    c.fillText(row.label, 5 * d, ri * rh + rh * 0.66);
    for (var s = 0; s < BL; s++) {
      var x = gutter + s * cw, y = ri * rh;
      var hit = S.drums.some(function(n){ return n.bar === S.drumBar && n.step === s && n.row === row.id; });
      c.fillStyle = hit ? (ri === 0 ? P.note : ri === 1 ? P.note2 : P.accent) : (s % 4 === 0 ? 'rgba(148,163,184,.10)' : 'rgba(148,163,184,.04)');
      c.globalAlpha = hit ? 0.95 : 1;
      c.fillRect(x + 1.5 * d, y + 2 * d, cw - 3 * d, rh - 4 * d);
      c.globalAlpha = 1;
    }
  });
  for (var i = 0; i <= BL; i++) {
    c.strokeStyle = i % 4 === 0 ? P.beat : P.gridSoft;
    c.beginPath(); c.moveTo(gutter + i * cw, 0); c.lineTo(gutter + i * cw, H); c.stroke();
  }
  var lab = $('drum-bar-label');
  if (lab) lab.textContent = (S.drumBar + 1) + '마디';
  /* 지금 소리 나는 16분 칸 표시 */
  if (AU.playing && Math.floor(S.step / barLen()) % Math.max(1, S.bars) === S.drumBar) {
    var live = S.step % barLen();
    c.strokeStyle = 'rgba(244,63,94,.9)'; c.lineWidth = 1.6 * d;
    c.strokeRect(gutter + live * cw + 0.8 * d, 0, cw - 1.6 * d, H);
  }
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
  if (typeof drawXYPad === 'function') drawXYPad();
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
    var cols = S.rollBars * barLen(), rows = ROLL_HIGH - ROLL_LOW + 1;
    var col = clamp(Math.floor(p.x * cols), 0, cols - 1);
    var row = clamp(Math.floor(p.y * rows), 0, rows - 1);
    var bar = S.rollStart + Math.floor(col / barLen()), step = col % barLen();
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
    var col = clamp(Math.floor((p.x - gutter) / (1 - gutter) * barLen()), 0, barLen() - 1);
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
  if (d.kind === 'synth' || d.kind === 'drumkit') return '<span class="slot synth">신스</span>';
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
        '<button class="lock' + (t.locked ? ' on' : '') + '" data-lock="' + i + '" aria-label="트랙 잠금" title="잠그면 리믹스에서 제외">' + (t.locked ? '🔒' : '🔓') + '</button>' +
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

  box.querySelectorAll('[data-lock]').forEach(function(b){
    b.addEventListener('click', function(){
      var t = S.tracks[+b.dataset.lock]; t.locked = !t.locked;
      renderMixer(); saveSettings();
      toast(t.name + ' 트랙을 ' + (t.locked ? '잠갔습니다 🔒 (리믹스에서 제외)' : '풀었습니다 🔓'));
    });
  });
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
    S.mode = SCALES[e.target.value] ? e.target.value : 'minor';
    S.chords = []; composeAll(Date.now() & 0xffff, { newChords: true });
    refreshScaleHint(); updatePrompt(); refreshStats(); drawAll(); saveSettings();
  });

  /* 템포 프리셋 — 쇼츠·브리핑·힐링 */
  Array.prototype.forEach.call(document.querySelectorAll('[data-bpm]'), function(btn){
    btn.addEventListener('click', function(){
      var v = clamp(+btn.dataset.bpm || 105, 60, 170);
      S.bpm = v;
      var a = $('bpm-slider'); if (a) a.value = v;
      var b = $('header-bpm'); if (b) b.value = v;
      var c = $('bpm-val'); if (c) c.textContent = v;
      Array.prototype.forEach.call(document.querySelectorAll('[data-bpm]'), function(b2){ b2.classList.toggle('on', b2 === btn); });
      updatePrompt(); refreshStats(); refreshLoopInfo(); saveSettings();
      toast(v + ' BPM 맞춤 · ' + (v === 124 ? '빠른 썰·쇼츠' : v === 105 ? '정보·브리핑' : '감성·힐링'), 'ok');
    });
  });

  /* 분위기별 코드 진행 1클릭 변주 */
  Array.prototype.forEach.call(document.querySelectorAll('[data-vary]'), function(btn){
    btn.addEventListener('click', function(){
      var v = MOOD_VARIATIONS[btn.dataset.vary];
      applyMoodVariation(btn.dataset.vary);
      var badge = $('vary-badge');
      if (badge && v){ badge.textContent = v.label; badge.className = 'badge ok'; }
    });
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
      S.story = { on:false, len:(S.story && S.story.len) || 15 };
      Array.prototype.forEach.call(document.querySelectorAll('[data-loop]'), function(b2){ b2.classList.toggle('on', b2 === btn); });
      refreshLoopInfo(); renderStoryUI(); saveSettings();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-story]'), function(btn){
    btn.addEventListener('click', function(){ setStoryLength(+btn.dataset.story); });
  });
  var cs = $('chk-story');
  if (cs) cs.addEventListener('change', function(){
    S.story = { on: cs.checked, len: (S.story && S.story.len) || 15 };
    if (cs.checked && (!S.loop || S.loop.type !== 'sec' || [15,30,60].indexOf(+S.loop.value) < 0)){
      S.loop = { type:'sec', value: S.story.len };
    }
    refreshLoopInfo(); renderStoryUI(); saveSettings();
    if (AU.playing) scheduleStoryGain(AU.ctx.currentTime + 0.05);
  });
  var nm = $('norm-mode');
  if (nm) nm.addEventListener('change', function(){ S.normMode = nm.value; saveSettings(); });
  var ex = $('chk-exactsec');
  if (ex) ex.addEventListener('change', function(){ S.exactSec = ex.checked; refreshLoopInfo(); saveSettings(); });
  $('btn-export-wav').addEventListener('click', exportWav);
  var bw = $('btn-export-webm');
  if (bw) bw.addEventListener('click', exportWebm);
  var bs = $('btn-to-shorts');
  if (bs) bs.addEventListener('click', handoffToShorts);
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
  Array.prototype.forEach.call(document.querySelectorAll('main > section'), function(sec){
    sec.classList.toggle('hidden', sec.id !== 'tab-' + name);
  });
  /* 영상 탭을 떠나면 미리보기를 멈춘다 — 다른 작업과 동시에 디코딩하지 않게 */
  if (name !== 'video' && typeof pauseVideoPreview === 'function') pauseVideoPreview();
  setTimeout(function(){
    drawAll();
    if (name === 'play' && typeof renderDrumSeq === 'function') renderDrumSeq();
    if (name === 'narr' && typeof renderTeleprompter === 'function') renderTeleprompter();
    if (name === 'mix' && typeof renderAmb === 'function') { renderAmb(); ambApply(); }
    if (name === 'video' && typeof drawVideoPoster === 'function') drawVideoPoster();
    if (name === 'export' && typeof renderStoryUI === 'function') { renderStoryUI(); paintStoryTrack(); }
    if (name === 'compose' && typeof refreshScaleHint === 'function') refreshScaleHint();
  }, 40);
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
      for (var s = 0; s < barLen(); s++) {
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
  var iv = scaleIv(S.mode);
  var base = HUM_LOW + 4;
  var pick2 = [0, 2, 4, 3, 2, 4, 6, 4];
  S.hum = new Array(16).fill(null);
  pick2.forEach(function(d, i){
    S.hum[i * 2] = base + ivAt(iv, d);
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
      normMode:S.normMode, story:S.story,
      script:S.script, amb:S.amb, duck:S.duck, duckDepth:S.duckDepth, kbOct:S.kbOct,
      xy:S.xy, roll:S.roll, pump:S.pump, riser:S.riser, breakdown:S.breakdown,
      rhythm:S.rhythm, rhythmAuto:!!S.rhythmAuto, meter:S.meter,
      tracks:S.tracks.map(function(t){ return { id:t.id, inst:t.inst, vol:t.vol, pan:t.pan, mute:t.mute, solo:t.solo, locked:!!t.locked }; })
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
    if (s.normMode) S.normMode = ['peak','lufs','off'].indexOf(s.normMode) > -1 ? s.normMode : 'peak';
    if (s.story && typeof s.story === 'object') S.story = { on: !!s.story.on, len: [15,30,60].indexOf(+s.story.len) > -1 ? +s.story.len : 15 };
    if (Array.isArray(s.script) && s.script.length) S.script = s.script.map(String).slice(0, 24);
    if (s.amb && typeof s.amb === 'object') {
      ['rain','fire','cafe','ocean'].forEach(function(k){ if (s.amb[k] != null) S.amb[k] = clamp(+s.amb[k] || 0, 0, 100); });
    }
    if (s.duck != null) S.duck = !!s.duck;
    if (s.duckDepth != null) S.duckDepth = clamp(+s.duckDepth || 60, 20, 85);
    if (s.kbOct != null) S.kbOct = clamp(+s.kbOct || 4, 2, 6);
    if (s.xy && s.xy.x != null && s.xy.y != null) S.xy = { x: clamp(+s.xy.x, 0, 1), y: clamp(+s.xy.y, 0, 1) };
    if (s.roll != null) S.roll = clamp(+s.roll || 0, 0, 100);
    if (s.pump != null) S.pump = !!s.pump;
    if (s.riser != null) S.riser = !!s.riser;
    if (s.breakdown != null) S.breakdown = !!s.breakdown;
    if (s.rhythm && rhythmOf(s.rhythm)) S.rhythm = s.rhythm;
    if (s.rhythmAuto != null) S.rhythmAuto = !!s.rhythmAuto;
    if (s.meter != null) S.meter = (s.meter === 3) ? 3 : 4;
    if (s.tracks) s.tracks.forEach(function(t){
      var cur = S.tracks.filter(function(x){ return x.id === t.id; })[0];
      if (cur) { cur.inst = t.inst || cur.inst; cur.vol = t.vol != null ? t.vol : cur.vol; cur.pan = t.pan != null ? t.pan : cur.pan; cur.mute = !!t.mute; cur.solo = !!t.solo; cur.locked = !!t.locked; }
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
  $('chk-normalize') && ($('chk-normalize').checked = S.normalize !== false);
  var nms = $('norm-mode'); if (nms) nms.value = S.normMode || 'peak';
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
  var rs = $('roll-slider'); if (rs) rs.value = S.roll;
  var rv = $('roll-val'); if (rv) rv.textContent = S.roll;
  if (typeof syncV8Controls === 'function') syncV8Controls();
  if (typeof syncV6Controls === 'function') syncV6Controls();
  if (typeof renderStoryUI === 'function') renderStoryUI();
  if (typeof drawXYPad === 'function') drawXYPad();
  if (typeof renderSoundPalette === 'function') renderSoundPalette();
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

  /* 공유 링크(#song=...)로 열었으면 그 곡으로 복원 */
  if (typeof decodeSongFromHash === 'function' && decodeSongFromHash()) {
    syncPresetUI(); applyStateToUI(); renderMixer(); refreshStats(); refreshLoopInfo(); drawAll();
    if (typeof renderTeleprompter === 'function') renderTeleprompter();
    if (typeof renderDrumSeq === 'function') renderDrumSeq();
    if (typeof renderAmb === 'function') renderAmb();
    if (AU.ctx && typeof ambApply === 'function') ambApply();
    toast('공유 링크의 곡을 불러왔습니다', 'ok');
  }
  if (typeof initV8 === 'function') initV8();
  if (typeof initV6 === 'function') initV6();
  if (typeof initExtras === 'function') initExtras();
  if (typeof bindSoundPalette === 'function') bindSoundPalette();

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
    if (tb && ['compose','seq','play','hum','narr','video','mix','export'].indexOf(tb) >= 0) switchTab(tb);
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
  exportWebm: exportWebm,
  exportMidi: exportMidi,
  handoff: handoffToShorts,
  setStory: setStoryLength,
  storyGain: storyGainAt,
  storyStats: function(){ return renderForExport().then(function(o){ return audioWindowStats(o.buf); }); },
  lufs: measureLufs,
  analyze: function(mode){ return renderForExport().then(function(o){ var enc = encodeWav(o.buf, { mode: mode || 'lufs', target: -14 }); return { plan:{ bars:o.plan.bars, bpm:o.plan.bpm, sec:o.plan.sec }, lufs:enc.lufs, gain:enc.gain, peak:enc.peak, stats:audioWindowStats(o.buf), bytes:enc.bytes }; }); },
  vary: applyMoodVariation,
  handoffGet: function(){ return idbGet(HANDOFF_KEY); },
  scaleOf: function(mode){ return SCALES[mode] || null; },
  switchTab: switchTab,
  share: function(){ return encodeSongToHash(); },
  shareNow: function(){ return shareSong(); },
  fitVideo: autoFitSongFormToVideo,
  mux: function(sec){ return exportMuxedVideoWithBgm(sec); },
  sampleDuck: playSampleNarrationCadence,
  toggleDrumCell: function(row, step){ return drumToggle(row, step); },
  /* v10 — 사운드 팔레트 */
  rhythm: applyRhythm,
  kit: applyDrumKit,
  lead: applyLeadTone,
  rhythms: function(){ return RHYTHMS.map(function(r){ return { id:r.id, name:r.name, meter:r.meter, swing:r.swing, swingNow:r.swing != null ? r.swing : 0, bass:r.bass, comp:r.comp, arpPat:r.arpPat, A:r.pat.A, B:r.pat.B }; }); },
  kits: function(){ return KIT_TONES.slice(); },
  kitParams: function(){ return DRUM_KITS; },
  leads: function(){ return LEAD_TONES.slice(); },
  instKind: function(id){ return INST[id] ? INST[id].kind : null; },
  /* 한 악기·킷·리듬의 소리를 오프라인으로 짧게 뽑아 파형 지문을 낸다 (다르면 지문도 다르다) */
  probe: function(opts){
    opts = opts || {};
    var sr = 44100, secs = opts.secs || 2.0;
    var octx = new OfflineAudioContext(1, Math.ceil(sr * secs), sr);
    var out = octx.createGain(); out.gain.value = 0.9; out.connect(octx.destination);
    var def = INST[opts.inst];
    if (!def) return Promise.reject(new Error('no inst ' + opts.inst));
    if (def.kind === 'drumkit'){
      var rows = opts.rows || ['kick','snare','hat','ohat'];
      rows.forEach(function(row, i){ synthDrumKit(octx, out, def, row, 0.02 + i * (secs / rows.length), 0.9); });
    } else if (def.kind === 'synth'){
      var midis = opts.midis || [60, 64, 67];
      midis.forEach(function(m, i){ synthVoice(octx, out, def, m, 0.02 + i * (secs / midis.length), secs / midis.length - 0.05, 0.85); });
    } else {
      return Promise.reject(new Error('probe needs synth/drumkit: ' + opts.inst));
    }
    return octx.startRendering().then(function(buf){
      var d = buf.getChannelData(0), peak = 0, sum = 0, zc = 0, prev = 0, wsum = 0, wsum2 = 0, n = 0;
      var hp = 0;
      for (var i = 0; i < d.length; i += 4){
        var v = d[i], a = Math.abs(v);
        if (a > peak) peak = a;
        sum += v * v;
        if ((v >= 0) !== (prev >= 0)) zc++;
        hp = 0.85 * (hp + v - prev);   /* 대략적 고역 성분 */
        wsum += Math.abs(hp); wsum2 += v * v; n++;
        prev = v;
      }
      return { inst:opts.inst, peak: Math.round(peak * 1000) / 1000, rms: Math.round(Math.sqrt(sum / Math.max(1, n)) * 1000) / 1000,
        zcr: Math.round(zc / Math.max(1, n) * 1000) / 1000, brightness: Math.round(wsum / Math.max(1e-9, wsum2) * 100) / 100 };
    });
  },
  /* 리듬 패턴의 실제 이벤트 모양 (스텝 수·드럼 행·베이스·코드 컴핑 수) */
  rhythmGrid: function(bar){
    var BL = barLen();
    var B = (bar == null) ? S.drumBar : bar;
    var rows = {};
    drumRowList().forEach(function(r){ rows[r.id] = new Array(BL).fill(0); });
    S.drums.forEach(function(n){ if (n.bar === B && rows[n.row] && n.step < BL) rows[n.row][n.step] = 1; });
    var bassSteps = S.bass.filter(function(n){ return n.bar === B; }).map(function(n){ return n.step; }).sort(function(a, b){ return a - b; });
    var chordSteps = [];
    for (var s = 0; s < BL; s++){
      var list = S.events[s] || [];
      if (list.some(function(e){ return S.tracks[e.t] && S.tracks[e.t].role === 'chords'; })) chordSteps.push(s);
    }
    var arpSteps = S.arp.filter(function(n){ return n.bar === B; }).map(function(n){ return n.step; }).sort(function(a, b){ return a - b; });
    return { rhythm:S.rhythm, auto:!!S.rhythmAuto, meter:S.meter, barLen:BL, bar:B, swing:S.swing, rows:rows, bass:bassSteps, chords:chordSteps, arp:arpSteps, events:S.eventCount };
  },
  playKey: function(midi){ return playLiveNote(midi); },
  amb: ambApply,
  remix: function(){ return mutateArrangement(); },
  photoScene: function(scene){ return analyzePhoto(null, scene); },
  drawAll: drawAll,
  debug: {
    events: function(){ return S.eventCount; },
    notes: function(){ return S.notes.length; },
    drums: function(){ return S.drums.length; },
    v6: function(){
      return {
        vocal: (S.vocal || []).length,
        tracks: S.tracks.map(function(t){ return t.role + ':' + t.inst + (t.locked ? '(🔒)' : '') + (t.mute ? '(mute)' : ''); }),
        riserBars: typeof riserBars === 'function' ? riserBars() : null,
        pump: S.pump, riser: S.riser, breakdown: S.breakdown,
        xy: S.xy, roll: S.roll, tone: S.master.tone,
        library: (function(){ try { return JSON.parse(localStorage.getItem('aura_library') || '[]').length; } catch (e) { return -1; } })()
      };
    },
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
        rhythm:S.rhythm, rhythmAuto:!!S.rhythmAuto, meter:S.meter, barLen:barLen(),
        story:S.story, normMode:S.normMode,
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

/* 부팅은 마지막 조각(17_features.js)에서 호출한다 — v8 기능 초기화 순서 보장 */
void boot;

/* ---------------------------------------------------------------- 12. v8 기능
   AURA Studio v8 의 쓸만한 기능을 이 엔진에 맞춰 이식했다.
   · 영상(MP4) 싱크 + 길이 맞춤 + 영상·BGM 합본 저장
   · 내레이션 녹음 · 텔레프롬프터 · 자동 덕킹
   · 16스텝 드럼 시퀀서 · 2옥타브 실시간 건반(오버더빙)
   · 배경 환경음(앰비언스) · 곡 공유 링크(#song=)
   · 폰(412×915)에서 무겁지 않게: 필요한 순간에만 노드를 만들고, 탭을 떠나면 영상을 멈춘다.
   ========================================================================== */

function fmtTime(sec){
  sec = Math.max(0, Number(sec) || 0);
  var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
function escHtml(s){
  return String(s).replace(/[&<>"]/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
  });
}

/* =======================================================
   12-1. 자동 덕킹 (반주 버스만 줄인다 — 목소리는 그대로)
   ======================================================= */
var DUCK = { speaking:false };

function duckTarget(){
  return Math.max(0.18, 1 - (S.duckDepth / 100) * 0.85);
}
function setAutoDuckingState(speaking, silent){
  DUCK.speaking = !!speaking;
  var active = !!speaking && !!S.duck;
  var ind = $('duck-state');
  if (ind){
    ind.textContent = active ? '🔉 자동 덕킹 작동 중' : (S.duck ? '대기 중' : '덕킹 꺼짐');
    ind.classList.toggle('on', active);
  }
  if (AU.musicBus && AU.ctx){
    var target = active ? duckTarget() : 1;
    try { AU.musicBus.gain.setTargetAtTime(target, AU.ctx.currentTime, active ? 0.12 : 0.35); }
    catch (e) { AU.musicBus.gain.value = target; }
  }
  return active;
}
function duckGainNow(){
  return (AU.musicBus && AU.musicBus.gain) ? AU.musicBus.gain.value : 1;
}

/* =======================================================
   12-2. 내레이션 녹음
   ======================================================= */
var NARR = { rec:null, stream:null, chunks:[], url:null, connected:false };

function connectNarration(){
  var el = $('narr-audio');
  if (!el) return Promise.resolve();
  return ensureAudio().then(function(){
    if (!AU.narrSrc){
      try {
        AU.narrSrc = AU.ctx.createMediaElementSource(el);
        AU.narrGain = AU.ctx.createGain();
        AU.narrGain.gain.value = 1;
        AU.narrSrc.connect(AU.narrGain);
        AU.narrGain.connect(AU.master.in);   /* 덕킹 버스를 타지 않는다 */
      } catch (e) { return; }
    }
    if (!NARR.connected){
      NARR.connected = true;
      el.onplay = function(){ if (S.duck) setAutoDuckingState(true); };
      el.onpause = function(){ setAutoDuckingState(false); };
      el.onended = function(){ setAutoDuckingState(false); };
    }
  });
}

function toggleNarrationRecord(){
  var btn = $('btn-narr-rec');
  if (NARR.rec && NARR.rec.state === 'recording'){ NARR.rec.stop(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder){
    toast('이 브라우저는 마이크 녹음을 지원하지 않습니다 — 샘플 목소리로 확인해 보세요', 'warn');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio:true })
    .then(function(stream){
      NARR.stream = stream;
      NARR.chunks = [];
      var rec = new MediaRecorder(stream);
      NARR.rec = rec;
      rec.ondataavailable = function(e){ if (e.data && e.data.size) NARR.chunks.push(e.data); };
      rec.onstop = function(){
        stream.getTracks().forEach(function(t){ try { t.stop(); } catch (e) {} });
        var type = rec.mimeType || 'audio/webm';
        var blob = new Blob(NARR.chunks, { type:type });
        if (NARR.url) { try { URL.revokeObjectURL(NARR.url); } catch (e) {} }
        NARR.url = URL.createObjectURL(blob);
        var el = $('narr-audio');
        if (el){
          el.src = NARR.url;
          el.classList.remove('hidden');
          connectNarration();
        }
        if (btn){ btn.classList.remove('recpulse'); btn.textContent = '● 내레이션 녹음'; }
        setAutoDuckingState(false);
        var note = $('narr-note');
        if (note) note.textContent = '녹음 완료 · ' + (blob.size / 1024).toFixed(0) + 'KB · 아래 플레이어로 들으며 반주와 겹쳐 보세요.';
        toast('내레이션 녹음 완료 · 재생하면 반주가 자동으로 줄어듭니다', 'ok');
      };
      rec.start();
      if (btn){ btn.classList.add('recpulse'); btn.textContent = '■ 녹음 중지'; }
      setAutoDuckingState(true);
      if (!AU.playing) startPlayback();
      toast('녹음 시작 — 텔레프롬프터를 보며 읽어 보세요', 'ok');
    })
    .catch(function(){
      toast('마이크를 열 수 없습니다 — [샘플 목소리]로 덕킹을 확인해 보세요', 'warn');
    });
}

function playSampleNarrationCadence(){
  return ensureAudio().then(function(){
    if (!AU.playing) startPlayback();
    var ctx = AU.ctx, now = ctx.currentTime + 0.14;
    var bus = ctx.createGain(); bus.gain.value = 0.55; bus.connect(AU.master.in);
    var formant = ctx.createBiquadFilter();
    formant.type = 'bandpass'; formant.frequency.value = 620; formant.Q.value = 3.2;
    formant.connect(bus);
    var syl = [[0,.32,165],[.40,.24,182],[.72,.42,152],[1.40,.30,172],[1.78,.36,190],[2.24,.46,150],[2.95,.32,168],[3.34,.55,143]];
    syl.forEach(function(s){
      var o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(s[2], now + s[0]);
      o.frequency.linearRampToValueAtTime(s[2] * 0.94, now + s[0] + s[1]);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + s[0]);
      g.gain.linearRampToValueAtTime(0.5, now + s[0] + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0008, now + s[0] + s[1]);
      o.connect(g); g.connect(formant);
      o.start(now + s[0]); o.stop(now + s[0] + s[1] + 0.06);
    });
    setAutoDuckingState(true);
    setTimeout(function(){ setAutoDuckingState(false); }, 4400);
    toast('샘플 목소리 4.5초 — 반주가 줄어드는지 들어 보세요', 'ok');
  }).catch(function(e){ toast('재생 실패: ' + (e && e.message || e), 'err'); });
}

/* =======================================================
   12-3. 텔레프롬프터
   ======================================================= */
function scriptLines(){
  var lines = (S.script || []).map(function(s){ return String(s); }).filter(function(s){ return s.trim().length; });
  return lines.length ? lines : ['첫 줄을 적으면 여기에 표시됩니다.'];
}
function renderTeleprompter(){
  var box = $('tp-live'); if (!box) return;
  var lines = scriptLines();
  box.innerHTML = lines.map(function(l, i){
    return '<div class="ln" data-i="' + i + '">' + escHtml(l) + '</div>';
  }).join('');
  var ta = $('tp-edit');
  if (ta && ta.value !== lines.join('\n')) ta.value = lines.join('\n');
  tpHighlight();
}
function tpHighlight(){
  var box = $('tp-live'); if (!box) return;
  var lines = scriptLines();
  var idx = -1;
  if (AU.playing && S.bars > 0){
    var bar = Math.floor(S.step / barLen()) % S.bars;
    idx = Math.min(lines.length - 1, Math.floor(bar / S.bars * lines.length));
    var n = box.children[idx];
    if (n && box.scrollHeight > box.clientHeight){
      var top = n.offsetTop - box.clientHeight / 2 + n.offsetHeight / 2;
      box.scrollTop = Math.max(0, top);
    }
  }
  Array.prototype.forEach.call(box.children, function(el, i){
    el.classList.toggle('now', i === idx);
  });
}
function generateScriptFromMood(){
  var mood = ($('mood-text') && $('mood-text').value || '').trim() || '고요한 밤의 선율';
  S.script = [
    '오늘의 이야기: ' + mood,
    '깊어가는 밤, 잔잔한 리듬 위로 떠오르는 작은 기억들',
    '잠시 모든 걱정을 내려놓고 이 음악의 흐름에 몸을 맡겨 보세요',
    '당신의 하루 끝이 따뜻하고 평온하기를 바랍니다'
  ];
  renderTeleprompter(); saveSettings();
  toast('분위기에 맞는 대본 초안을 만들었습니다', 'ok');
}

/* =======================================================
   12-4. 16스텝 드럼 시퀀서
   ======================================================= */
function drumRowList(){ return DRUM_ROWS; }

function renderDrumSeq(){
  var box = $('dseq'); if (!box) return;
  var rows = drumRowList();
  var BL = barLen();
  var html = '';
  rows.forEach(function(r){
    html += '<span class="lb">' + r.label + '</span>';
    for (var s = 0; s < BL; s++){
      var on = S.drums.some(function(n){ return n.bar === S.drumBar && n.step === s && n.row === r.id; });
      html += '<button type="button" data-row="' + r.id + '" data-step="' + s + '"' +
        ' class="' + (on ? 'on ' : '') + (s % 4 === 0 ? 'beat' : '') + '"' +
        ' aria-label="' + r.label + ' ' + (s + 1) + '칸" aria-pressed="' + (on ? 'true' : 'false') + '"></button>';
    }
  });
  box.style.gridTemplateColumns = '29px repeat(' + BL + ',minmax(0,1fr))';
  box.innerHTML = html;
  Array.prototype.forEach.call(box.querySelectorAll('button[data-step]'), function(b){
    b.addEventListener('click', function(){ drumToggle(b.dataset.row, +b.dataset.step); });
  });
  var lab = $('dseq-bar'); if (lab) lab.textContent = (S.drumBar + 1) + '마디';
  var kit = $('dseq-kit');
  var t = S.tracks.filter(function(x){ return x.role === 'drums'; })[0];
  if (kit && t) kit.textContent = '킷 ' + (INST[t.inst] ? INST[t.inst].name : t.inst) + ' · ' + S.bars + '마디' + (barLen() === 12 ? ' · 3/4' : '');
  drumSeqTick();
}

function drumToggle(row, step){
  var exists = S.drums.some(function(n){ return n.bar === S.drumBar && n.step === step && n.row === row; });
  if (exists){
    S.drums = S.drums.filter(function(n){ return !(n.bar === S.drumBar && n.step === step && n.row === row); });
  } else {
    S.drums.push({ bar:S.drumBar, step:step, row:row, vel:.82 });
    hitPreview(row);
  }
  rebuildEvents(); renderDrumSeq(); drawDrums(); refreshStats(); saveSettings();
  return !exists;
}

function hitPreview(row){
  if (!AU.ctx) return;
  var t = S.tracks.filter(function(x){ return x.role === 'drums'; })[0];
  if (!t) return;
  try { fireEvent(AU.ctx, trackOutput(t), t, { row:row, dur:1, vel:.9 }, AU.ctx.currentTime + 0.01, stepDur()); } catch (e) {}
}

function drumSeqTick(){
  var box = $('dseq'); if (!box || !box.children.length) return;
  var barNow = Math.floor(S.step / barLen()) % Math.max(1, S.bars);
  var st = S.step % barLen();
  var show = AU.playing && barNow === S.drumBar;
  Array.prototype.forEach.call(box.querySelectorAll('button[data-step]'), function(b){
    b.classList.toggle('now', show && +b.dataset.step === st);
  });
}

/* =======================================================
   12-5. 2옥타브 실시간 건반
   ======================================================= */
var KB_CHARS = ['a','w','s','e','d','f','t','g','y','h','u','j','k','o','l','p',';','\'',']','z','x','c','v','b'];
var KB_HIT = {};

function kbBase(){ return 12 * ((S.kbOct || 4) + 1); }   /* C4 = 60 */
function isWhiteMidi(m){ return [1,3,6,8,10].indexOf(((m % 12) + 12) % 12) < 0; }

function kbCharFor(midi){
  var i = midi - kbBase();
  return (i >= 0 && i < KB_CHARS.length) ? KB_CHARS[i] : '';
}

function renderKeyboard(){
  var wrap = $('piano'); if (!wrap) return;
  var base = kbBase();
  var semis = [];
  for (var i = 0; i < 24; i++) semis.push(base + i);
  var whites = semis.filter(isWhiteMidi);
  var w = 100 / whites.length;
  var html = '';
  whites.forEach(function(m){
    html += '<div class="kbw" data-midi="' + m + '">' + (kbCharFor(m) ? escHtml(kbCharFor(m).toUpperCase()) : '') + '</div>';
  });
  semis.filter(function(m){ return !isWhiteMidi(m); }).forEach(function(m){
    var leftCount = whites.filter(function(x){ return x < m; }).length;
    var left = leftCount * w - w * 0.30;
    html += '<div class="kbb" data-midi="' + m + '" style="left:' + left.toFixed(3) + '%">' +
      (kbCharFor(m) ? escHtml(kbCharFor(m).toUpperCase()) : '') + '</div>';
  });
  wrap.innerHTML = html;
  var oct = $('kb-oct');
  if (oct) oct.textContent = 'C' + S.kbOct + '–B' + (S.kbOct + 1);
}

function kbFlash(midi, on){
  var wrap = $('piano'); if (!wrap) return;
  var el2 = wrap.querySelector('[data-midi="' + midi + '"]');
  if (el2) el2.classList.toggle('hit', !!on);
}

function playLiveNote(midi){
  midi = Math.round(midi);
  return ensureAudio().then(function(){
    var t = S.tracks.filter(function(x){ return x.role === 'melody'; })[0];
    if (!t) return;
    var out = trackOutput(t);
    fireEvent(AU.ctx, out, t, { midi:midi, dur:3, vel:.9 }, AU.ctx.currentTime + 0.01, stepDur());
    var last = $('kb-last'); if (last) last.textContent = midiToName(midi);
    kbFlash(midi, true);
    clearTimeout(KB_HIT[midi]);
    KB_HIT[midi] = setTimeout(function(){ kbFlash(midi, false); }, 170);
    if (S.overdub) recordOverdub(midi);
  }).catch(function(){});
}

function recordOverdub(midi){
  var bar, step;
  if (AU.playing){
    var gs = AU.step % Math.max(1, S.bars * barLen());
    bar = Math.floor(gs / barLen()); step = gs % barLen();
  } else {
    bar = Math.floor(S.overdubCursor / barLen()) % Math.max(1, S.bars);
    step = S.overdubCursor % barLen();
    S.overdubCursor = (S.overdubCursor + 1) % Math.max(1, S.bars * barLen());
  }
  S.notes.push({ bar:bar, step:step, midi:midi, dur:2, vel:.85 });
  rebuildEvents(); refreshStats();
  if ($('tab-seq') && !$('tab-seq').classList.contains('hidden')) drawRoll();
  toast(midiToName(midi) + ' 녹음 · ' + (bar + 1) + '마디 ' + (step + 1) + '칸', 'ok');
}

function bindKeyboard(){
  var wrap = $('piano');
  if (wrap){
    wrap.addEventListener('pointerdown', function(e){
      var hit = e.target.closest ? e.target.closest('[data-midi]') : null;
      if (!hit) return;
      e.preventDefault();
      playLiveNote(+hit.dataset.midi);
    });
    wrap.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }

  window.addEventListener('keydown', function(e){
    if (document.documentElement.classList.contains('pin-locked')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
    if (e.repeat) return;
    var i = KB_CHARS.indexOf(e.key.toLowerCase());
    if (i < 0) return;
    if ($('tab-play').classList.contains('hidden')) return;
    e.preventDefault();
    playLiveNote(kbBase() + i);
  });
}

function setOverdub(on){
  S.overdub = !!on;
  var b = $('btn-overdub');
  if (b){
    b.textContent = S.overdub ? '● 오버더빙 ON' : '● 오버더빙 OFF';
    b.classList.toggle('recpulse', S.overdub);
  }
  saveSettings();
}

/* =======================================================
   12-6. 배경 환경음 (앰비언스)
   ======================================================= */
var AMB = { nodes:{}, buffers:{} };

function makeAmbBuffer(ctx, kind){
  var len = Math.floor(ctx.sampleRate * 2);
  var buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = buf.getChannelData(0);
  var b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
  for (var i = 0; i < len; i++){
    var white = Math.random() * 2 - 1;
    if (kind === 'brown'){
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    } else {
      b0 = 0.99886*b0 + white*0.0555179; b1 = 0.99332*b1 + white*0.0750759;
      b2 = 0.96900*b2 + white*0.1538520; b3 = 0.86650*b3 + white*0.3104856;
      b4 = 0.55000*b4 + white*0.5329522; b5 = -0.7616*b5 - white*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+b6+white*0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  return buf;
}

function ambChain(key){
  var ctx = AU.ctx; if (!ctx) return null;
  if (AMB.nodes[key]) return AMB.nodes[key];
  var kind = (key === 'rain' || key === 'cafe') ? 'pink' : 'brown';
  var buf = AMB.buffers[key] || (AMB.buffers[key] = makeAmbBuffer(ctx, kind));
  var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  var filt = ctx.createBiquadFilter();
  if (key === 'rain'){ filt.type = 'bandpass'; filt.frequency.value = 1500; filt.Q.value = 0.55; }
  else if (key === 'fire'){ filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 0.8; }
  else if (key === 'cafe'){ filt.type = 'bandpass'; filt.frequency.value = 560; filt.Q.value = 0.9; }
  else { filt.type = 'lowpass'; filt.frequency.value = 420; filt.Q.value = 0.7; }
  var out = ctx.createGain(); out.gain.value = 0;
  src.connect(filt);
  if (key === 'ocean'){
    /* 파도 — 느린 LFO 로 볼륨을 흔든다 (출력 게인은 0에서 시작하므로 꺼져 있으면 들리지 않는다) */
    var mod = ctx.createGain(); mod.gain.value = 0.62;
    filt.connect(mod);
    mod.connect(out);
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
    var lg = ctx.createGain(); lg.gain.value = 0.34;
    lfo.connect(lg); lg.connect(mod.gain); lfo.start(0);
    AMB.nodes[key] = { src:src, filt:filt, gain:out, lfo:lfo };
  } else {
    filt.connect(out);
    AMB.nodes[key] = { src:src, filt:filt, gain:out };
  }
  out.connect(AU.musicBus || AU.master.in);
  src.start(0);
  return AMB.nodes[key];
}

function ambApply(){
  if (!AU.ctx) return;
  Object.keys(S.amb).forEach(function(k){
    var v = clamp(+S.amb[k] || 0, 0, 100) / 100;
    if (!v && !AMB.nodes[k]) return;        /* 0이면 만들지 않는다 — 가벼운 노드 관리 */
    var n = ambChain(k); if (!n) return;
    var target = v * 0.22;
    try { n.gain.gain.setTargetAtTime(target, AU.ctx.currentTime, 0.25); }
    catch (e) { n.gain.gain.value = target; }
  });
  var badge = $('amb-badge');
  if (badge){
    var on = Object.keys(S.amb).some(function(k){ return +S.amb[k] > 0; });
    badge.textContent = on ? '켜짐' : '꺼짐';
    badge.classList.toggle('on', on);
  }
}

function renderAmb(){
  ['rain','fire','cafe','ocean'].forEach(function(k){
    var sl = $('amb-' + k);
    if (sl) sl.value = +S.amb[k] || 0;
    var lb = $('amb-' + k + '-val');
    if (lb) lb.textContent = (+S.amb[k] || 0) + '%';
  });
  var badge = $('amb-badge');
  if (badge){
    var on = Object.keys(S.amb).some(function(k){ return +S.amb[k] > 0; });
    badge.textContent = on ? '켜짐' : '꺼짐';
    badge.classList.toggle('on', on);
  }
}

function setAmb(key, val){
  S.amb[key] = clamp(Math.round(val), 0, 100);
  var sl = $('amb-' + key); if (sl) sl.value = S.amb[key];
  var lb = $('amb-' + key + '-val'); if (lb) lb.textContent = S.amb[key] + '%';
  if (!AU.ctx) {
    ensureAudio().then(function(){ ambApply(); }).catch(function(){});
  } else ambApply();
  saveSettings();
}

/* =======================================================
   12-7. 영상(MP4) 싱크 · 합본 저장
   ======================================================= */
var VID = { url:null, dur:30, has:false, raf:null };
var MUX = { running:false, rec:null, timer:null };

function videoEl(){ return $('sync-video'); }

function drawVideoPoster(){
  var cv = $('demo-canvas'); if (!cv) return;
  var c = cv.getContext('2d'), W = cv.width, H = cv.height;
  var g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0b1020'); g.addColorStop(0.55, '#1e1b4b'); g.addColorStop(1, '#0b1020');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  var cx = W / 2, cy = H / 2;
  c.strokeStyle = 'rgba(34,211,238,.35)'; c.lineWidth = 2;
  for (var r = 34; r < 150; r += 26){ c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
  c.fillStyle = 'rgba(34,211,238,.92)';
  c.beginPath(); c.arc(cx, cy, 20, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e2e8f0';
  c.font = '800 ' + Math.round(W * 0.036) + 'px "Pretendard Variable", Pretendard, sans-serif';
  c.textAlign = 'center';
  c.fillText('내 영상을 열면 여기에 미리 보입니다', cx, H - 28);
  c.textAlign = 'left';
}

function loadVideoFile(file){
  var el = videoEl();
  if (!el || !file) return;
  if (!window.URL || !URL.createObjectURL){ toast('이 브라우저는 영상 미리보기를 지원하지 않습니다', 'warn'); return; }
  if (VID.url) { try { URL.revokeObjectURL(VID.url); } catch (e) {} }
  VID.url = URL.createObjectURL(file);
  VID.has = true;
  S.hasVideo = true;
  el.src = VID.url;
  el.classList.remove('hidden');
  var dc = $('demo-canvas'); if (dc) dc.classList.add('hidden');
  el.onloadedmetadata = function(){
    VID.dur = el.duration && isFinite(el.duration) ? el.duration : 30;
    S.videoDur = VID.dur;
    var b = $('video-dur'); if (b) b.textContent = fmtTime(VID.dur) + ' · ' + file.name.slice(0, 14);
    var note = $('fit-note');
    var barSec = barSecAt(S.bpm);
    if (note) note.textContent = '영상 ' + fmtTime(VID.dur) + ' · 맞추면 약 ' +
      clamp(Math.round(VID.dur / barSec / 2) * 2, 4, 32) + '마디가 됩니다.';
    toast('영상 로드 완료 · ' + fmtTime(VID.dur), 'ok');
    drawVideoPoster();
  };
  el.onerror = function(){
    VID.has = false; S.hasVideo = false;
    toast('이 브라우저에서 열 수 없는 영상입니다 (MP4/H.264 · WebM 권장)', 'err');
    useDemoVideo();
  };
  try { el.load(); } catch (e) {}
}

function useDemoVideo(){
  var el = videoEl();
  if (el){ try { el.pause(); } catch (e) {} el.classList.add('hidden'); el.removeAttribute('src'); }
  var dc = $('demo-canvas'); if (dc) dc.classList.remove('hidden');
  VID.has = false; VID.dur = 30; S.hasVideo = false; S.videoDur = 30;
  var b = $('video-dur'); if (b) b.textContent = '00:30 · 데모';
  var note = $('fit-note'); if (note) note.textContent = '데모 클립 · 영상을 열면 길이를 읽어 곡 구조를 다시 짭니다.';
  drawVideoPoster();
  toast('데모 클립으로 돌아왔습니다');
}

function pauseVideoPreview(){
  if (MUX.running) return;               /* 합본 녹화 중에는 멈추지 않는다 */
  var el = videoEl();
  if (el && !el.paused){ try { el.pause(); } catch (e) {} }
}

function autoFitSongFormToVideo(dur){
  return ensureAudio().then(function(){
    var target = Number(dur) || (VID.has && VID.dur ? VID.dur : (S.videoDur || 30));
    var barSec = barSecAt(S.bpm);
    var bars = clamp(Math.round((target / barSec) / 2) * 2, 4, 32);
    S.bars = bars; S.rollStart = 0; S.drumBar = 0;
    S.chords = [];
    buildChords(20261127);
    composeAll(20261127, {});
    Array.prototype.forEach.call(document.querySelectorAll('[data-bars]'), function(b){
      b.classList.toggle('on', +b.dataset.bars === S.bars);
    });
    syncPresetUI(); refreshStats(); refreshLoopInfo(); drawAll();
    if (typeof renderDrumSeq === 'function') renderDrumSeq();
    var real = bars * barSec;
    var note = $('fit-note');
    if (note) note.textContent = '영상 ' + fmtTime(target) + ' → ' + bars + '마디(' + fmtTime(real) + ')로 곡을 다시 짰습니다.';
    toast('영상 길이에 맞춰 ' + bars + '마디로 곡을 구성했습니다', 'ok');
    return { bars:bars, seconds:real };
  });
}

function pickMuxMime(){
  if (!window.MediaRecorder) return '';
  var list = [
    /* MP4 는 H.264 를 실제로 녹화할 수 있을 때만 고른다 — 코드 없이 'video/mp4' 만 지원한다고 답하는
       브라우저에서 만들면 재생이 안 되는 파일이 나온다. */
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  for (var i = 0; i < list.length; i++){
    try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) {}
  }
  return '';
}

function setMuxProgress(pct, msg){
  var box = $('mux-prog');
  if (box){
    box.style.display = (pct == null) ? 'none' : 'block';
    if (pct != null && box.firstElementChild) box.firstElementChild.style.width = clamp(pct, 0, 100) + '%';
  }
  if (msg){ var n = $('mux-note'); if (n) n.textContent = msg; }
}

function exportMuxedVideoWithBgm(limitSec){
  if (MUX.running){ toast('이미 합본을 녹화하고 있습니다', 'warn'); return Promise.resolve(null); }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream){
    toast('이 브라우저는 영상 녹화를 지원하지 않습니다 (Chrome · 삼성 인터넷 최신 권장)', 'warn');
    return Promise.resolve(null);
  }
  return ensureAudio()
    .then(function(){ return loadNeeded(null); })
    .then(function(){
      return new Promise(function(resolve){
        stopPlayback();
        var el = videoEl();
        var demo = !VID.has;
        var vw = 720, vh = 405;
        if (!demo && el && el.videoWidth && el.videoHeight){
          var ar = el.videoWidth / el.videoHeight;
          if (ar >= 1){ vw = 720; vh = Math.max(2, Math.round(720 / ar / 2) * 2); }
          else { vh = 720; vw = Math.max(2, Math.round(720 * ar / 2) * 2); }
        }
        var cv = document.createElement('canvas');
        cv.width = vw; cv.height = vh;
        var c = cv.getContext('2d');
        var dest = AU.ctx.createMediaStreamDestination();
        masterTap().connect(dest);
        var stream = new MediaStream(
          cv.captureStream(30).getVideoTracks().concat(dest.stream.getAudioTracks())
        );
        var mime = pickMuxMime();
        var rec = null;
        try {
          rec = mime
            ? new MediaRecorder(stream, { mimeType:mime, videoBitsPerSecond:3500000, audioBitsPerSecond:128000 })
            : new MediaRecorder(stream, { videoBitsPerSecond:3500000 });
        } catch (e){
          try { masterTap().disconnect(dest); } catch (e2) {}
          toast('녹화기를 시작할 수 없습니다: ' + (e && e.message || e), 'err');
          resolve(null); return;
        }
        MUX.rec = rec;
        var chunks = [];
        rec.ondataavailable = function(e){ if (e.data && e.data.size) chunks.push(e.data); };

        var barSec = barSecAt(S.bpm);
        var songSec = S.bars * barSec;
        var targetSec = Math.max(2, Math.min(limitSec || 120, demo ? songSec : Math.min(VID.dur || songSec, songSec + 2)));
        var overlay = $('chk-overlay') ? $('chk-overlay').checked : true;
        var running = true, phase = 0, rafId = 0;

        function frame(){
          if (!running) return;
          rafId = requestAnimationFrame(frame);
          phase += 0.05;
          c.clearRect(0, 0, vw, vh);
          if (!demo && el && el.readyState >= 2){
            var s = Math.max(vw / el.videoWidth, vh / el.videoHeight);
            var dw = el.videoWidth * s, dh = el.videoHeight * s;
            try { c.drawImage(el, (vw - dw) / 2, (vh - dh) / 2, dw, dh); } catch (e) {}
          } else {
            var g = c.createLinearGradient(0, 0, vw, vh);
            g.addColorStop(0, '#0b1020'); g.addColorStop(0.55, '#1e1b4b'); g.addColorStop(1, '#0b1020');
            c.fillStyle = g; c.fillRect(0, 0, vw, vh);
            var r = Math.min(vw, vh) * 0.12;
            var cy = vh / 2 + Math.sin(phase * 0.7) * r * 0.35;
            c.fillStyle = 'rgba(34,211,238,.9)';
            c.beginPath(); c.arc(vw / 2, cy, r, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(167,139,250,.7)'; c.lineWidth = Math.max(2, r * 0.06);
            c.beginPath(); c.arc(vw / 2, cy, r * 1.55, 0, Math.PI * 2); c.stroke();
          }
          if (overlay && AU.analyser){
            var n = 48, buf = new Uint8Array(AU.analyser.frequencyBinCount);
            AU.analyser.getByteFrequencyData(buf);
            var bw = vw / n, base = vh - 6;
            for (var i = 0; i < n; i++){
              var v = buf[Math.floor(i * buf.length / n)] / 255;
              var h = Math.max(2, v * vh * 0.17);
              c.fillStyle = i % 2 ? 'rgba(167,139,250,.85)' : 'rgba(34,211,238,.85)';
              c.fillRect(i * bw + 1, base - h, bw - 2, h);
            }
            c.fillStyle = 'rgba(255,255,255,.92)';
            c.font = '800 ' + Math.round(vw * 0.024) + 'px "Pretendard Variable", Pretendard, sans-serif';
            c.fillText('AURA Studio Pro · ' + S.bpm + ' BPM' + (S.aiTitle ? ' · ' + S.aiTitle.slice(0, 18) : ''), Math.round(vw * 0.03), Math.round(vh * 0.075));
          }
        }

        rec.onstop = function(){
          running = false;
          if (rafId) cancelAnimationFrame(rafId);
          if (MUX.timer){ clearInterval(MUX.timer); MUX.timer = null; }
          try { masterTap().disconnect(dest); } catch (e) {}
          var type = (mime && mime.indexOf('mp4') > -1) ? 'video/mp4' : 'video/webm';
          var ext = type === 'video/mp4' ? 'mp4' : 'webm';
          var blob = new Blob(chunks, { type:type });
          MUX.running = false; MUX.rec = null;
          var badge = $('mux-badge');
          if (badge){ badge.textContent = blob.size ? '완료' : '실패'; badge.classList.remove('on'); }
          setMuxProgress(null);
          if (!blob.size){
            toast('녹화된 영상이 비어 있습니다 — 다시 시도해 주세요', 'err');
            resolve(null); return;
          }
          var stamp = new Date();
          var name = 'AURA_muxed_' + (stamp.getMonth() + 1) + pad2(stamp.getDate()) + '_' + S.bpm + 'bpm.' + ext;
          downloadBlob(blob, name);
          var note = $('mux-note');
          if (note) note.textContent = '저장 완료 · ' + name + ' · ' + (blob.size / 1048576).toFixed(1) + 'MB (' + fmtTime(targetSec) + ')';
          toast('영상 + BGM 합본 저장 완료 · ' + (blob.size / 1048576).toFixed(1) + 'MB (' + ext.toUpperCase() + ')', 'ok');
          resolve(blob);
        };

        MUX.running = true;
        var badge2 = $('mux-badge');
        if (badge2){ badge2.textContent = '● 녹화 중'; badge2.classList.add('on'); }
        setMuxProgress(0, '녹화 준비…');
        try { rec.start(250); } catch (e){
          MUX.running = false;
          try { masterTap().disconnect(dest); } catch (e2) {}
          toast('녹화 시작 실패: ' + (e && e.message || e), 'err');
          resolve(null); return;
        }
        startPlayback();
        if (!demo && el){
          setTimeout(function(){
            try { el.currentTime = 0; var p = el.play(); if (p && p.catch) p.catch(function(){}); } catch (e) {}
          }, 140);
        }
        frame();
        var startedAt = performance.now();
        MUX.timer = setInterval(function(){
          var t = (performance.now() - startedAt) / 1000;
          setMuxProgress(Math.min(100, Math.round(t / targetSec * 100)), '녹화 중 ' + fmtTime(t) + ' / ' + fmtTime(targetSec) + ' — 화면을 켜 두세요');
          if (t >= targetSec || !AU.playing){
            if (MUX.timer){ clearInterval(MUX.timer); MUX.timer = null; }
            if (el && !el.paused) { try { el.pause(); } catch (e) {} }
            try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {}
          }
        }, 200);
      });
    })
    .catch(function(e){
      MUX.running = false; setMuxProgress(null);
      toast('합본 저장 실패: ' + (e && e.message || e), 'err');
      return null;
    });
}

/* =======================================================
   12-8. 곡 공유 링크 (#song=)
   ======================================================= */
function b64encodeUtf8(str){
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64decodeUtf8(str){
  var s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}

function encodeSongToHash(){
  var payload = {
    v: 1,
    b: S.bpm, k: S.key, md: S.mode, n: S.bars, p: S.preset, g: S.prog, x: S.ext,
    br: S.bright, en: S.energy, sw: S.swing,
    c: S.chords.map(function(c){ return [c.deg, c.ext]; }),
    no: S.notes.map(function(n){ return [n.bar, n.step, n.midi, n.dur || 2, Math.round((n.vel || .8) * 100)]; }),
    dr: S.drums.map(function(d){ return [d.bar, d.step, d.row, Math.round((d.vel || .8) * 100)]; }),
    tr: S.tracks.map(function(t){ return [t.inst, Math.round(t.vol * 100), Math.round((t.pan || 0) * 100), t.mute ? 1 : 0, t.solo ? 1 : 0]; }),
    ms: [S.master.low, S.master.mid, S.master.high, S.master.reverb, S.master.warmth, S.master.volume],
    am: [S.amb.rain, S.amb.fire, S.amb.cafe, S.amb.ocean],
    sc: (S.script || []).slice(0, 12),
    dd: S.duckDepth, dk: S.duck ? 1 : 0,
    ti: S.aiTitle || ''
  };
  return location.origin + location.pathname + '#song=' + b64encodeUtf8(JSON.stringify(payload));
}

function decodeSongFromHash(){
  var h = location.hash || '';
  if (h.indexOf('#song=') !== 0) return false;
  try {
    var d = JSON.parse(b64decodeUtf8(h.slice(6)));
    if (!d || typeof d !== 'object') return false;
    if (d.b) S.bpm = clamp(+d.b, 60, 170);
    if (typeof d.k === 'number') S.key = ((d.k % 12) + 12) % 12;
    if (d.md && SCALES[d.md]) S.mode = d.md;
    if (d.n) S.bars = clamp(+d.n, 4, 32);
    if (d.p) S.preset = String(d.p);
    if (d.g) S.prog = String(d.g);
    if (d.x) S.ext = String(d.x);
    if (d.br != null) S.bright = clamp(+d.br, 0, 100);
    if (d.en != null) S.energy = clamp(+d.en, 0, 100);
    if (d.sw != null) S.swing = clamp(+d.sw, 0, 60);
    if (Array.isArray(d.c) && d.c.length){
      S.chords = d.c.map(function(a){
        var deg = clamp(a[0] | 0, 0, 6), ext = String(a[1] || '7');
        var notes = chordVoicing(deg, ext);
        return { deg:deg, ext:ext, notes:notes, name:chordName(deg, ext), root:notes[0] };
      });
    }
    if (Array.isArray(d.no)) S.notes = d.no.map(function(a){
      return { bar:clamp(a[0] | 0, 0, S.bars - 1), step:clamp(a[1] | 0, 0, 15), midi:clamp(a[2] | 0, 24, 100), dur:clamp(a[3] || 2, 1, 16), vel:clamp((a[4] || 80) / 100, .1, 1) };
    });
    if (Array.isArray(d.dr)) S.drums = d.dr.map(function(a){
      return { bar:clamp(a[0] | 0, 0, S.bars - 1), step:clamp(a[1] | 0, 0, 15), row:String(a[2]), vel:clamp((a[3] || 80) / 100, .1, 1) };
    }).filter(function(n){ return DRUM_ROWS.some(function(r){ return r.id === n.row; }); });
    if (Array.isArray(d.tr)) d.tr.forEach(function(a, i){
      var t = S.tracks[i]; if (!t) return;
      if (a[0] && INST[a[0]]) t.inst = a[0];
      if (a[1] != null) t.vol = clamp(a[1] / 100, 0, 1);
      if (a[2] != null) t.pan = clamp(a[2] / 100, -1, 1);
      t.mute = !!a[3]; t.solo = !!a[4];
    });
    if (Array.isArray(d.ms)) [ 'low','mid','high','reverb','warmth','volume' ].forEach(function(k, i){
      if (d.ms[i] != null) S.master[k] = +d.ms[i];
    });
    if (Array.isArray(d.am)) S.amb = { rain:+d.am[0] || 0, fire:+d.am[1] || 0, cafe:+d.am[2] || 0, ocean:+d.am[3] || 0 };
    if (Array.isArray(d.sc) && d.sc.length) S.script = d.sc.slice(0, 12).map(String);
    if (d.dd != null) S.duckDepth = clamp(+d.dd || 60, 20, 85);
    if (d.dk != null) S.duck = !!d.dk;
    if (d.ti) S.aiTitle = String(d.ti);
    if (!S.chords.length) buildChords(20261127);
    rebuildEvents();
    return true;
  } catch (e){
    return false;
  }
}

function shareSong(){
  var url = encodeSongToHash();
  var done = function(){ toast('곡 공유 링크를 복사했습니다 · ' + (url.length / 1024).toFixed(1) + 'KB', 'ok'); };
  var fallback = function(){
    var ta = document.createElement('textarea');
    ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    if (ok) done(); else toast('공유 링크를 만들었습니다 (복사는 브라우저 권한 필요)', 'warn');
  };
  try { history.replaceState(null, '', url); } catch (e) {}
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(done).catch(fallback);
  } else fallback();
  return url;
}

/* =======================================================
   12-9. UI 배선 · 초기화
   ======================================================= */
function syncV8Controls(){
  var chk = $('chk-duck'); if (chk) chk.checked = !!S.duck;
  var dd = $('duck-depth'); if (dd) dd.value = S.duckDepth;
  var ddv = $('duck-depth-val');
  if (ddv) ddv.textContent = '-' + Math.round(S.duckDepth / 100 * 15) + 'dB';
  var ob = $('btn-overdub');
  if (ob){ ob.textContent = S.overdub ? '● 오버더빙 ON' : '● 오버더빙 OFF'; ob.classList.toggle('recpulse', !!S.overdub); }
  renderAmb();
  var oct = $('kb-oct'); if (oct) oct.textContent = 'C' + S.kbOct + '–B' + (S.kbOct + 1);
  var ta = $('tp-edit'); if (ta) ta.value = scriptLines().join('\n');
  var ind = $('duck-state');
  if (ind && !DUCK.speaking){ ind.textContent = S.duck ? '대기 중' : '덕킹 꺼짐'; ind.classList.remove('on'); }
}

function initFolds(){
  Array.prototype.forEach.call(document.querySelectorAll('[data-fold]'), function(head){
    head.addEventListener('click', function(){
      var card = head.closest('.card'); if (!card) return;
      var closed = card.classList.toggle('closed');
      head.setAttribute('aria-expanded', closed ? 'false' : 'true');
    });
  });
}

var UI = { timer:null };

function startUiSync(){
  if (UI.timer) return;
  UI.timer = setInterval(function(){
    if (!AU.playing) return;
    var narr = $('tab-narr'), play = $('tab-play');
    if (narr && !narr.classList.contains('hidden')) tpHighlight();
    if (play && !play.classList.contains('hidden')) drumSeqTick();
    if ($('tab-seq') && !$('tab-seq').classList.contains('hidden')) drawDrums();
  }, 120);
}

function initV8(){
  /* 내레이션 */
  var rec = $('btn-narr-rec'); if (rec) rec.addEventListener('click', toggleNarrationRecord);
  var snd = $('btn-narr-sample'); if (snd) snd.addEventListener('click', playSampleNarrationCadence);
  var dk = $('chk-duck');
  if (dk) dk.addEventListener('change', function(){
    S.duck = dk.checked;
    if (!S.duck) setAutoDuckingState(false);
    else if (DUCK.speaking) setAutoDuckingState(true);
    saveSettings();
  });
  var dd = $('duck-depth');
  if (dd) dd.addEventListener('input', function(){
    S.duckDepth = clamp(+dd.value, 20, 85);
    var v = $('duck-depth-val'); if (v) v.textContent = '-' + Math.round(S.duckDepth / 100 * 15) + 'dB';
    if (DUCK.speaking) setAutoDuckingState(true);
    saveSettings();
  });
  var tpEdit = $('tp-edit');
  if (tpEdit) tpEdit.addEventListener('input', function(){
    S.script = tpEdit.value.split('\n').map(function(s){ return s.trim(); }).filter(function(s){ return s.length; });
    renderTeleprompter(); saveSettings();
  });
  var tgen = $('btn-tp-gen'); if (tgen) tgen.addEventListener('click', generateScriptFromMood);

  /* 드럼 시퀀서 */
  var dp = $('dseq-prev'), dn = $('dseq-next');
  if (dp) dp.addEventListener('click', function(){
    S.drumBar = Math.max(0, S.drumBar - 1); renderDrumSeq(); drawDrums();
  });
  if (dn) dn.addEventListener('click', function(){
    S.drumBar = Math.min(Math.max(0, S.bars - 1), S.drumBar + 1); renderDrumSeq(); drawDrums();
  });
  var dcl = $('dseq-clear');
  if (dcl) dcl.addEventListener('click', function(){
    S.drums = S.drums.filter(function(n){ return n.bar !== S.drumBar; });
    rebuildEvents(); renderDrumSeq(); drawDrums(); refreshStats(); saveSettings();
    toast((S.drumBar + 1) + '마디 드럼을 비웠습니다');
  });

  /* 건반 */
  bindKeyboard();
  var ob = $('btn-overdub'); if (ob) ob.addEventListener('click', function(){ setOverdub(!S.overdub); });
  var kd = $('kb-down'), ku = $('kb-up');
  if (kd) kd.addEventListener('click', function(){
    S.kbOct = clamp(S.kbOct - 1, 2, 6); renderKeyboard(); syncV8Controls(); saveSettings();
  });
  if (ku) ku.addEventListener('click', function(){
    S.kbOct = clamp(S.kbOct + 1, 2, 6); renderKeyboard(); syncV8Controls(); saveSettings();
  });

  /* 환경음 */
  ['rain','fire','cafe','ocean'].forEach(function(k){
    var sl = $('amb-' + k);
    if (sl) sl.addEventListener('input', function(){ setAmb(k, +sl.value); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-amb]'), function(b){
    b.addEventListener('click', function(){
      var spec = b.dataset.amb;
      ['rain','fire','cafe','ocean'].forEach(function(k){ S.amb[k] = 0; });
      if (spec !== 'off'){
        var keys = spec.split(',');
        keys.forEach(function(k, i){ if (S.amb[k] != null) S.amb[k] = i === 0 ? 38 : 24; });
      }
      ensureAudio().then(function(){ ambApply(); }).catch(function(){});
      renderAmb(); saveSettings();
      toast(spec === 'off' ? '환경음을 껐습니다' : '환경음 프리셋을 켰습니다', 'ok');
    });
  });

  /* 영상 */
  var vf = $('video-file');
  if (vf) vf.addEventListener('change', function(){
    var f = vf.files && vf.files[0];
    if (f) loadVideoFile(f);
    vf.value = '';
  });
  var vd = $('btn-video-demo'); if (vd) vd.addEventListener('click', useDemoVideo);
  var fit = $('btn-fit-video'); if (fit) fit.addEventListener('click', function(){ autoFitSongFormToVideo(); });
  var mux = $('btn-mux'); if (mux) mux.addEventListener('click', function(){ exportMuxedVideoWithBgm(); });

  /* 공유 */
  var sh = $('btn-share'); if (sh) sh.addEventListener('click', shareSong);
  var sh2 = $('btn-share-link'); if (sh2) sh2.addEventListener('click', shareSong);

  initFolds();
  renderDrumSeq(); renderKeyboard(); renderTeleprompter(); renderAmb();
  syncV8Controls();
  drawVideoPoster();
  startUiSync();

  /* 첫 소리 이후 환경음·덕킹 상태를 실제 그래프에 반영 */
  window.addEventListener('aura:unlocked', function(){ setTimeout(function(){ if (AU.ctx) { ambApply(); if (AU.narrSrc) connectNarration(); } }, 400); });
  document.addEventListener('pointerdown', function(){
    setTimeout(function(){ if (AU.ctx) { ambApply(); if (S.actualDuck) setAutoDuckingState(true); } }, 300);
  }, { once:true });

  /* 저장값이 있으면 슬라이더에 반영 */
  renderAmb();
}

/* 부팅은 마지막 조각(18_v6.js)에서 호출한다 */

/* =============================================================================
   19. 사운드 팔레트 — 리듬 패턴 8종 · 드럼 킷 4종 · 리드 음색 6종 (v10)
   칩을 누르면 실제로 도는 값(드럼 16칸·베이스·코드 컴핑·스윙·박자·음색 파라미터)이 바뀐다.
   ========================================================================== */
var LEAD_TONES = ['piano', 'pluck', 'brass', 'lead', 'chip', 'bell'];
var KIT_TONES  = ['kit-808', 'kit-lofi', 'kit-rock', 'kit-electro'];

var LEAD_META = {
  piano: { em:'🎹', sub:'그랜드 피아노 · 샘플' },
  pluck: { em:'✨', sub:'짧게 튕기는 플럭' },
  brass: { em:'🎺', sub:'브라스 섹션 스택' },
  lead:  { em:'🎛', sub:'아날로그 리드 신스' },
  chip:  { em:'🕹', sub:'8비트 사각파 칩튠' },
  bell:  { em:'🔔', sub:'비화성 FM 감성 벨' }
};
var KIT_META = {
  'kit-808':     { em:'🔊', sub:'서브킥 · 크리스피 햇' },
  'kit-lofi':    { em:'📻', sub:'로우패스 · 비닐 질감' },
  'kit-rock':    { em:'🥁', sub:'내추럴 킥/스네어 · 오픈햇' },
  'kit-electro': { em:'⚡', sub:'EDM 킥 · 클랩' }
};

function drumTrack(){ return S.tracks.filter(function(t){ return t.role === 'drums'; })[0]; }
function melodyTrack(){ return S.tracks.filter(function(t){ return t.role === 'melody'; })[0]; }

function renderSoundPalette(){
  var rb = $('rhythm-buttons');
  if (rb) {
    rb.innerHTML = RHYTHMS.map(function(r){
      return '<button type="button" class="snd' + (S.rhythm === r.id ? ' on' : '') + '" data-rhythm="' + r.id + '" aria-pressed="' + (S.rhythm === r.id ? 'true' : 'false') + '">' +
        '<span class="em">' + r.em + '</span><span>' + r.name + '<small>' + r.sub + '</small></span></button>';
    }).join('');
  }
  var kb = $('kit-buttons');
  var dt = drumTrack();
  if (kb) {
    kb.innerHTML = KIT_TONES.map(function(id){
      var d = INST[id], m = KIT_META[id] || { em:'🥁', sub:'' };
      var on = dt && dt.inst === id;
      return '<button type="button" class="snd' + (on ? ' on' : '') + '" data-kit="' + id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="em">' + m.em + '</span><span>' + (d ? d.name : id) + '<small>' + m.sub + '</small></span></button>';
    }).join('');
  }
  var lb = $('lead-buttons');
  var mt = melodyTrack();
  if (lb) {
    lb.innerHTML = LEAD_TONES.map(function(id){
      var d = INST[id], m = LEAD_META[id] || { em:'🎹', sub:'' };
      var on = mt && mt.inst === id;
      return '<button type="button" class="snd' + (on ? ' on' : '') + '" data-lead="' + id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="em">' + m.em + '</span><span>' + (d ? d.name : id) + '<small>' + m.sub + '</small></span></button>';
    }).join('');
  }
  var rbadge = $('rhythm-badge');
  if (rbadge) {
    var ry = rhythmNow();
    rbadge.textContent = (ry ? ry.name : '정박 팝') + (S.rhythmAuto ? ' · 프리셋 자동' : (S.meter === 3 ? ' · 12칸' : ' · 직접 선택'));
    rbadge.className = 'badge' + (S.rhythmAuto ? '' : ' ok');
  }
  var kbadge = $('kit-badge');
  if (kbadge && dt) {
    kbadge.textContent = (INST[dt.inst] ? INST[dt.inst].name : dt.inst) + (INST[dt.inst] && INST[dt.inst].kind === 'drumkit' ? ' · 신스' : ' · 샘플');
  }
  var lbadge = $('lead-badge');
  if (lbadge && mt) lbadge.textContent = INST[mt.inst] ? INST[mt.inst].name : mt.inst;
  var rnote = $('rhythm-meter');
  if (rnote) rnote.textContent = (S.meter === 3 ? '3/4 · 12칸' : '4/4 · 16칸') + ' · ' + (RHYTHMS.length) + '종';
}

/* ---------------- 리듬 패턴 적용 ---------------- */
function applyRhythm(id){
  var ry = rhythmOf(id);
  if (!ry) return false;
  var newMeter = ry.meter || 4;
  var meterChanged = (S.meter || 4) !== newMeter;
  S.rhythm = id; S.rhythmAuto = false; S.meter = newMeter;
  if (ry.swing != null) S.swing = clamp(ry.swing, 0, 60);
  var BL = barLen();
  /* 3/4로 줄면 12칸을 넘는 음표는 정리한다 (그대로 두면 다음 마디로 새어 들어간다) */
  if (meterChanged) {
    S.notes = S.notes.filter(function(n){ return (n.step || 0) < BL; });
    S.overdubCursor = 0;
    S.drumBar = clamp(S.drumBar, 0, Math.max(0, S.bars - 1));
    S.rollStart = clamp(S.rollStart, 0, Math.max(0, S.bars - S.rollBars));
  }
  S.drums = genDrums(4242);
  S.bass = genBass(5150);
  S.arp = genArp(3131);
  rebuildEvents();
  /* 시퀀서가 인트로(드럼이 거의 없는 마디)에 머물면 바뀐 게 안 보인다 — 가장 밀도 높은 마디로 */
  var bestBar = 0, bestE = -1;
  for (var q = 0; q < S.bars; q++) { var eq = barEnergy(q); if (eq > bestE) { bestE = eq; bestBar = q; } }
  S.drumBar = bestBar;

  var sw = $('swing-slider'); if (sw) sw.value = S.swing;
  var swv = $('swing-val'); if (swv) swv.textContent = S.swing;
  syncPresetUI();
  renderSoundPalette();
  refreshStats(); refreshLoopInfo(); drawAll();
  if (typeof renderDrumSeq === 'function') renderDrumSeq();
  saveSettings();
  toast('리듬 패턴 · ' + ry.name + (newMeter === 3 && ry.name.indexOf('3/4') < 0 ? ' (3/4)' : '') + ' — 드럼·베이스·코드 컴핑을 다시 짰습니다', 'ok');
  return true;
}

/* ---------------- 드럼 킷 적용 ---------------- */
function applyDrumKit(id){
  var t = drumTrack();
  if (!t || !INST[id]) return false;
  t.inst = id;
  if (AU.ctx) { refreshMix(); prepareInst(id).then(function(){ updateSamplerStatus(); }).catch(function(){}); }
  renderMixer();
  if (typeof renderDrumSeq === 'function') renderDrumSeq();
  drawDrums(); updateSamplerStatus(); renderSoundPalette(); saveSettings();
  ensureAudio().then(function(){ previewKit(id); }).catch(function(){});
  toast('드럼 킷 · ' + INST[id].name, 'ok');
  return true;
}

/* ---------------- 리드 음색 적용 ---------------- */
function applyLeadTone(id){
  var t = melodyTrack();
  if (!t || !INST[id]) return false;
  t.inst = id;
  if (AU.ctx) refreshMix();
  renderMixer(); renderSoundPalette(); updateSamplerStatus(); saveSettings();
  ensureAudio().then(function(){ return prepareInst(id); }).then(function(){
    var tt = melodyTrack();
    if (!tt || !AU.ctx) return;
    var ch = S.chords[0];
    var midi = ch && ch.notes && ch.notes.length ? ch.notes[ch.notes.length - 1] + 12 : 72;
    fireEvent(AU.ctx, trackOutput(tt), tt, { midi:midi, dur:4, vel:.9 }, AU.ctx.currentTime + 0.05, stepDur());
  }).catch(function(){});
  toast('리드 음색 · ' + INST[id].name, 'ok');
  return true;
}

function bindSoundPalette(){
  var rb = $('rhythm-buttons');
  if (rb && !rb.dataset.bound) {
    rb.dataset.bound = '1';
    rb.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('[data-rhythm]') : null;
      if (b) applyRhythm(b.getAttribute('data-rhythm'));
    });
  }
  var kb = $('kit-buttons');
  if (kb && !kb.dataset.bound) {
    kb.dataset.bound = '1';
    kb.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('[data-kit]') : null;
      if (b) applyDrumKit(b.getAttribute('data-kit'));
    });
  }
  var lb = $('lead-buttons');
  if (lb && !lb.dataset.bound) {
    lb.dataset.bound = '1';
    lb.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('[data-lead]') : null;
      if (b) applyLeadTone(b.getAttribute('data-lead'));
    });
  }
  /* 칩 줄 길이가 제각각이면(구버전 캐시) 알려 준다 — 소리 없이 조용히 틀리는 일 방지 */
  RHYTHMS.forEach(function(r){
    var L = (r.meter === 3 ? 12 : 16);
    ['kick','snare','hat','ohat'].forEach(function(k){
      ['A','B'].forEach(function(x){
        var v = (r.pat[x] && r.pat[x][k]) || '';
        if (v.length !== L) console.warn('rhythm pattern length', r.id, x, k, v.length, '!=', L);
      });
    });
  });
  renderSoundPalette();
}

/* ---------------------------------------------------------------- 13. v6 기능
   AURA Studio v6 의 기능을 이 엔진에 맞춰 되살렸다.
   · 트랙 잠금(🔒) & 원클릭 리믹스 — 잠근 트랙은 두고 나머지만 새로
   · 사진 → 음악 — 색감·밝기를 읽어 장르·템포·환경음 자동 세팅
   · 보컬 코러스 패드(Ooh/Aah/Chops) · 마이크 비트박스 → 드럼 패턴
   · 프로 연출 — 구간 전환 라이저 + 마지막 마디 드럼 브레이크다운
   ========================================================================== */

var ROLE_LABEL = { melody:'멜로디', chords:'코드', bass:'베이스', drums:'드럼', arp:'아르페지오', vocal:'보컬' };

/* =======================================================
   13-1. 잠금 & 리믹스
   ======================================================= */
function mutateArrangement(){
  var seed = (Date.now() & 0xffff) || 7;
  var byRole = {};
  S.tracks.forEach(function(t){ byRole[t.role] = t; });
  var kept = [];
  S.tracks.forEach(function(t){ if (t.locked) kept.push(ROLE_LABEL[t.role] || t.role); });

  /* 잠기지 않은 트랙만 악기를 바꾼다 */
  S.tracks.forEach(function(t){
    if (t.locked) return;
    var opts = S.trackOpts[t.role];
    if (opts && opts.length > 1) t.inst = opts[rint(opts.length)];
  });
  if (!byRole.chords || !byRole.chords.locked){ S.chords = []; buildChords(seed); }
  if (!byRole.melody || !byRole.melody.locked) S.notes = genMelody(seed + 3, false);
  if (!byRole.bass || !byRole.bass.locked) S.bass = genBass(seed + 5);
  if (!byRole.arp || !byRole.arp.locked) S.arp = genArp(seed + 7);
  if (!byRole.drums || !byRole.drums.locked) S.drums = genDrums(seed + 9);
  if (!byRole.vocal || !byRole.vocal.locked) S.vocal = genVocal(seed + 11);

  rebuildEvents(); renderMixer(); drawAll(); refreshStats(); refreshLoopInfo();
  renderVocalBadge(); renderDrumSeq(); saveSettings();
  if (AU.ctx) loadNeeded(null).then(function(){ updateSamplerStatus(); renderMixer(); }).catch(function(){});
  toast(kept.length
    ? '🔒 ' + kept.join('·') + ' 은 그대로, 나머지를 새로 리믹스했습니다'
    : '잠긴 트랙 없이 전체를 리믹스했습니다', 'ok');
  return kept;
}

/* =======================================================
   13-2. 프로 연출 — 라이저 · 브레이크다운
   ======================================================= */
function riserBars(){
  var secs = sections();
  var out = [];
  for (var i = 0; i < secs.length - 1; i++){
    var end = secs[i].start + secs[i].len - 1;
    if (end >= 0 && end < S.bars) out.push(end);
  }
  return out;
}

function riserFx(ctx, out, when, durSec){
  if (!ctx || !out || !(durSec > 0)) return;
  var src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  var bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(420, when);
  bp.frequency.exponentialRampToValueAtTime(7200, when + durSec * 0.96);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(0.16, when + durSec * 0.9);
  g.gain.linearRampToValueAtTime(0.0001, when + durSec);
  src.connect(bp); bp.connect(g); g.connect(out);
  try { src.start(when); src.stop(when + durSec + 0.06); } catch (e) {}
}

function fxBadge(){
  var b = $('fx-badge');
  if (b) b.textContent = (S.riser || S.breakdown) ? (S.riser && S.breakdown ? '라이저 + 브레이크' : S.riser ? '라이저' : '브레이크') : 'OFF';
}

/* =======================================================
   13-3. 사진 → 음악
   ======================================================= */
var SCENE_GRAD = {
  sunset:    ['#f97316', '#7c2d12'],
  rainnight: ['#0b1220', '#312e81'],
  ocean:     ['#0ea5e9', '#fef08a'],
  forest:    ['#064e3b', '#94a3b8']
};

function drawPhotoPlaceholder(scene){
  var cv = $('photo-canvas'); if (!cv) return;
  var c = cv.getContext('2d'), W = cv.width, H = cv.height;
  var cols = SCENE_GRAD[scene] || ['#1f2937', '#0b1020'];
  var g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function analyzePhoto(img, scene){
  var cv = $('photo-canvas');
  if (!cv) return;
  var c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  if (img){
    var s = Math.max(W / img.width, H / img.height);
    var dw = img.width * s, dh = img.height * s;
    c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    var cols = SCENE_GRAD[scene] || SCENE_GRAD.sunset;
    var g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    /* 장면 표정 — 해/비/물결/나무를 살짝 */
    c.globalAlpha = 0.5;
    if (scene === 'sunset'){ c.fillStyle = '#fde68a'; c.beginPath(); c.arc(W * 0.75, H * 0.42, H * 0.2, 0, Math.PI * 2); c.fill(); }
    if (scene === 'rainnight'){ c.strokeStyle = '#93c5fd'; c.lineWidth = 1.4; for (var r = 0; r < 18; r++){ var x = (r * 37) % W; c.beginPath(); c.moveTo(x, 4 + (r * 13) % H); c.lineTo(x - 6, 16 + (r * 13) % H); c.stroke(); } }
    if (scene === 'ocean'){ c.strokeStyle = '#e0f2fe'; c.lineWidth = 1.6; for (var o = 0; o < 4; o++){ c.beginPath(); for (var x2 = 0; x2 < W; x2 += 6) c.lineTo(x2, H * 0.55 + o * 9 + Math.sin(x2 / 16 + o) * 3.4); c.stroke(); } }
    if (scene === 'forest'){ c.fillStyle = '#052e16'; for (var t = 0; t < 9; t++){ var bx = 12 + t * 36; c.beginPath(); c.moveTo(bx, H); c.lineTo(bx + 10, H * 0.28); c.lineTo(bx + 20, H); c.fill(); } }
    c.globalAlpha = 1;
  }
  var px;
  try { px = c.getImageData(0, 0, W, H).data; } catch (e) { return; }
  var rSum = 0, gSum = 0, bSum = 0, n = 0;
  for (var i = 0; i < px.length; i += 16){ rSum += px[i]; gSum += px[i + 1]; bSum += px[i + 2]; n++; }
  n = Math.max(1, n);
  var r = rSum / n, gg = gSum / n, b = bSum / n;
  var bright = (r + gg + b) / (3 * 255);
  var warm = (r - b) / 255;
  var green = (gg - Math.max(r, b)) / 255;

  var sw = $('photo-swatches');
  if (sw){
    var cols2 = [
      'rgb(' + Math.round(r) + ',' + Math.round(gg) + ',' + Math.round(b) + ')',
      'rgb(' + Math.min(255, Math.round(r + 34)) + ',' + Math.round(gg) + ',' + Math.round(b) + ')',
      'rgb(' + Math.round(r) + ',' + Math.round(gg) + ',' + Math.min(255, Math.round(b + 38)) + ')'
    ];
    Array.prototype.forEach.call(sw.children, function(el2, k){
      if (cols2[k]) el2.style.background = cols2[k];
    });
  }

  var pid, amb, label;
  var SCENE_MAP = {
    sunset:    ['acoustic',  { fire:30,  rain:0,  cafe:0,  ocean:0 }, '노을 — 따뜻한 어쿠스틱 팝'],
    rainnight: ['lofi',      { rain:32,  fire:14, cafe:16, ocean:0 }, '비 오는 밤 — 로파이 카페'],
    ocean:     ['techhouse', { ocean:32, rain:0,  cafe:0,  fire:0 }, '바다 — 시원한 클럽 비트'],
    forest:    ['ambient',   { rain:24,  fire:0,  cafe:0,  ocean:0 }, '숲 — 힐링 앰비언트']
  };
  if (scene && SCENE_MAP[scene]){
    pid = SCENE_MAP[scene][0]; amb = SCENE_MAP[scene][1]; label = SCENE_MAP[scene][2];
  } else if (green > 0.045){ pid = 'ambient'; amb = { rain:24, cafe:0, fire:0, ocean:0 }; label = '초록이 많은 장면 — 힐링 앰비언트'; }
  else if (bright > 0.58 && b >= r){ pid = 'techhouse'; amb = { ocean:30, rain:0, cafe:0, fire:0 }; label = '밝고 푸른 장면 — 시원한 클럽 비트'; }
  else if (warm > 0.09){ pid = bright > 0.5 ? 'acoustic' : 'lofi'; amb = bright > 0.5 ? { fire:30, rain:0, cafe:0, ocean:0 } : { fire:20, cafe:18, rain:0, ocean:0 }; label = bright > 0.5 ? '따뜻하고 밝은 장면 — 어쿠스틱 팝' : '따뜻하고 어두운 장면 — 로파이 카페'; }
  else if (bright < 0.34){ pid = 'citypop'; amb = { rain:30, cafe:16, fire:0, ocean:0 }; label = '어두운 밤 장면 — 시티팝 드라이브'; }
  else { pid = bright > 0.62 ? 'kpop' : 'bossa'; amb = { cafe:24, rain:0, fire:0, ocean:0 }; label = '부드러운 중간 톤 — 카페 보사노바'; }

  var p = PRESETS.filter(function(x){ return x.id === pid; })[0] || PRESETS[0];
  applyPresetValues(p, true);
  S.bright = clamp(Math.round(bright * 100), 18, 96);
  S.energy = clamp(Math.round(34 + (1 - bright) * 46), 18, 92);
  ['rain','fire','cafe','ocean'].forEach(function(k){ S.amb[k] = amb[k] || 0; });
  S.chords = [];
  composeAll(Date.now() & 0xffff, { newChords:true });
  S.aiTitle = '사진 분석 · ' + p.name;
  S.aiTip = label + ' · 밝기 ' + Math.round(bright * 100) + '% · 따뜻함 ' + Math.round(warm * 100) +
    ' · 환경음 ' + (Object.keys(amb).filter(function(k){ return amb[k]; }).map(function(k){ return ({rain:'빗소리',fire:'모닥불',cafe:'카페',ocean:'파도'})[k]; }).join('·') || '없음') + ' 자동 세팅';
  S.aiSource = 'photo';
  var mt = $('mood-text');
  if (mt) mt.value = label.replace(' — ', ', ');
  var badge = $('photo-badge');
  if (badge){ badge.textContent = p.name; badge.className = 'badge ok'; }
  var text = $('photo-text');
  if (text) text.textContent = '분석 완료 — 밝기 ' + Math.round(bright * 100) + '% · ' + label + '. 프리셋·템포·환경음을 다시 맞췄습니다.';

  syncPresetUI(); applyStateToUI(); renderMixer(); refreshStats(); refreshLoopInfo();
  drawAll(); renderDrumSeq(); renderAmb(); showAiCard();
  if (AU.ctx) ambApply();
  if (AU.ctx) loadNeeded(null).then(function(){ updateSamplerStatus(); }).catch(function(){});
  toast('사진 색감으로 ' + p.name + ' 곡을 만들었습니다', 'ok');
  return { preset:pid, brightness:bright, warm:warm, green:green };
}

function bindPhoto(){
  var inp = $('photo-file');
  if (inp) inp.addEventListener('change', function(){
    var f = inp.files && inp.files[0];
    if (f){
      var im = new Image();
      im.onload = function(){ analyzePhoto(im); };
      im.onerror = function(){ toast('이미지를 읽을 수 없습니다', 'err'); };
      im.src = URL.createObjectURL(f);
    }
    inp.value = '';
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-scene]'), function(b){
    b.addEventListener('click', function(){ analyzePhoto(null, b.dataset.scene); });
  });
  drawPhotoPlaceholder('sunset');
}

/* =======================================================
   13-4. 보컬 코러스 패드
   ======================================================= */
function vocalTrack(){ return S.tracks.filter(function(t){ return t.role === 'vocal'; })[0]; }

function renderVocalBadge(){
  var t = vocalTrack();
  var b = $('vox-badge');
  if (b && t) b.textContent = t.mute ? '꺼짐' : (INST[t.inst] ? INST[t.inst].name : t.inst);
  Array.prototype.forEach.call(document.querySelectorAll('[data-vox]'), function(el2){
    var id = el2.dataset.vox;
    var on = t && (id === 'off' ? t.mute : (!t.mute && t.inst === id));
    el2.classList.toggle('on', !!on);
  });
}

function setVocal(id){
  var t = vocalTrack();
  if (!t) return;
  if (id === 'off'){
    t.mute = true;
  } else {
    t.inst = id;
    t.mute = false;
    S.vocal = genVocal((Date.now() & 0xffff) + 41);
  }
  refreshMix(); renderMixer(); renderVocalBadge(); rebuildEvents(); refreshStats(); saveSettings();
  if (AU.ctx) loadNeeded(null).then(function(){ updateSamplerAfterVocal(); }).catch(function(){});
  toast(id === 'off' ? '보컬 패드를 껐습니다' : '보컬 패드 — ' + (INST[id] ? INST[id].name : id), 'ok');
}
function updateSamplerAfterVocal(){ try { updateSamplerStatus(); renderMixer(); } catch (e) {} }

/* =======================================================
   13-5. 마이크 비트박스 → 드럼
   ======================================================= */
var BB = { timer:null, stream:null, an:null, step:0, bar:0 };

function upsertDrum(bar, step, row, vel){
  for (var i = 0; i < S.drums.length; i++){
    var n = S.drums[i];
    if (n.bar === bar && n.step === step && n.row === row){
      n.vel = Math.max(n.vel || 0, vel);
      return;
    }
  }
  S.drums.push({ bar:bar, step:step, row:row, vel:vel });
}

function stopBeatbox(auto){
  if (BB.timer){ clearInterval(BB.timer); BB.timer = null; }
  if (BB.stream){ BB.stream.getTracks().forEach(function(t){ try { t.stop(); } catch (e) {} }); BB.stream = null; }
  BB.an = null;
  var btn = $('btn-beatbox');
  if (btn){ btn.classList.remove('recpulse'); btn.textContent = '🎤 비트박스 녹음'; }
  var st = $('bb-state');
  if (st){ st.textContent = auto ? '완료' : '대기'; st.classList.remove('on'); }
  rebuildEvents(); renderDrumSeq(); drawDrums(); refreshStats(); saveSettings();
  if (auto) toast('비트박스를 드럼으로 옮겼습니다 · ' + (S.drumBar + 1) + '마디', 'ok');
}

function toggleBeatbox(){
  if (BB.timer){ stopBeatbox(false); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    toast('이 브라우저는 마이크를 지원하지 않습니다 — 샘플 패턴을 눌러 보세요', 'warn');
    return;
  }
  ensureAudio().then(function(){
    return navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:true } });
  }).then(function(stream){
    BB.stream = stream;
    var src = AU.ctx.createMediaStreamSource(stream);
    var an = AU.ctx.createAnalyser();
    an.fftSize = 512; an.smoothingTimeConstant = 0.2;
    src.connect(an);
    BB.an = an; BB.step = 0; BB.bar = S.drumBar;
    var btn = $('btn-beatbox');
    if (btn){ btn.classList.add('recpulse'); btn.textContent = '■ 녹음 중지'; }
    var st = $('bb-state');
    if (st){ st.textContent = '● 듣는 중'; st.classList.add('on'); }
    var note = $('bb-note');
    if (note) note.textContent = '듣고 있어요 — "붐—칫—타" 2초! 저음=킥 · 중음=스네어 · 고음=하이햇.';
    if (!AU.playing) startPlayback();
    var stepMs = (60 / S.bpm) / 4 * 1000;
    var freq = new Uint8Array(an.frequencyBinCount);
    BB.timer = setInterval(function(){
      if (!BB.an) return;
      BB.an.getByteFrequencyData(freq);
      function avg(a, b){ var s = 0; for (var i = a; i < b; i++) s += freq[i]; return s / Math.max(1, b - a); }
      var low = avg(1, 9), mid = avg(12, 40), high = avg(50, 120);
      var peak = Math.max(low, mid, high);
      if (peak > 55){
        var row = (low === peak) ? 'kick' : (mid === peak ? 'snare' : 'hat');
        upsertDrum(BB.bar, BB.step % barLen(), row, clamp(peak / 170, .35, 1));
        renderDrumSeq(); drawDrums();
      }
      BB.step++;
      var barEl = $('bb-state');
      if (barEl) barEl.textContent = '● ' + BB.step + '/' + barLen();
      if (BB.step >= barLen()) stopBeatbox(true);
    }, stepMs);
  }).catch(function(){
    stopBeatbox(false);
    toast('마이크를 열 수 없습니다 — [샘플 패턴]으로 리듬을 채워 보세요', 'warn');
  });
}

function beatboxDemo(){
  var bar = S.drumBar;
  S.drums = S.drums.filter(function(n){ return n.bar !== bar; });
  var pat = { kick:[0,6,8,14], snare:[4,12], hat:[0,2,4,6,8,10,12,14] };
  Object.keys(pat).forEach(function(row){
    pat[row].forEach(function(st){ S.drums.push({ bar:bar, step:st, row:row, vel: row === 'hat' ? .5 : .85 }); });
  });
  rebuildEvents(); renderDrumSeq(); drawDrums(); refreshStats(); saveSettings();
  var st = $('bb-state'); if (st){ st.textContent = '샘플'; st.classList.remove('on'); }
  toast((bar + 1) + '마디에 샘플 비트를 넣었습니다', 'ok');
}

/* =======================================================
   13-6. 배선 · 동기화
   ======================================================= */
function syncV6Controls(){
  var r = $('chk-riser'); if (r) r.checked = S.riser !== false;
  var b = $('chk-breakdown'); if (b) b.checked = S.breakdown !== false;
  fxBadge();
  renderVocalBadge();
}

function initV6(){
  bindPhoto();
  var remix = $('btn-remix'); if (remix) remix.addEventListener('click', mutateArrangement);
  var riser = $('chk-riser');
  if (riser) riser.addEventListener('change', function(){
    S.riser = riser.checked; fxBadge(); saveSettings();
  });
  var bd = $('chk-breakdown');
  if (bd) bd.addEventListener('change', function(){
    S.breakdown = bd.checked; rebuildEvents(); refreshStats(); drawDrums(); fxBadge(); saveSettings();
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-vox]'), function(el2){
    el2.addEventListener('click', function(){ setVocal(el2.dataset.vox); });
  });
  var bb = $('btn-beatbox'); if (bb) bb.addEventListener('click', toggleBeatbox);
  var bb2 = $('btn-beatbox-demo'); if (bb2) bb2.addEventListener('click', beatboxDemo);
  syncV6Controls();
}

/* =======================================================
   13-7. 사이드체인 펌핑
   ======================================================= */
function pumpAt(ctx, node, when){
  if (!ctx || !node) return;
  var g = node.gain;
  try {
    g.setValueAtTime(0.55, when);
    g.linearRampToValueAtTime(1, when + 0.16);
  } catch (e) {}
}

/* =======================================================
   13-8. 2D 감정 패드 (XY)
   ======================================================= */
function toneFromXY(){ return Math.round(2200 + clamp(S.xy.x, 0, 1) * 13800); }

function drawXYPad(){
  var cv = $('xy-canvas'); if (!cv) return;
  var f = fitCanvas(cv); if (!f) return;
  var c = f.c, W = f.w, H = f.h, d = f.d, P = pal();
  c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
  c.strokeStyle = P.gridSoft; c.lineWidth = 1;
  for (var i = 1; i < 4; i++){
    c.beginPath(); c.moveTo(i * W / 4, 0); c.lineTo(i * W / 4, H); c.stroke();
    c.beginPath(); c.moveTo(0, i * H / 4); c.lineTo(W, i * H / 4); c.stroke();
  }
  c.strokeStyle = P.beat;
  c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
  c.fillStyle = P.tx2; c.font = '700 ' + (9 * d) + 'px "Pretendard Variable", Pretendard, sans-serif';
  c.fillText('어둡게', 4 * d, H / 2 - 5 * d);
  c.textAlign = 'right'; c.fillText('밝게', W - 4 * d, H / 2 - 5 * d); c.textAlign = 'left';
  c.fillText('격렬', W / 2 + 4 * d, 11 * d);
  c.fillText('차분', W / 2 + 4 * d, H - 4 * d);
  var px = clamp(S.xy.x, 0, 1) * W, py = (1 - clamp(S.xy.y, 0, 1)) * H;
  c.fillStyle = 'rgba(34,211,238,.22)';
  c.beginPath(); c.arc(px, py, 14 * d, 0, Math.PI * 2); c.fill();
  c.fillStyle = P.note;
  c.beginPath(); c.arc(px, py, 6 * d, 0, Math.PI * 2); c.fill();
  var rd = $('xy-readout');
  if (rd) rd.textContent = Math.round(S.xy.x * 100) + '·' + Math.round(S.xy.y * 100);
}

function applyXYLive(){
  S.master.tone = toneFromXY();
  if (AU.ctx && AU.master) setMasterParam('tone', S.master.tone);
  drawXYPad();
}

function commitXY(){
  var en = clamp(Math.round(18 + clamp(S.xy.y, 0, 1) * 82), 10, 100);
  if (en !== S.energy){
    S.energy = en;
    var es = $('energy-slider'); if (es) es.value = en;
    var ev = $('energy-val'); if (ev) ev.textContent = en;
    rebuildDynamics(); drawEnergy(); refreshStats(); updatePrompt();
  }
  saveSettings();
}

function bindXY(){
  var cv = $('xy-canvas'); if (!cv) return;
  var drag = false;
  function act(e){
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    S.xy.x = clamp((e.clientX - r.left) / r.width, 0, 1);
    S.xy.y = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    applyXYLive();
  }
  cv.addEventListener('pointerdown', function(e){ e.preventDefault(); drag = true; try { cv.setPointerCapture(e.pointerId); } catch (e2) {} act(e); });
  cv.addEventListener('pointermove', function(e){ if (drag) act(e); });
  cv.addEventListener('pointerup', function(){ if (!drag) return; drag = false; commitXY(); });
  cv.addEventListener('pointercancel', function(){ if (!drag) return; drag = false; commitXY(); });
  drawXYPad();
}

/* =======================================================
   13-9. 코드 롤링 · 프로젝트 보관함 · A/B 스냅샷
   ======================================================= */
function bindRoll(){
  var rs = $('roll-slider'); if (!rs) return;
  rs.addEventListener('input', function(){
    S.roll = clamp(+rs.value, 0, 100);
    var rv = $('roll-val'); if (rv) rv.textContent = S.roll;
    rebuildEvents(); saveSettings();
  });
}

function bindPump(){
  var c = $('chk-pump'); if (!c) return;
  c.addEventListener('change', function(){
    S.pump = c.checked;
    if (!S.pump && AU.pumpBus && AU.ctx){ try { AU.pumpBus.gain.cancelScheduledValues(AU.ctx.currentTime); AU.pumpBus.gain.value = 1; } catch (e) {} }
    saveSettings();
    toast(S.pump ? '사이드체인 펌핑 ON — 킥마다 베이스·코드가 살짝 눌립니다' : '사이드체인 펌핑 OFF');
  });
}

var LIB_KEY = 'aura_library';
function libRead(){ try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch (e) { return []; } }
function libWrite(l){ try { localStorage.setItem(LIB_KEY, JSON.stringify(l)); } catch (e) { toast('저장 공간이 부족합니다', 'err'); } }

function renderLibrary(){
  var box = $('proj-list'); if (!box) return;
  var list = libRead();
  if (!list.length){ box.innerHTML = '<div class="tiny">아직 저장한 곡이 없습니다. 위에 이름을 적고 [저장]을 누르세요.</div>'; return; }
  box.innerHTML = list.map(function(it, i){
    var d = new Date(it.at || Date.now());
    var stamp = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    var dt = it.data || {};
    return '<div class="sub row between" style="padding:7px 9px;gap:6px;">' +
      '<div style="min-width:0;">' +
        '<div style="font-size:11.5px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(it.name || '이름 없음') + '</div>' +
        '<div class="tiny">' + stamp + ' · ' + (dt.bpm || '?') + ' BPM · ' + (dt.bars || '?') + '마디</div>' +
      '</div>' +
      '<div class="row" style="gap:4px;flex:0 0 auto;">' +
        '<button class="btn sm" data-lib-load="' + i + '">불러오기</button>' +
        '<button class="btn sm" data-lib-del="' + i + '" style="color:var(--rose);" aria-label="지우기">✕</button>' +
      '</div></div>';
  }).join('');
  Array.prototype.forEach.call(box.querySelectorAll('[data-lib-load]'), function(b){
    b.addEventListener('click', function(){
      var it = libRead()[+b.dataset.libLoad];
      if (!it) return;
      if (applyProject(it.data)){
        S.aiTitle = it.name || S.aiTitle;
        renderVocalBadge(); renderAmb(); renderTeleprompter(); renderDrumSeq(); drawXYPad();
        toast('보관함에서 불러왔습니다 · ' + it.name, 'ok');
      }
    });
  });
  Array.prototype.forEach.call(box.querySelectorAll('[data-lib-del]'), function(b){
    b.addEventListener('click', function(){
      var list2 = libRead();
      var it = list2.splice(+b.dataset.libDel, 1)[0];
      libWrite(list2); renderLibrary();
      toast((it ? it.name : '곡') + ' 을(를) 보관함에서 지웠습니다');
    });
  });
}

function librarySave(){
  var nameEl = $('proj-name');
  var name = (nameEl && nameEl.value.trim()) || ('AURA ' + S.bpm + ' BPM · ' + S.bars + '마디');
  var list = libRead();
  list.unshift({ id:'p' + Date.now(), name:name.slice(0, 40), at:Date.now(), data:projectSnapshot() });
  if (list.length > 20) list = list.slice(0, 20);
  libWrite(list); renderLibrary();
  if (nameEl) nameEl.value = '';
  toast('보관함에 저장했습니다 · ' + name, 'ok');
}

function libraryExport(){
  var list = libRead();
  if (!list.length){ toast('보관함이 비어 있습니다', 'warn'); return; }
  downloadBlob(new Blob([JSON.stringify({ type:'aura-library', v:1, savedAt:Date.now(), items:list }, null, 1)], { type:'application/json' }),
    'aura_library_' + new Date().toISOString().slice(0, 10) + '.json');
  toast('보관함 ' + list.length + '곡을 JSON으로 내려받았습니다', 'ok');
}

function libraryImport(file){
  var fr = new FileReader();
  fr.onload = function(){
    try {
      var d = JSON.parse(String(fr.result));
      var items = Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : null);
      if (!items){ toast('보관함 JSON 형식이 아닙니다', 'err'); return; }
      var list = libRead();
      items.forEach(function(it){
        if (!it || !it.data) return;
        list.unshift({ id:'p' + (Date.now() + Math.floor(Math.random() * 999)), name:String(it.name || '가져온 곡').slice(0, 40), at:it.at || Date.now(), data:it.data });
      });
      if (list.length > 40) list = list.slice(0, 40);
      libWrite(list); renderLibrary();
      toast('보관함 ' + items.length + '곡을 가져왔습니다', 'ok');
    } catch (e){ toast('파일을 읽을 수 없습니다', 'err'); }
  };
  fr.readAsText(file);
}

var SNAP_KEY = 'aura_snapshots';
function snapRead(){ try { var o = JSON.parse(localStorage.getItem(SNAP_KEY) || '{}'); return { A:o.A || null, B:o.B || null }; } catch (e) { return { A:null, B:null }; } }
function snapWrite(s){ try { localStorage.setItem(SNAP_KEY, JSON.stringify(s)); } catch (e) {} }

function renderSnap(){
  var s = snapRead();
  ['A','B'].forEach(function(k){
    var info = $('snap-' + k.toLowerCase() + '-info');
    if (!info) return;
    if (!s[k]) { info.textContent = '비어 있음'; return; }
    var d = new Date(s[k].at || Date.now());
    info.textContent = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ' · ' + (s[k].bpm || '?') + 'BPM';
  });
  var act = $('snap-active'); if (act) act.textContent = S.snapActive || 'A';
}

function snapSave(slot){
  var s = snapRead();
  var snap = projectSnapshot();
  snap.at = Date.now();
  s[slot] = snap;
  snapWrite(s);
  S.snapActive = slot;
  renderSnap();
  toast('스냅샷 ' + slot + '에 현재 설정을 저장했습니다', 'ok');
}
function snapLoad(slot, quiet){
  var s = snapRead();
  if (!s[slot]){ if (!quiet) toast('스냅샷 ' + slot + '이 비어 있습니다', 'warn'); return false; }
  if (!applyProject(s[slot])) return false;
  S.snapActive = slot;
  renderSnap(); renderVocalBadge(); renderAmb(); renderDrumSeq(); renderTeleprompter(); drawXYPad(); syncV6Controls();
  if (!quiet) toast('스냅샷 ' + slot + '을 불러왔습니다', 'ok');
  return true;
}
function snapToggle(){
  var next = (S.snapActive === 'A') ? 'B' : 'A';
  var s = snapRead();
  if (!s[next]){
    /* 빈 칸이면 지금 설정을 그 칸에 넣고 A로 돌아간다 */
    snapSave(next);
    return;
  }
  snapLoad(next, true);
  toast('스냅샷 ' + next + ' 재생', 'ok');
  if (!AU.playing) startPlayback();
}

function initExtras(){
  bindXY(); bindRoll(); bindPump();
  var bi = $('btn-lib-save'); if (bi) bi.addEventListener('click', librarySave);
  var imp = $('btn-import-proj');
  if (imp) imp.addEventListener('click', function(){
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = function(){
      var f = inp.files && inp.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function(){
        var txt = String(fr.result);
        try {
          var d = JSON.parse(txt);
          if (Array.isArray(d) || (d && Array.isArray(d.items))) libraryImport(f);
          else if (d && d.chords && applyProject(d)) { toast('프로젝트를 불러왔습니다', 'ok'); renderVocalBadge(); renderAmb(); }
          else toast('읽을 수 있는 프로젝트가 아닙니다', 'err');
        } catch (e){ toast('파일을 읽을 수 없습니다', 'err'); }
      };
      fr.readAsText(f);
    };
    inp.click();
  });
  var exp = $('btn-lib-export'); if (exp) exp.addEventListener('click', libraryExport);
  Array.prototype.forEach.call(document.querySelectorAll('[data-snap-save]'), function(b){
    b.addEventListener('click', function(){ snapSave(b.dataset.snapSave); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-snap-load]'), function(b){
    b.addEventListener('click', function(){ snapLoad(b.dataset.snapLoad); });
  });
  var st = $('btn-snap-toggle'); if (st) st.addEventListener('click', snapToggle);
  renderLibrary(); renderSnap();
  drawXYPad();
}

/* 부팅 — 엔진(10~17)과 v6 기능(18)이 모두 준비된 뒤 */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
