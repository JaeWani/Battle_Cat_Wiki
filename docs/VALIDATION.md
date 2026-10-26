# 검증 기록

## 자동 검증
- 계산 엔진 테스트 23개: 레벨 성장표, 특수 성장, 알려진 기본 캐릭터/각성 무트 수치, 보물, 배율, 연속공격, 경계 입력, 메탈, 크리티컬 적용 타격, 속성 보정, 공격 제한, 특효, 공격 없는 적, 예외 안내, 검색, 번역 연결.
- 아군 2,177개 형태와 적 792종에 대해 계산 가능한지 확인.
- 2,969개 이미지의 존재, PNG 시그니처, SHA-256을 보관본과 대조.
- JavaScript 구문 검사.

## 실제 브라우저
- 적 선택창: 모든 카드에 이미지/전체 이름, 빨간 적 필터, 이름 검색의 결합 확인.
- 계산기: 캐릭터 선택, 레벨/배율 변경, 잘못된 입력 시 이전 결과 숨김 확인.
- 적군 도감 → 상세 정보 → 배율 변경 → 계산기에 적용 흐름 확인.
- 새로고침 시 선택/조건 복원 확인.
- 390px 모바일 프레임에서 레이아웃과 수평 넘침 없음 확인.

## 수치 샘플
최대 세계편 보물, 각성의 고양이 무트 Lv.30, 맴매 선생 300%:
- 아군 체력 25,500, 직접 공격 85,000 + 3,400 + 5,100.
- 적 체력 299,997, 직접 공격 6,750, 인식 사거리 모두 200.
- 본체 처치까지 10타격(공격 동작 4회).
- 아군은 4번째 피격에 사망, 3타격까지 생존.

실전 전투를 시뮬레이션한 승패 판정이 아닙니다.

## 이벤트 일정 홈 (2026-10-25)
- 첫 방문은 `home` 이벤트 일정. 기존 `#calculator` 링크는 계산기로 바로 연결.
- 한국판 PONOS 공식 공지 25건에서 명시된 개최 기간 17건과 반복 개최일 2건 추출. 전체 게임 일정으로 표시하지 않음.
- 날짜/필터/검색, 미확인 기간의 소식 분리, 반복 공지 중복 제거, 공식 원본 배너 및 SHA-256 검증.
- JavaScript 테스트 33개 + 수집기 Python 테스트 6개 통과.
- 실제 브라우저에서 첫 화면, 뽑기 3건 필터, 이름 검색, 날짜 변경, 계산기 탭 이동, 로고 홈 복귀 확인.
- 390px 모바일 프레임 수평 넘침 없음 확인.
- GitHub Actions에서 6시간 주기 재수집. 수집 실패는 기존 스냅샷 유지; 36시간 경과 시 갱신 지연 표시.

## 공식 스테이지 탭 (2026-10-25)

- 공식 한국판 안내 79개 맵, 514개 스테이지, PONOS 직접 다운로드 원본 PNG 278종. URL 및 전체 이미지 SHA-256 검증 통과.
- Node 37개 테스트, Python 10개 테스트 통과. 스테이지 파서는 숨김 상태의 공개 적 목록, 물음표 제외, 아이콘 중복 제거, 획득 상태 제외, 비공식 출처 거부를 검증했다. 일정 연결은 정확한 KR 맵 이름 일치와 주기 공지 보존을 검증했다.
- 브라우저에서 풍운 냥코탑 50층 선택·다음 비활성화·49층 이전 이동, 스테이지 이름 검색으로 대성어 결전 직접 선택, 사이클론 필터 3개, 자료 없는 분류의 빈 상태를 확인했다.
- 풍운 냥코탑 공식 기간 10/5 11:00~10/29 10:59, 종말의 배틀 그라운드 토·일 반복 개최(시간 미확인), 대천사 개복치 대강림의 개최일 미확인 상태를 확인했다.
- 390px iframe 모바일 화면에서 5개 메뉴가 한 줄로 표시되고 상세 너비 375px/scrollWidth 375px로 가로 넘침이 없었다. 대성어 III의 공식 적 아이콘 7개 모두 정상 로딩. 순서 이동과 검색 작동 확인.
- 카탈로그는 공식 안내가 확인된 일부 스냅샷이다. 적 이름·배율·마릿수·출현 시각·개별 개방일 및 공식 자료 미확인 분류는 추정하지 않는다.

