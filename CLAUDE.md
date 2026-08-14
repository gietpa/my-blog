# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

`posts/`의 마크다운 파일을 읽어 `dist/`에 정적 블로그 사이트를 생성합니다.
글쓴이는 마크다운으로 글을 쓰고, `npm run build`가 그것을 깔끔하고 읽기 좋은 HTML 페이지로 변환합니다.

## 명령어

```bash
npm install     # 빌드 의존성 설치 (최초 1회)
npm run build   # posts/*.md → dist/
npm run serve   # dist/를 http://localhost:4321 에서 서빙
npm run dev     # build 후 serve
```

## Obsidian Vault 연동

Vault(`~/Documents/Obsidian Vault/04-Blog/`)에서 완성된 글을 가져옵니다.
경로는 `VAULT_BLOG_DIR` 환경변수로 바꿀 수 있습니다.

```bash
npm run import -- --dry-run   # 무엇이 넘어올지만 확인
npm run import                # 가져오고 Vault에 published 표시
```

Vault 노트의 `status` 흐름은 `draft` → `ready` → `published`입니다.
importer는 **`type: post`이면서 `status: ready`인 노트만** 가져가고, 가져간 뒤 그 노트를
`status: published` + `published: <날짜>`로 되돌려 씁니다. 같은 글이 두 번 올라가지 않게 하는 장치입니다.

가져오면서 처리되는 것:

- `[[위키링크]]` → 텍스트만 남김 (대상 노트는 사이트에 없으므로 링크로 두면 깨집니다). `[[노트\|별칭]]`은 별칭을 씁니다.
- `![[임베드]]` → 제거하고 경고 출력. 이미지는 손으로 옮겨야 합니다.
- `category/기술` 같은 태그 접두사 제거
- `description`이 비어 있으면 첫 문단에서 생성

Vault 노트를 되돌려 쓸 때는 프론트매터를 통째로 다시 직렬화하지 않고 해당 줄만 교체합니다.
Vault에는 `id`, `is_a`, `related_to` 같은 온톨로지 필드와 주석이 있어서, 재직렬화하면 형식이 뭉개지거나 유실됩니다.

Vault 쪽 템플릿: `90-Templates/Template - Blog Post.md`

## 글 초안 워크플로

`/daily-draft` (Claude Code 슬래시 명령, [.claude/commands/daily-draft.md](.claude/commands/daily-draft.md))는
지난 24시간 커밋을 근거로 글 초안을 `posts/`에 만듭니다.

- `scripts/daily-brief.js`가 재료(커밋 제목·본문·변경 파일)를 모읍니다. 산문은 쓰지 않고 사실만 보고합니다.
- 커밋이 없으면 종료 코드 1로 끝나고, 명령어는 **글을 만들지 않습니다.** 활동 없는 날 회고를 지어내지 않게 하는 장치입니다.
- 초안은 항상 `draft: true`로 저장되어 빌드에서 제외됩니다. 사람이 읽고 고친 뒤 그 줄을 지워야 공개됩니다.

이 두 가지 안전장치(활동 없으면 안 씀 / 검토 전엔 발행 안 됨)는 의도된 것이니 제거하지 마세요.

## 배포

`main`에 push하면 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)이 빌드해서 GitHub Pages로 올립니다.
결과: <https://gietpa.github.io/my-blog/>

`dist/`는 gitignore이므로 저장소에 서빙할 것이 없습니다. 워크플로가 `npm ci && npm run build`로 매번 새로 만듭니다.

**`BASE_PATH`**: 프로젝트 사이트는 `/my-blog/` 하위에서 서빙되는데 템플릿 경로는 전부 사이트 절대경로입니다.
워크플로가 `actions/configure-pages`의 `base_path` 출력을 `BASE_PATH` 환경변수로 넘겨주고, `build.js`가 그것을
`SITE.basePath`에 넣어 모든 경로 앞에 붙입니다. 값을 하드코딩하지 않은 이유는 저장소 이름을 바꾸거나 커스텀
도메인을 붙였을 때 자동으로 따라가게 하기 위해서입니다.

로컬에서는 `BASE_PATH`가 비어 있어 `npm run dev`가 예전 그대로 루트에서 동작합니다. 프로덕션과 같은 출력을
확인하려면 `BASE_PATH=/my-blog npm run build`로 빌드하세요 (단, `npm run serve`는 루트에서 서빙하므로 이 빌드는
로컬에서 링크가 깨집니다 — 경로 확인용입니다).

## 기술 스택 / 제약 조건

- **브라우저로 나가는 코드에는 프레임워크도 라이브러리도 없습니다.** `dist/`는 순수 HTML/CSS/바닐라 JS이며, 클라이언트 JS는 다크 모드 토글 하나뿐입니다.
- **빌드 시점 생성**: 런타임에 마크다운을 fetch/파싱하지 않습니다. `node scripts/build.js`가 정적 HTML을 미리 씁니다.
- **npm 의존성은 빌드 도구 전용**이며 현재 3개뿐입니다 — `marked`(마크다운), `gray-matter`(frontmatter), `highlight.js`(문법 강조). 셋 다 Node에서만 실행되고 배포물에는 포함되지 않습니다. 새 의존성을 추가하려면 먼저 이 원칙에 어긋나지 않는지 확인하고, 애매하면 사용자에게 물어보세요.
- 번들러나 CSS 전처리기는 없습니다. 자원 처리는 단순 디렉토리 복사입니다.
- 개발 서버(`scripts/serve.js`)도 의존성 없는 Node 기본 모듈만 씁니다.

