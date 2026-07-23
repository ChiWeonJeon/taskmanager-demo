# API 설계

모든 엔드포인트는 `/api/` 하위. JSON 요청/응답.

## 헬스 체크

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/health` | 헬스 체크 (앱 버전 반환) | `src/app/api/health/route.ts` |

## Server analytics recovery

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/cron/server-analytics` | `CRON_SECRET` Bearer 인증 후 서버 이벤트 outbox 전송 재시도 | `src/app/api/cron/server-analytics/route.ts` |

이 경로는 미들웨어 공개 예외지만 자체 Bearer 검증을 통과해야 한다. 공개 데모 모드에서는 dispatcher가 항상 no-op이다.

## Entity Records / Work Items

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/entity-records` | 엔티티 레코드 목록 조회. `type=` 또는 `entityTypeId=` 필터 지원 | `src/app/api/entity-records/route.ts` |
| GET | `/api/work-items` | 목록 조회 | `src/app/api/work-items/route.ts` |
| POST | `/api/work-items` | 생성 | `src/app/api/work-items/route.ts` |
| PATCH | `/api/work-items/[id]` | 부분 업데이트 | `src/app/api/work-items/[id]/route.ts` |
| DELETE | `/api/work-items/[id]` | 삭제 | `src/app/api/work-items/[id]/route.ts` |

`/api/entity-records`가 canonical 조회 API다. `/api/work-items`는 한 릴리스 동안 일감 UI 호환 경로로 유지하며, POST는 `issueTypeId`와 `entityTypeId`를 모두 받는다.

### GET /api/work-items 쿼리 파라미터
| 파라미터 | 설명 |
|---|---|
| `assigneeId=me` | 담당자=나인 일감만 조회 |

### POST /api/work-items
```json
{
  "title": "할 일 제목",
  "issueTypeId": "(선택) 기존 호환 유형 ID",
  "entityTypeId": "(선택) canonical 엔티티 유형 ID",
  "statusId": "(선택) 상태 ID, 미입력 시 '열림'",
  "projectId": "(선택) 프로젝트 ID",
  "fieldValues": { "fieldId": "JSON 직렬화 전 값" }
}
```

### PATCH /api/work-items/[id]
```json
{
  "title": "(선택) 제목",
  "description": "(선택) 설명",
  "statusId": "(선택) 상태 ID",
  "issueTypeId": "(선택) 기존 호환 유형 ID",
  "projectId": "(선택) 프로젝트 ID",
  "fieldValues": { "fieldId": "JSON 직렬화 전 값" },
  "clearFieldIds": ["fieldId"]
}
```
변경된 필드는 `WorkItemHistory`에 자동 기록한다. 커스텀 필드 값의 canonical 저장소는 `EntityRecordFieldValue`이며, 응답의 `fieldValues` 형태는 기존 일감 UI 계약을 유지한다.

## Projects

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/projects` | 프로젝트 목록 조회 | `src/app/api/projects/route.ts` |
| POST | `/api/projects` | 프로젝트 생성 (인증 사용자 누구나) | `src/app/api/projects/route.ts` |
| PATCH | `/api/projects/[id]` | 프로젝트 수정 및 소유주 양도 | `src/app/api/projects/[id]/route.ts` |
| DELETE | `/api/projects/[id]` | 프로젝트 삭제 | `src/app/api/projects/[id]/route.ts` |
| GET | `/api/projects/[id]/members` | 프로젝트 멤버 목록 | `src/app/api/projects/[id]/members/route.ts` |
| POST | `/api/projects/[id]/members` | 멤버 추가 | `src/app/api/projects/[id]/members/route.ts` |
| PATCH | `/api/projects/[id]/members/[memberId]` | 멤버 역할 변경 | `src/app/api/projects/[id]/members/[memberId]/route.ts` |
| DELETE | `/api/projects/[id]/members/[memberId]` | 멤버 제거 | `src/app/api/projects/[id]/members/[memberId]/route.ts` |
| GET | `/api/users` | 사용자 목록 조회 (인증 사용자) | `src/app/api/users/route.ts` |
| GET | `/api/roles` | 역할 목록 조회 (인증 사용자) | `src/app/api/roles/route.ts` |

### GET /api/projects 쿼리 파라미터
| 파라미터 | 설명 |
|---|---|
| `memberId=me` | 내가 멤버로 등록된 프로젝트만 조회 |

