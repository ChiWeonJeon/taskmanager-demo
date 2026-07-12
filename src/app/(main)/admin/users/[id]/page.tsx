"use client";

import { useParams } from "next/navigation";
import { UserDetail } from "@/app/(main)/admin/users/user-detail";

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <UserDetail userId={userId} />;
}
