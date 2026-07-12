import { redirect } from "next/navigation";

export default async function GroupPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = await params;
  redirect(`/groups/${encodeURIComponent(groupSlug)}/today`);
}
