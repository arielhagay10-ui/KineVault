export function PublicationBadge({ verifiedAt }: { verifiedAt: string | null }) {
  return <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-primary"
    title={verifiedAt ? "Reviewed by a KineVault moderator" : "Published by a community member; awaiting verification"}>{verifiedAt ? "Verified" : "Community"}</span>;
}
