// TODO(ai-followup): [배경] 어드민 조회/편집 UX 통일이 이 페이지엔 아직 미적용 (statuses·roles 이관 완료).
// [작업] useStagedForm(@/lib/admin/use-staged-form) + AdminDetailShell(@/components/admin/admin-detail-shell)
//        + DataTable 검색·정렬(@/lib/admin/use-table-controls, @/components/admin/admin-list-toolbar)로
//        "테이블 목록 → /admin/field-schemas/[id] 상세 라우트 → staged 편집(변경 시에만 저장 활성)" 패턴 이관.
//        레퍼런스: src/app/(main)/admin/statuses, src/app/(main)/admin/roles.
// [테스트] 행 클릭 시 상세 라우트 이동, 필드 수정 시 저장 활성, 되돌리기/삭제(ConfirmDialog) 동작 확인.

import { FieldSchemaList } from "@/components/admin/field-schema-list";

export default function FieldSchemasPage() {
  return <FieldSchemaList />;
}

