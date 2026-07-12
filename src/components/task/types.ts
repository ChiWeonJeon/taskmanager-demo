export interface FieldOption {
  value: string;
  label: string;
  color?: string | null;
  aliases?: string[];
}

export interface IssueTypeField {
  id: string;
  name: string;
  key: string;
  type: string;
  options: string | null;
  referenceObjectKey?: string | null;
  defaultValue?: string | null;
  isSystem: boolean;
  isRequired: boolean;
}

export interface FieldSchemaFieldEntry {
  fieldId?: string;
  sortOrder: number;
  isRequired?: boolean;
  defaultValue?: string | null;
  field: IssueTypeField;
}

export interface FieldSchemaOption {
  id: string;
  name: string;
  fields: FieldSchemaFieldEntry[];
}

export interface StatusOption {
  id: string;
  name: string;
  color: string;
  category: string;
  key?: string;
}

export interface StatusSchemaStatusEntry {
  statusId?: string;
  sortOrder: number;
  status: StatusOption;
}

export interface StatusSchemaOption {
  id: string;
  name: string;
  startStatusId?: string | null;
  startStatus?: StatusOption | null;
  statuses: StatusSchemaStatusEntry[];
  transitions?: { fromStatusId: string; toStatusId: string }[];
}

export interface IssueTypeOption {
  id: string;
  key?: string | null;
  name: string;
  category: string;
  icon: string | null;
  color: string | null;
  fieldSchemaId: string;
  statusSchemaId: string | null;
  fieldSchema?: FieldSchemaOption;
  statusSchema?: StatusSchemaOption | null;
  projectLinks?: { projectId: string }[];
  _count?: {
    workItems?: number;
    cycles?: number;
  };
}

export interface ProjectOption {
  id: string;
  name: string;
  key: string;
  isPersonal?: boolean;
  defaultIssueTypeId?: string | null;
  groupId?: string | null;
  sortOrderInGroup?: number;
  createdAt?: string | Date;
}

export interface UserOption {
  id: string;
  name: string;
  email: string;
}

export interface WorkItemFieldValue {
  fieldId: string;
  value: string;
  field: IssueTypeField;
}

export interface WorkItemWithRelations {
  id: string;
  issueKey: string;
  title: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  statusId: string;
  issueTypeId: string;
  projectId: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  status: {
    id: string;
    name: string;
    color: string;
    category: string;
  };
  issueType: {
    id: string;
    key?: string | null;
    name: string;
    category?: string;
    icon?: string | null;
    color: string | null;
    fieldSchemaId?: string;
    statusSchemaId?: string | null;
  };
  project: {
    id: string;
    name: string;
    key: string;
  } | null;
  parent: {
    id: string;
    issueKey: string;
    title: string;
    projectId: string | null;
  } | null;
  creator: {
    id: string;
    name: string;
    email: string;
  } | null;
  assignee: {
    id: string;
    name: string;
    email: string;
  } | null;
  fieldValues?: WorkItemFieldValue[];
  commentCount?: number;
  comments?: {
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; name: string; email: string } | null;
  }[];
  histories?: {
    id: string;
    field: string;
    before: string | null;
    after: string | null;
    createdAt: string;
    actor: { id: string; name: string; email: string } | null;
  }[];
}

export interface WorkItemUpdate {
  title?: string;
  description?: string;
  startDate?: string | null;
  dueDate?: string | null;
  statusId?: string;
  issueTypeId?: string;
  projectId?: string | null;
  assigneeId?: string;
  parentId?: string | null;
  fieldValues?: Record<string, string | string[] | null | undefined>;
  clearFieldIds?: string[];
}

export interface TaskFieldVisibility {
  issueKey: boolean;
  issueType: boolean;
  status: boolean;
  assignee: boolean;
  startDate: boolean;
  dueDate: boolean;
  createdAt: boolean;
  updatedAt: boolean;
  commentCount: boolean;
  childCount: boolean;
}

// 시스템 컬럼 키 + 커스텀 필드 컬럼(필드 id) 허용. (string & {}) 로 기존 키 자동완성은 유지하면서
// 임의 문자열(커스텀 필드 id)도 받는다.
export type TaskColumnKey =
  | "issueKey"
  | "title"
  | "issueType"
  | "status"
  | "assignee"
  | "startDate"
  | "dueDate"
  | "createdAt"
  | "updatedAt"
  | "childCount"
  | "commentCount"
  | (string & {});

export type TaskColumnWidths = Record<string, number>;

export const DEFAULT_TASK_COLUMN_WIDTHS: TaskColumnWidths = {
  issueKey: 108,
  title: 320,
  issueType: 120,
  status: 132,
  assignee: 120,
  startDate: 168,
  dueDate: 168,
  createdAt: 132,
  updatedAt: 132,
  childCount: 88,
  commentCount: 90,
};

export interface TaskSubtaskProgress {
  done: number;
  total: number;
}

export interface ResolvedProjectConfig {
  project: {
    id: string;
    key: string;
    name: string;
    isPersonal: boolean;
  };
  defaultIssueTypeId: string | null;
  enabledIssueTypes: IssueTypeOption[];
  unionFields: {
    id: string;
    name: string;
    key: string;
    type: string;
    options: string | null;
    referenceObjectKey?: string | null;
    defaultValue: string | null;
    isSystem: boolean;
    issueTypeIds: string[];
    requiredIssueTypeIds: string[];
  }[];
  unionStatuses: (StatusOption & { issueTypeIds: string[] })[];
  perTypeAllowedStatuses: Record<string, string[]>;
  perTypeTransitions?: Record<string, { fromStatusId: string; toStatusId: string }[]>;
  // 이 프로젝트에서 현재 사용자가 일감을 편집할 수 있는지(멀티뷰 셀 편집 게이팅용). API 응답에 포함.
  // 구버전 캐시 호환을 위해 optional — 없으면 읽기전용으로 폴백한다.
  canEditWorkItems?: boolean;
}
