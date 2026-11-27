# 🎵 AURA Studio Pro — AI 작곡 · 허밍 편곡 · 쇼츠 BGM 스튜디오

한 줄 무드로 AI가 코드·멜로디·드럼을 짜고, **실제 악기 원음**으로 16마디를 연주하며,
**15·30·60초 심리스 루프 WAV**와 **MIDI**로 내보내는 브라우저 작곡 스튜디오입니다.

- 라이브: **https://aura-studio-pro.vercel.app**
- 가족 PIN: **0623** (첫 진입 1회 · [이 기기에서 유지] 선택 · 상단 🔒 재잠금)
- 폰 홈 화면 설치(PWA) 지원 · 다크/라이트 테마 · 한글 사용설명서

## 무엇이 들어 있나

| 영역 | 내용 |
|---|---|
| 사운드 엔진 | Salamander 그랜드피아노 · 첼로 · 일렉베이스 · 어쿠스틱기타 · 하프 · 오르간 · 플루트 · 실로폰 샘플 + 어쿠스틱/CR-78/KPR-77/LINN/R-8/Stark 드럼 킷. 샘플을 못 받으면 **자동 신스 폴백** |
| 편곡 | 8~16마디 섹션 전개(Intro→A→B→A′→Outro), 4마디 끝 드럼 필인, 7th/9th 보이싱, 휴머나이즈(강약·타이밍), 스윙 |
| AI 작곡 | `POST /api/content-ai {action:'aura_compose', mood}` → Gemini가 제목·BPM·키·코드·멜로디·드럼 JSON 생성. 쿼터/오류 시 **내장 엔진 폴백** |
| 허밍 | 마이크 피치 감지 → 스케일 보정·박자 정렬 → 1마디 클린 가이드 → 16마디 편곡 반영 (마이크 없으면 샘플 데모) |
| 믹서 | 5트랙 M/S·악기 교체·볼륨·팬 + 마스터 EQ/리버브/웜스/리미터/미터 |
| 내보내기 | `OfflineAudioContext` 로 **재생과 동일한 그래프**를 다시 렌더 → 루프 테일을 앞에 감아 이음매 없는 WAV · 4트랙 MIDI(멜로디/코드/베이스/드럼) |
| 보존 | 프로젝트 localStorage 저장 + JSON 내려받기/불러오기 |

## 구조

```
index.html      화면 (스타일·마크업·PIN 잠금)
app.js          엔진 (Web Audio · 작곡 · 캔버스 · 내보내기)
manifest.json   PWA 매니페스트
sw.js           서비스워커 (화면 네트워크 우선 · 오프라인 셸)
vercel.json     캐시 헤더
icons/          192 / 512 / maskable / apple 180
```

## 참고

- 외부 의존성 없음(Tailwind·Tone.js CDN 을 쓰지 않고 Web Audio 로 직접 구현) → 오프라인에서도 UI 가 열립니다.
- 악기 샘플은 공개 CDN(Salamander / tonejs drum-samples / tonejs-instruments)에서 받아 브라우저 캐시에 담습니다. 트랙당 2~3MB 수준이며, 첫 재생 때만 기다리면 됩니다.
- PIN 은 화면 가림용입니다. `/api/content-ai` 는 관제탑·쇼츠·이모티콘 스튜디오와 같은 공용 엔드포인트입니다.
