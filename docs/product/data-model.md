# 데이터 모델

## 핵심 원칙

- `종류`와 `유형`을 분리하지 않는다. Task, Bug, Story, Cycle은 모두 `EntityType`이다.
- 실제 생성된 일감과 사이클은 `EntityRecord`가 공통 본체다.
- 참조 객체는 엔티티가 아니다. `OBJECT_REF` 필드에서 선택하는 객체 레코드 묶음만 `ObjectDef` / `ObjectRecord`로 관리한다.
- 사용자는 `USER` 필드 타입으로 참조하며, `ObjectRecord`로 만들지 않는다.
- 사이클 상속처럼 도메인 기능에 필요한 값은 sidecar meta table에 둔다.

## 현재 관계도

```text
EntityType ──1:1── FieldSchema ──M:N── Field
EntityType ──0..1── StatusSchema ──M:N── Status
EntityType ──1:N── EntityRecord
EntityRecord ──1:N── EntityRecordFieldValue
EntityRecord ──0..1── CycleRecordMeta

ObjectDef ──1:N── ObjectRecord
ObjectDef ──N:1── FieldSchema
ObjectRecord ──1:N── ObjectRecordFieldValue

Project ──1:N── ProjectMember ──N:1── User
ProjectMember ──N:1── Role
IssueCounter / ProjectIssueCounter (채번)

ServerAnalyticsEvent ──1:N── ServerAnalyticsDelivery
```

## 서버 분석 outbox

`ServerAnalyticsEvent`는 비데모 프로덕션의 확정된 비즈니스 상태 변경을 저장한다. `distinctId`에는 원본 사용자 ID가 아니라 서버 전용 salt로 만든 HMAC 가명 ID만 저장하고, `properties`에는 이벤트별 allowlist를 통과한 원시형 값만 JSON으로 저장한다.

`ServerAnalyticsDelivery`는 이벤트마다 `MIXPANEL`, `DISCORD` 목적지 행을 각각 보유한다. `status`, `attempts`, `nextAttemptAt`, `leaseUntil`, `deliveredAt`, `externalId`, `lastError`로 두 외부 전송을 독립적으로 재시도하고 복구한다. `(eventId, destination)` unique 제약이 목적지별 중복 큐 생성을 막는다. 공개 데모와 read-only 모드에서는 outbox를 생성하거나 전송하지 않는다.

## 메타모델

### Field
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | String | PK |
| key | String unique | 시스템 전체 필드 키 |
| name | String | 표시 이름 |
| type | String | `TEXT`, `NUMBER`, `DATE`, `SELECT`, `MULTI_SELECT`, `USER`, `URL`, `OBJECT_REF`, `MULTI_OBJECT_REF`, `ENTITY_REF`, `MULTI_ENTITY_REF` 등 |
| referenceObjectDefId | String? | `OBJECT_REF` / `MULTI_OBJECT_REF` 대상 `ObjectDef` |
| referenceObjectKey | String? | 이전 호환용 참조 키. 새 객체 참조는 `referenceObjectDefId` 우선 |
| options | String? | 선택형 옵션 JSON |
| defaultValue | String? | 기본값 JSON |
| isSystem | Boolean | 시스템 필드 여부 |

필수 여부는 `Field`가 아니라 `FieldSchemaField.isRequired`가 source of truth다.

### FieldSchema / FieldSchemaField
| 모델 | 역할 |
|---|---|
| FieldSchema | 필드 묶음 |
| FieldSchemaField | 구성표와 필드의 멤버십, 정렬, 필수 여부, 기본값 |

### Status / StatusSchema
| 모델 | 역할 |
|---|---|
| Status | 상태 정의. `TODO`, `IN_PROGRESS`, `DONE` 카테고리 보유 |
| StatusSchema | 엔티티 유형별 상태 묶음 |
| StatusSchemaStatus | 상태 구성표 멤버십과 시작 상태 |

상태가 필요 없는 엔티티 유형은 `statusSchemaId=NULL`일 수 있다.

## 엔티티 계층

### EntityType
Prisma 모델명은 호환성을 위해 아직 `IssueType`을 사용하지만, 물리 테이블은 `EntityType`이다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | String | PK |
| key | String unique | `task`, `bug`, `story`, `cycle` |
| name | String unique | 표시 이름 |
| category | String | `ISSUE`, `CYCLE` 중 하나 |
| icon / color | String? | UI 표시 메타데이터 |
| fieldSchemaId | String | 연결 필드 구성표 |
| statusSchemaId | String? | 연결 상태 구성표 |
| allowedViews | String | 허용 보기 JSON |
| allowedChildEntityTypeIds | String | 허용 하위 엔티티 유형 JSON |
| isSystem | Boolean | 시스템 제공 유형 여부 |
| deletedAt | DateTime? | soft delete |

기본 엔티티 유형은 Task, Bug, Story, Cycle이다.

### EntityRecord
Prisma 모델명은 호환성을 위해 아직 `WorkItem`을 사용하지만, 물리 테이블은 `EntityRecord`다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | String | PK |
| recordKey | String unique | 사용자에게 보이는 레코드 키. Prisma 필드는 호환상 `issueKey`로 매핑 |
| title | String | 제목 |
| description | String? | 설명 |
| entityTypeId | String | `EntityType` FK. Prisma 필드는 호환상 `issueTypeId`로 매핑 |
| statusId | String? | 현재 상태 |
| projectId | String? | 프로젝트 |
| assigneeId / creatorId | String? | 담당자 / 작성자 |
| startDate / dueDate | DateTime? | 시작 / 종료 또는 마감 |
| parentId | String? | 상위 레코드 |
| sourceTable / sourceId | String? | 백필 원본 추적용 |
| deletedAt | DateTime? | soft delete |

