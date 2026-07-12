import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canManageGroup, getGroupAccess, hasGroupAccess } from "@/lib/group-permissions";
import { canReadGroupCycles } from "@/lib/cycle/api";
import { GroupTabNav } from "./group-tab-nav";

interface Props {
  children: React.ReactNode;
  params: Promise<{ groupSlug: string }>;
}

export default async function GroupLayout({ children, params }: Props) {
  const { groupSlug } = await params;
  const session = await auth();
  const access = await getGroupAccess(groupSlug, session?.user);
  const group = access.group;
  if (!group) notFound();
  if (!hasGroupAccess(access)) {
    notFound();
  }

  const canManage = canManageGroup(access);
  const canAccessCycle = await canReadGroupCycles(access, session?.user);

  return (
    <div data-scope-page-content="group" className="min-w-0 w-full space-y-3">
      <GroupTabNav group={group} canManage={canManage} canAccessCycle={canAccessCycle} />
      <div data-scope-page-body="group" className="min-w-0 w-full">{children}</div>
    </div>
  );
}