### POST /api/projects
```json
{
  "name": "프로젝트 이름",
  "key": "PROJ",
  "description": "(선택) 설명"
}
```
생성 시 생성자를 프로젝트 소유주로 지정하고, "프로젝트 어드민" 역할의 `ProjectMember`로 자동 추가.

### PATCH /api/projects/[id]
```json
{
  "name": "(선택) 프로젝트 이름",
  "key": "(선택) 프로젝트 키",
  "description": "(선택) 설명",
  "ownerId": "(선택) 새 소유주 사용자 ID"
}
```

- `ownerId` 변경은 소유권 양도에 해당한다
- 새 소유주는 자동으로 프로젝트 멤버로 보장된다
- 개인 프로젝트의 소유주는 변경할 수 없다

### 프로젝트 멤버 API 권한
- 프로젝트 조회/멤버 조회: 글로벌 어드민, 프로젝트 소유주, 프로젝트 멤버
- 프로젝트 수정/삭제: 글로벌 어드민, 프로젝트 소유주, `project:manage`
- 멤버 관리: 글로벌 어드민, 프로젝트 소유주, `members:manage`
- 현재 소유주는 제거할 수 없으며 먼저 소유권을 양도해야 한다

## Entity Types

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/entity-types` | 엔티티 유형 목록 조회. `category=ISSUE\|CYCLE`, `view=summary` 지원. `category=EVENT`는 지원하지 않는 범주로 거부 | `src/app/api/entity-types/route.ts` |
| POST | `/api/entity-types` | 엔티티 유형 생성 | `src/app/api/entity-types/route.ts` |
| PATCH | `/api/entity-types/[id]` | 엔티티 유형 수정 | `src/app/api/entity-types/[id]/route.ts` |
| DELETE | `/api/entity-types/[id]` | 엔티티 유형 soft delete | `src/app/api/entity-types/[id]/route.ts` |
| GET | `/api/issue-types` | 일감 유형 호환 alias | `src/app/api/issue-types/route.ts` |

`Task`, `Bug`, `Story`, `Cycle`이 `EntityType`이며, 현재 지원 범주는 `ISSUE`와 `CYCLE`이다. `/api/issue-types`는 기존 일감 화면을 위해 유지되며, 기본 응답은 `ISSUE` 유형으로 제한된다.

## Fields

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/fields` | 목록 조회 | `src/app/api/fields/route.ts` |
| POST | `/api/fields` | 커스텀 필드 생성 | `src/app/api/fields/route.ts` |

### POST /api/fields
```json
{
  "name": "필드 이름",
  "key": "field_key",
  "type": "TEXT | NUMBER | DATE | SELECT | MULTI_SELECT | URL | USER | OBJECT_REF | MULTI_OBJECT_REF | ENTITY_REF | MULTI_ENTITY_REF",
  "referenceObjectDefId": "(OBJECT_REF/MULTI_OBJECT_REF일 때) ObjectDef ID",
  "referenceObjectKey": "(호환용) 기존 참조 키 또는 ObjectDef key",
  "options": [{"value": "v", "label": "l", "color": "#hex"}],
  "isRequired": false
}
```

사용자 참조는 `USER` 타입을 사용한다. 참조 객체 레코드는 `OBJECT_REF`, 실제 엔티티 레코드는 `ENTITY_REF`를 사용한다.