배포 확인: 소스 커밋 `6416c6721bb916437165da5f77f2753e2074f8c8`, [Pages 실행 40158478314](https://github.com/JaeWani/Battle_Cat_Wiki/actions/runs/40158478314) 성공. 공식 일정 수집·검증·배포 모두 성공했다. 실서비스 `https://jaewani.github.io/Battle_Cat_Wiki/#stages`에서 79개 맵/514개 스테이지 표시, 풍운 냥코탑 공식 기간, 50층에서 49층 이동 및 적 아이콘 4개 원본 로딩을 확인했다. 배포 시 공식 일정 확인 시각은 2026-10-25 12:30 KST였다. [배포 화면](stage-guide-live-20261025.jpg).

## 스테이지 전수 후보 조사 확장 (2026-10-25)

- 알려진 후보 공식 경로 1,295개를 조사. 공식 맵 이름이 있는 1,067개 맵/4,976개 스테이지 수집. 183개 HTTP 403, 43개 맵 이름 미제공, 2개 더미 안내는 수집 현황에 남기고 카탈로그에서 제외.
- 한국어 안내 맵 1,000개와 원문 맵 67개를 분리. 적 아이콘 참조 729개 중 PONOS 원본 PNG 723개 확인, 6개 HTTP 403은 이미지 미확인 표시. 327개 개별 스테이지 이름 미제공 상태를 임의 번역으로 채우지 않음.
- Node 39개/Python 13개 테스트 통과. 전체 13개 계열을 복원한 상세가 원본 스냅샷과 동일하며 모든 출처 URL·원문 해시·원본 PNG 해시·집계 수를 검증.
- 압축 스냅샷/원본 PNG 복원 및 체크섬 검사 통과. 검색 색인 581,015바이트, 상세는 계열별 선택 로딩. 맵 목록 36개 단위 페이지 이동 확인.
- 브라우저에서 신 레전드→레전드 제로 빠른 전환 시 마지막 선택 유지, 제로 필드 및 35개 맵/205개 스테이지 표시 확인. B000은 통솔력 대신 '고양이 드링크A 3개'로 표시. S341의 이름 미기재와 이미지 미확인 상태, C000의 원문 언어 안내, 메인 계열의 미확인 설명 확인.
- 모바일 390px iframe에서 body 375px/scrollWidth 375px로 가로 넘침 없음. 수집 현황 표만 내부 가로 스크롤. 신 레전드 고대의 저주 적 아이콘 407/406 정상 로딩. 목록 2/28 페이지 이동 확인.
- 전체 게임 데이터 확보를 보장하지 않는다. 메인/EX/도장/미궁 등 미확인 계열과 성급별 수치·현재 개방 여부는 별도 출처가 필요하다.

## Stage enemy magnifications — 2026-10-25

- Node 42 tests and Python 16 tests pass; official JSON, artwork checksums, and lazy family equivalence remain valid.
- All 4,976 published stages have a game-data outcome: 4,852 available; 87 missing source rows; 37 enemy-list mismatches. All 29,223 enemy variants reference an existing character.
- Browser: V000 floor 2 displays Black Doge 0.4× / 40%, with reviewed wiki comparison. NA000 crown 2 changes both listed relic enemies from 1× to 1.5×. Source links and sample-only wording visible.
- Raw official data and icons unchanged. Battle tables use existing original-game artwork assets.

## Public notice link time error — 2026-10-26

PONOS detail 14474 returns the normal Korean event content without `clientTime` / `timeDifference`, verified by HTTP response and browser. Public links now omit those ephemeral device-time parameters while preserving notice ID, Korean locale, version and progress context. Shared normalization covers event banners, titles, source/index links, news cards and stage schedule links. Collector URLs omit device-time fields for future snapshots. Existing snapshots remain compatible through frontend normalization. Regression tests cover stale timestamps, index links, retained parameters, idempotency and unrelated hosts. App/module version URLs refresh cached code.
