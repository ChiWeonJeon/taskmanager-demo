# 화면 목록

## 주요 화면

| 경로 | 화면 | 설명 | 파일 |
|---|---|---|---|
| `/` | 리디렉트 | `/tasks`로 리디렉트 | `src/app/page.tsx` |
| `/login` | 로그인 | 이메일/패스워드 로그인 | `src/app/(auth)/login/page.tsx` |
| `/register` | 회원가입 | 계정 생성 | `src/app/(auth)/register/page.tsx` |
| `/tasks` | 태스크 목록 | 일감 목록 (리스트/그리드/칸반/간트) + 필터/정렬 | `src/app/(main)/tasks/page.tsx` |
| `/projects` | 프로젝트 목록 | 내가 멤버로 등록된 프로젝트 목록 | `src/app/(main)/projects/page.tsx` |
| `/projects/[id]/admin` | 프로젝트 어드민 허브 | 프로젝트 단위 어드민 진입점 | `src/app/(main)/projects/[id]/admin/page.tsx` |
| `/projects/[id]/admin/members` | 프로젝트 멤버 관리 | 멤버 추가·역할 변경·제거 | `src/app/(main)/projects/[id]/admin/members/page.tsx` |
| `/admin` | 글로벌 어드민 허브 | 전역 설정 진입 (글로벌 어드민 전용) | `src/app/(main)/admin/page.tsx` |
| `/admin/issue-types` | 유형 관리 | 유형 CRUD, 구성표 할당 | `src/app/(main)/admin/issue-types/page.tsx` |
| `/admin/fields` | 필드 관리 | 필드 목록/생성/편집 | `src/app/(main)/admin/fields/page.tsx` |
| `/admin/statuses` | 상태 관리 | 상태 목록/생성/편집 | `src/app/(main)/admin/statuses/page.tsx` |
| `/admin/users` | 사용자 관리 | 사용자 목록/생성/편집/삭제 | `src/app/(main)/admin/users/page.tsx` |
| `/admin/roles` | 역할 관리 | 역할 CRUD, 권한 부여 | `src/app/(main)/admin/roles/page.tsx` |

## 레이아웃

### 데스크톱 (md 이상)
```
┌──────────────────────────────────────────┐
│ Sidebar(접기) │ Topbar                   │
│               │──────────────────────────│
│ 📋 태스크     │                          │
│ 📁 프로젝트   │  메인 콘텐츠              │
│   └ FWD       │                          │
│   └ ...       │                          │
│ ➕ 일감 생성  │                          │
│ ─────────     │                          │
│ ⚙️ 어드민    │                          │
│   (어드민만)  │                          │
└──────────────────────────────────────────┘
```

### 모바일 (md 미만)
```
┌──────────────────┐
│ TaskManager   🌙 │  ← Topbar
│──────────────────│
│                  │
│  메인 콘텐츠      │
│                  │
│──────────────────│
│ 📋  📁  ➕      │  ← MobileNav (태스크 / 프로젝트 / 일감 생성)
└──────────────────┘
```

## 일감 생성 흐름 (모달)
1. 사이드바 "일감 생성" 또는 모바일 하단 내비 ➕ 탭 클릭
2. Portal 기반 모달 오픈: 제목·유형·상태·프로젝트 입력
3. "생성" 버튼 클릭 → POST `/api/work-items`
4. 목록 자동 갱신 (React Query invalidate)
5. 모달 닫힘

## 태스크 목록 기능
- **"👤 내 일감" 토글**: 기본 ON, 담당자=나인 일감만 표시 (`?assigneeId=me`)
- **필터**: 상태·유형·담당자 체크박스
- **정렬**: 드롭다운 (생성일, 제목 등)
- **뷰 전환**: 리스트뷰 / 그리드뷰 / 칸반뷰 / 간트뷰
- **그리드/간트 그리드**: 컬럼 헤더 드래그로 가로 너비 조절

## 접근 제어
- 글로벌 어드민(`role=ADMIN`): `/admin/*` 접근 가능
- 인증 사용자: 프로젝트 생성 가능
- 프로젝트 소유주: 프로젝트 설정/멤버 관리 전체 접근
- 프로젝트 역할 보유자: `project:manage`, `members:manage` 등 역할 권한 범위 내 접근
- 비인증 사용자: `/login`, `/register` 외 모든 경로 → 로그인으로 리디렉트

## Regression Recovery Notes (2026-03-26)
- /tasks and /projects/[id] should keep rendering the task list even if auxiliary metadata such as full issue-type schemas fails to load.
- /admin should act as the landing hub for all existing workspace admin screens, not just field schema management.
- The quick-create toolbar should keep the compact inline layout instead of the expanded stacked variant.

## Task Workspace Recovery Notes (2026-03-26)
- Gantt is a combined grid and timeline view, not a chart-only list.
- Gantt must let the user change the visible range and the display unit (`day`, `week`, `month`, `quarter`).
- Grid, Gantt, and Calendar all provide fullscreen mode from the shared task workspace toolbar.
- The shared task workspace toolbar stays sticky, and per-view column or weekday headers stay sticky directly beneath it.
- Calendar date clicks drill down into day view for the selected date.
- Calendar blank-cell clicks create a new work item immediately for that date; this is not a hover-only create affordance.