## Field Schemas

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/field-schemas` | 필드 스키마 목록. `issueTypes`와 `objectDefs` 사용 범위 포함 | `src/app/api/field-schemas/route.ts` |
| POST | `/api/field-schemas?usage=object` | 객체 레코드용 필드 스키마 생성. required title 필드 필요 | `src/app/api/field-schemas/route.ts` |
| PATCH | `/api/field-schemas/[id]?usage=object` | 객체 레코드용 필드 스키마 수정. 객체 레코드 값이 남은 필드 제거 차단 | `src/app/api/field-schemas/[id]/route.ts` |
| DELETE | `/api/field-schemas/[id]` | 엔티티 유형 또는 참조 객체에 연결되지 않은 스키마만 삭제 | `src/app/api/field-schemas/[id]/route.ts` |

`usage=object`는 일감 잠금 필드(`project`, `status`, `assignee` 등)를 자동 삽입하지 않는다. 객체 스키마는 `object_record_title` 또는 `title` 필드를 required로 포함해야 하며, 객체 레코드 패널과 서버 저장기가 지원하는 필드 타입만 포함할 수 있다.

## Reference Objects

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/reference-objects` | `ObjectDef` 목록 | `src/app/api/reference-objects/route.ts` |
| POST | `/api/reference-objects` | 참조 객체 생성 | `src/app/api/reference-objects/route.ts` |
| GET | `/api/reference-objects/[key]` | 참조 객체 상세 | `src/app/api/reference-objects/[key]/route.ts` |
| PATCH | `/api/reference-objects/[key]` | 참조 객체 수정 | `src/app/api/reference-objects/[key]/route.ts` |
| DELETE | `/api/reference-objects/[key]` | 참조 객체 삭제 | `src/app/api/reference-objects/[key]/route.ts` |
| GET | `/api/reference-objects/[key]/records` | `ObjectRecord` 목록 | `src/app/api/reference-objects/[key]/records/route.ts` |
| POST | `/api/reference-objects/[key]/records` | `ObjectRecord` 생성 | `src/app/api/reference-objects/[key]/records/route.ts` |
| PATCH | `/api/reference-objects/[key]/records/[recordId]` | `ObjectRecord` 수정 | `src/app/api/reference-objects/[key]/records/[recordId]/route.ts` |
| DELETE | `/api/reference-objects/[key]/records/[recordId]` | `ObjectRecord` soft delete | `src/app/api/reference-objects/[key]/records/[recordId]/route.ts` |
| GET | `/api/object-types` | 참조 객체 호환 alias | `src/app/api/object-types/route.ts` |

참조 객체는 브랜드, 카테고리, 매장, 거래처처럼 `OBJECT_REF` 필드에서 고르는 객체 레코드 묶음이다. 일감/사이클/사용자/프로젝트는 참조 객체가 아니며, 실제 레코드를 골라야 하면 `ENTITY_REF` 또는 `USER`를 사용한다.

active `ObjectRecord`가 있는 참조 객체는 `fieldSchemaId`를 다른 스키마로 교체할 수 없다. 이 경우 현재 연결된 객체 필드 스키마를 `/admin/field-schemas/[id]?usage=object`에서 편집한다.

## Cycles

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET/POST | `/api/projects/[id]/cycles` | 프로젝트 사이클 목록/생성 | `src/app/api/projects/[id]/cycles/route.ts` |
| GET/PATCH/DELETE | `/api/projects/[id]/cycles/[cycleId]` | 프로젝트 사이클 상세/수정/삭제 | `src/app/api/projects/[id]/cycles/[cycleId]/route.ts` |
| PATCH | `/api/projects/[id]/cycles/[cycleId]/inheritance` | 상속 사이클의 프로젝트별 활성화 상태 변경 | `src/app/api/projects/[id]/cycles/[cycleId]/inheritance/route.ts` |
| GET/POST | `/api/projects/[id]/cycles/[cycleId]/comments` | 댓글 목록/작성 | `src/app/api/projects/[id]/cycles/[cycleId]/comments/route.ts` |
| PATCH/DELETE | `/api/projects/[id]/cycles/[cycleId]/comments/[commentId]` | 댓글 수정/삭제 | `src/app/api/projects/[id]/cycles/[cycleId]/comments/[commentId]/route.ts` |
| GET/POST | `/api/projects/[id]/cycles/[cycleId]/watchers` | 지켜보기 목록/추가 | `src/app/api/projects/[id]/cycles/[cycleId]/watchers/route.ts` |
| DELETE | `/api/projects/[id]/cycles/[cycleId]/watchers/[userId]` | 지켜보기 해제 (`userId=me` 지원) | `src/app/api/projects/[id]/cycles/[cycleId]/watchers/[userId]/route.ts` |
| GET/POST | `/api/project-groups/[slugOrId]/cycles` | 그룹 사이클 목록/생성 | `src/app/api/project-groups/[slugOrId]/cycles/route.ts` |
| GET/PATCH/DELETE | `/api/project-groups/[slugOrId]/cycles/[cycleId]` | 그룹 사이클 상세/수정/삭제 | `src/app/api/project-groups/[slugOrId]/cycles/[cycleId]/route.ts` |
| PATCH | `/api/project-groups/[slugOrId]/cycles/[cycleId]/inheritance` | 그룹 사이클 상속 기본값/프로젝트별 상태 변경 | `src/app/api/project-groups/[slugOrId]/cycles/[cycleId]/inheritance/route.ts` |
| GET/POST | `/api/project-groups/[slugOrId]/cycles/[cycleId]/comments` | 그룹 사이클 댓글 목록/작성 | `src/app/api/project-groups/[slugOrId]/cycles/[cycleId]/comments/route.ts` |
| PATCH/DELETE | `/api/project-groups/[slugOrId]/cycles/[cycleId]/comments/[commentId]` | 그룹 사이클 댓글 수정/삭제 | `src/app/api/project-groups/[slugOrId]/cycles/[cycleId]/comments/[commentId]/route.ts` |
| GET/POST | `/api/project-groups/[slugOrId]/cycles/[cycleId]/watchers` | 그룹 사이클 지켜보기 목록/추가 | `src/app/api/project-groups/[slugOrId]/cycles/[cycleId]/watchers/route.ts` |
| DELETE | `/api/project-groups/[slugOrId]/cycles/[cycleId]/watchers/[userId]` | 그룹 사이클 지켜보기 해제 (`userId=me` 지원) | `src/app/api/project-groups/[slugOrId]/cycles/[cycleId]/watchers/[userId]/route.ts` |
| GET | `/api/cycles/accessible` | 접근 가능한 전체 사이클 집계 | `src/app/api/cycles/accessible/route.ts` |