## 구조

```
posts/                  # 원본 글 (.md, 커밋함)
scripts/
  build.js              # 진입점 + SITE 설정 객체 (사이트 이름/설명은 여기서 변경)
  serve.js              # 의존성 없는 로컬 미리보기 서버
  lib/
    posts.js            # posts/ 읽기, frontmatter 파싱, 정렬 — HTML을 모름
    markdown.js         # marked 설정 + highlight.js 코드 렌더러
    templates.js        # baseLayout(), renderIndexPage(), renderPostPage()
    util.js             # escapeHtml(), formatDate(), stripHtml(), truncate()
assets/                 # 원본 정적 자원 (커밋함)
  css/                  # variables → base → layout → highlight-theme 순서로 로드됨
  js/theme-toggle.js
dist/                   # 빌드 결과물 — gitignore, 매 빌드마다 통째로 재생성
.github/workflows/
  deploy.yml            # main에 push하면 빌드해서 GitHub Pages로 배포
```

## 코드 작업 시 반드시 지킬 것

- **템플릿의 모든 경로는 사이트 기준 절대경로를 `href(site, ...)`에 통과시킬 것.** 상대경로 금지 — 글 페이지는 `/posts/<slug>/index.html`에 있어서 인덱스보다 두 단계 깊고, 상대경로를 쓰면 인덱스에서만 동작하고 글 페이지에서 깨집니다. `href()`는 여기에 `site.basePath`를 덧붙입니다. GitHub Pages 프로젝트 사이트가 `/my-blog/` 하위에서 서빙되기 때문에, 이걸 빼먹은 경로 하나가 CSS 전체나 테마 토글을 조용히 404로 만듭니다.
- **frontmatter 값을 HTML에 넣을 때는 반드시 `escapeHtml()`을 통과시킬 것.** 이 값들은 marked의 이스케이프를 거치지 않으므로, `Rust & Go: A <fair> comparison?` 같은 제목이 그대로 마크업을 깨뜨립니다.
- **다크 모드 사전 적용 스크립트는 `<head>` 안에 인라인으로 유지할 것.** 외부 파일이나 `defer`로 빼면 첫 페인트 이후 실행돼 라이트→다크 번쩍임이 생깁니다.
- **테마 색상은 `assets/css/variables.css`의 커스텀 프로퍼티에서만 관리**합니다. 다크 모드는 규칙이 아니라 값만 바꿉니다.
- **`marked` 업그레이드 시 `scripts/lib/markdown.js`의 렌더러 시그니처를 재확인할 것.** 버전마다 바뀌며, 안 맞으면 에러 없이 하이라이팅만 조용히 사라집니다. 현재 marked 12.x 기준 `code(source, infoString, escaped)` 위치 인자.
- **`dist/`는 매 빌드마다 통째로 지우고 다시 만듭니다.** 삭제한 글의 페이지가 남지 않도록 하는 장치이니 유지하세요.
- 접근성: 시맨틱 태그, 충분한 명도 대비, 진짜 `<button>`과 `:focus-visible` 스타일.

## 글 작성 규칙

각 `.md` 파일은 YAML frontmatter로 시작합니다:

```markdown
---
title: "Hello, World"          # 필수
date: "2026-08-10"             # 필수
tags: ["meta", "intro"]        # 선택
description: "한 줄 요약"       # 선택 — 없으면 첫 문단에서 자동 생성
draft: true                    # 선택 — 있으면 빌드에서 제외
---
```

- **본문에 제목을 `# H1`으로 반복하지 마세요.** 템플릿이 frontmatter의 `title`로 이미 `<h1>`을 렌더링합니다. 본문은 `##`이나 일반 문단으로 시작하세요.
- **코드 펜스에는 언어를 명시하세요** (` ```js `). 없으면 `highlightAuto` 추정에 의존하게 되고, 종종 틀립니다.
- 파일명은 `YYYY-MM-DD-slug.md` 형식을 씁니다. 날짜 접두사는 URL에서 자동으로 제거되며, `slug` frontmatter로 덮어쓸 수 있습니다.
- `title`과 `date`가 없거나 slug가 중복되면 빌드가 파일명을 지목하며 실패합니다. 의도된 동작입니다.

## v1 범위

글 목록 + 개별 글 페이지만 있습니다. 태그 페이지, RSS, 검색은 **의도적으로 제외**했습니다.
나중에 추가하기 쉽도록: `posts.js`가 HTML과 무관한 `posts[]` 배열을 export하고(피드 생성기가 그대로 재사용 가능), post 객체가 아직 필터링에 쓰이지 않는 `tags`도 이미 담고 있으며, 모든 페이지가 `baseLayout()`을 공유합니다.
