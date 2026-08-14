# 지침 A: 2048 페이지 — 빌드 & 템플릿

## 역할

Work 단계 서브에이전트 **A**. 게임 페이지가 빌드에서 생성되게 만든다. **게임 로직도 스타일도 네 일이 아니다.**

설계는 [`docs/spec-2048.md`](../spec-2048.md)에 확정되어 있다. **먼저 정독하라.** 특히 §1(배치 결정), §8(파일 목록·DOM 계약), §7(접근성).
spec과 이 지침이 어긋나면 spec이 우선이다. spec이 틀렸다고 판단되면 고치지 말고 보고하라.

## 수정 허용 범위

**이 두 파일만 수정한다:**

- `scripts/build.js`
- `scripts/lib/templates.js`

다른 파일은 만들지도 고치지도 않는다. 특히 다음은 **다른 에이전트가 동시에 작업 중**이라 절대 건드리면 안 된다:

- `assets/js/game-2048-core.js`, `assets/js/game-2048-ui.js` (에이전트 C·B)
- `assets/css/game-2048.css`, `assets/css/variables.css` (에이전트 C)
- `scripts/test-2048.js`, `package.json` (에이전트 B)

그 파일들이 아직 없어도 정상이다. 네 산출물은 그것들이 없어도 빌드가 통과해야 한다(브라우저에서 404가 나는 것은 이 단계에서 정상).

읽기는 어디든 자유롭다.

## 할 일

### 1. `baseLayout`에 페이지별 자원 주입 지점 추가

현재 `baseLayout`은 스타일시트 4개와 `theme-toggle.js`를 하드코딩하고 있어 페이지별 자원을 넣을 자리가 없다.

- 옵션 객체에 `extraStyles = []`, `extraScripts = []`를 **기본값 빈 배열로** 추가한다. 기본값이 있어야 기존 두 호출부(`renderIndexPage`, `renderPostPage`)를 수정하지 않아도 된다 — 실제로 수정하지 마라.
- `extraStyles`는 기존 스타일시트 4줄 **뒤에** 렌더링한다. 게임 CSS는 `variables.css`의 토큰을 소비만 하므로 반드시 뒤여야 한다.
- `extraScripts`는 `theme-toggle.js` **뒤에** `defer`로 렌더링한다. `defer` 스크립트는 문서 순서대로 실행되므로, 배열 순서가 곧 실행 순서다.
- **모든 경로는 `href(site, ...)`를 통과시킨다.** 이걸 빼먹으면 로컬에서는 멀쩡하고 배포 사이트(`/my-blog/`)에서만 404가 난다. 이 프로젝트에서 가장 조용히 깨지는 실패다.

### 2. 헤더 nav에 게임 링크 추가

`.site-nav` 안, 테마 토글 **앞에** `2048` 링크를 넣는다. 경로는 `/games/2048/`, 반드시 `href(site, ...)` 경유.

이 변경은 **모든 페이지에 영향**을 준다. 인덱스와 글 페이지 헤더가 깨지지 않는지 직접 확인하라.

### 3. `renderGamePage(site)` 추가 및 export

spec §8 "계약 1 — DOM"의 구조를 **그대로** 생성한다. id와 클래스 이름이 계약이다 — 에이전트 C가 이 이름으로 요소를 찾는다. 임의로 바꾸면 게임이 동작하지 않는다.

- `extraStyles: ['/styles/game-2048.css']`
- `extraScripts: ['/scripts/game-2048-core.js', '/scripts/game-2048-ui.js']` — **core가 먼저다.**
- 접근성 속성(spec §7)을 마크업에 넣는다: 보드의 `role="grid"`, `tabindex="0"`, `aria-label`, 칸의 `role="gridcell"`, `#game-status`의 `aria-live="polite"`, 진짜 `<button type="button">`.
- UI 문구는 **영어**다(spec §7 결정 기록). `Score`, `Best`, `New Game`, `Use arrow keys to move tiles.`, `This game requires JavaScript.`
- 배경 격자 `.board__cell` 16개는 서버에서 정적으로 렌더링한다. 타일 요소는 **JS가 만든다 — 네가 만들지 않는다.**
- `.game__nojs` 폴백 요소를 넣는다. `layout.css:46-50`의 `.js` 클래스 패턴을 확인하고 같은 방식을 쓰되, **CSS는 에이전트 C가 쓴다.** 너는 마크업만 제공한다.
- 페이지 `<h1>`을 넣어라. 글 페이지처럼 `baseLayout`이 자동으로 넣어주지 않는다.

### 4. `build.js`에서 페이지 생성

`renderGamePage` import 후, 인덱스 작성 뒤에 한 줄:

```js
await writePage(path.join(DIST_DIR, 'games', '2048', 'index.html'), renderGamePage(SITE));
```

빌드 로그 문구(`Built N posts`)는 그대로 둔다. 게임은 글이 아니다.

## 검증 (반드시 직접 실행하고 결과를 보고하라)

1. `npm run build` — 성공하고 `dist/games/2048/index.html`이 생긴다.
2. 기존 페이지 회귀 확인: `dist/index.html`과 글 페이지 하나가 여전히 정상이고, 헤더에 `2048` 링크가 보인다.
3. **경로 검증(가장 중요):** `BASE_PATH=/my-blog npm run build` 후 게임 페이지의 모든 `href=`/`src=` 값을 뽑아 **전부 `/my-blog/`로 시작하는지** 확인하라. 하나라도 `/styles/`나 `/scripts/`로 시작하면 배포에서 죽는다. 인덱스와 글 페이지도 같이 확인하라(nav 링크 추가 때문).
4. 확인이 끝나면 `npm run build`로 되돌려 `dist/`를 로컬 상태로 남겨둔다.

## 보고

수정한 내용, 위 검증 4개의 실제 결과(추정 말고 실행 결과), 그리고 계약을 벗어난 판단이 있었다면 그것을 보고하라.