일감과 사이클 레코드는 최종적으로 이 본체를 공유한다.

### EntityRecordFieldValue
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | String | PK |
| entityRecordId | String | `EntityRecord` FK |
| fieldId | String | `Field` FK |
| value | String | JSON 문자열 |

Unique constraint: `(entityRecordId, fieldId)`.

## 참조 객체 계층

### ObjectDef
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | String | PK |
| key | String unique | `brand`, `category`, `store`, `vendor` 등 |
| name | String | 표시 이름 |
| icon / color | String? | UI 표시 메타데이터 |
| fieldSchemaId | String | 객체 레코드에 적용할 필드 구성표. required `object_record_title` 또는 `title` 필드를 포함해야 함 |
| allowSelfRef | Boolean | 객체 레코드 트리/자기참조 허용 |
| isSystem | Boolean | 시스템 제공 객체 여부 |
| deletedAt | DateTime? | soft delete |

객체 레코드가 이미 존재하는 `ObjectDef`는 마이그레이션 UI 없이 `fieldSchemaId`를 다른 스키마로 교체하지 않는다. 대신 현재 연결된 객체 필드 스키마를 편집하며, 객체 레코드 값이 남아 있는 필드는 스키마에서 제거할 수 없다.

### ObjectRecord
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | String | PK |
| objectDefId | String | `ObjectDef` FK |
| key | String | 객체 내 레코드 키 |
| title | String | 표시 이름 |
| parentId | String? | 트리 부모 |
| sortOrder | Int | 정렬 |
| deletedAt | DateTime? | soft delete |

Unique constraint: `(objectDefId, key)`.

### ObjectRecordFieldValue
`ObjectRecord` 자체가 가지는 커스텀 필드 값이다. 저장 규약은 `EntityRecordFieldValue`와 동일하다.

## 참조 필드 저장 규약

| Field.type | 대상 | 저장 값 |
|---|---|---|
| `OBJECT_REF` | `ObjectRecord` 단건 | `{ "objectRecordId": "..." }` |
| `MULTI_OBJECT_REF` | `ObjectRecord` 여러 건 | `{ "objectRecordIds": ["..."] }` |
| `ENTITY_REF` | `EntityRecord` 단건 | `{ "entityRecordId": "..." }` |
| `MULTI_ENTITY_REF` | `EntityRecord` 여러 건 | `{ "entityRecordIds": ["..."] }` |
| `USER` | `User` | `{ "userId": "..." }` |

사이클 선택처럼 실제 엔티티 레코드를 참조하는 경우는 `ENTITY_REF`를 사용한다. 브랜드/카테고리/매장처럼 객체 레코드 묶음에서 고르는 경우만 `OBJECT_REF`를 사용한다.

## Sidecar Meta Tables

| 모델 | 역할 |
|---|---|
| CycleRecordMeta | `EntityRecord` 사이클의 scope, 그룹/프로젝트, 상속 기본값, owner |

이 테이블들은 엔티티 종류 분류가 아니라 각 기능의 운영 메타데이터다.

## 레거시 호환

- `IssueType`, `WorkItem`이라는 호환 API 이름은 한 릴리스 동안 남긴다.
- 물리 테이블 기준으로는 `IssueType` -> `EntityType`, `WorkItem` -> `EntityRecord`, `FieldValue` -> `LegacyFieldValue`로 정렬됐다.
- `/api/issue-types`와 `/api/work-items`는 기존 클라이언트를 위해 유지하며, 새 코드의 canonical API는 `/api/entity-types`와 `/api/entity-records`다.
- `/api/object-types`는 더 이상 일감/사이클/사용자/프로젝트를 객체 원본으로 반환하지 않고 참조 객체 호환 alias 역할만 한다.

## 시스템 기본 데이터

### 시스템 필드
| key | type | 설명 |
|---|---|---|
| issue_id | TEXT | 레코드 키 표시 |
| project | TEXT | 프로젝트 표시 |
| title | TEXT | 제목 |
| description | TEXT | 설명 |
| assignee | USER | 담당자 |
| priority | SELECT | 우선순위 |
| due_date | DATE | 마감일 |
| cycle | ENTITY_REF | 사이클 레코드 참조 |

### 시스템 상태
| key | category | color |
|---|---|---|
| open | TODO | #6b7280 |
| in_progress | IN_PROGRESS | #3b82f6 |
| done | DONE | #22c55e |

### 기본 참조 객체
- `brand`
- `category`
- `store`
- `vendor`

## 프로젝트/권한/운영 모델

- `Project`는 프로젝트 이름, 키, 소유자, 개인 프로젝트 여부를 가진다.
- `ProjectMember`는 프로젝트-사용자-역할 연결이며 `(projectId, userId)`가 유니크다.
- `Role.permissions`는 JSON 권한 배열이다.
- `ProjectGroup`은 여러 프로젝트를 묶고, 그룹 멤버십은 하위 프로젝트 멤버십으로 실체화된다.
