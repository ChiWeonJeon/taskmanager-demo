"use client";

import { useParams } from "next/navigation";
import { RoleDetail } from "@/app/(main)/admin/roles/role-detail";

export default function EditRolePage() {
  const params = useParams<{ id: string }>();
  const roleId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <RoleDetail mode="edit" roleId={roleId} />;
}