사이클은 `EntityType.key="cycle"`의 `EntityRecord`로 백필되며, 사이클 운영 값은 `CycleRecordMeta`와 기존 상속/댓글/이력/지켜보기 테이블이 보존한다. 사이클 참조 필드는 `ENTITY_REF`를 사용한다. 그룹 사이클 접근은 그룹 권한만으로 열리지 않고 그룹 오너/관리자이거나 그룹 내 프로젝트 중 하나 이상에서 `cycle:read` 권한이 있어야 한다.

## Calendar Integration

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/integrations/calendar-feed` | 통합 Calendar 앱용 읽기 전용 일감 일정 feed | `src/app/api/integrations/calendar-feed/route.ts` |

taskManager의 user-facing 일정 CRUD와 프로젝트 캘린더 API는 별도 `calendar` 서비스로 이동했다. taskManager에는 일감 workspace 내부의 `calendar` view만 남는다.

## Statuses

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/statuses` | 목록 조회 | `src/app/api/statuses/route.ts` |
| POST | `/api/statuses` | 상태 생성 | `src/app/api/statuses/route.ts` |

### POST /api/statuses
```json
{
  "name": "상태 이름",
  "key": "status_key",
  "category": "TODO | IN_PROGRESS | DONE",
  "color": "#hex"
}
```

## Admin (글로벌 어드민 전용)

> 아래 API는 `role=ADMIN` 계정만 접근 가능.

| 메서드 | 경로 | 설명 | 파일 |
|---|---|---|---|
| GET | `/api/admin/users` | 사용자 목록 | `src/app/api/admin/users/route.ts` |
| POST | `/api/admin/users` | 사용자 생성 | `src/app/api/admin/users/route.ts` |
| PATCH | `/api/admin/users/[id]` | 사용자 정보 수정 | `src/app/api/admin/users/[id]/route.ts` |
| DELETE | `/api/admin/users/[id]` | 사용자 삭제 | `src/app/api/admin/users/[id]/route.ts` |
| GET | `/api/admin/roles` | 역할 목록 | `src/app/api/admin/roles/route.ts` |
| POST | `/api/admin/roles` | 역할 생성 | `src/app/api/admin/roles/route.ts` |
| PATCH | `/api/admin/roles/[id]` | 역할 수정 | `src/app/api/admin/roles/[id]/route.ts` |
| DELETE | `/api/admin/roles/[id]` | 역할 삭제 (시스템 역할 불가) | `src/app/api/admin/roles/[id]/route.ts` |
| GET | `/api/admin/project-members` | 전체 프로젝트 멤버 목록 (호환용) | `src/app/api/admin/project-members/route.ts` |
| POST | `/api/admin/project-members` | 멤버 추가 (호환용) | `src/app/api/admin/project-members/route.ts` |
| PATCH | `/api/admin/project-members/[id]` | 멤버 역할 변경 (호환용) | `src/app/api/admin/project-members/[id]/route.ts` |
| DELETE | `/api/admin/project-members/[id]` | 멤버 제거 (호환용) | `src/app/api/admin/project-members/[id]/route.ts` |

> ⚠️ `/api/admin/project-members`는 이전 호환용. 신규 코드는 `/api/projects/[id]/members` 사용 권장.
