import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getGroupAccess, hasGroupAccess } from "@/lib/group-permissions";
import { GroupChecklists } from "@/components/checklist/group-checklists";

interface Props {
  params: Promise<{ groupSlug: string }>;
}

export default async function Page({ params }: Props) {
  const { groupSlug } = await params;
  const session = await auth();
  const access = await getGroupAccess(groupSlug, session?.user);
  if (!access.group) notFound();
  if (!hasGroupAccess(access)) notFound();

  return <GroupChecklists groupSlug={groupSlug} />;
}
