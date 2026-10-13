import { Box, Chair, Dumbbell, Person, Weight } from "@/components/ui/icons";

export function WorkshopEquipmentPicture({ slug, className = "h-24 w-full" }: { slug: string; className?: string }) {
  if (slug === "barbell") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 40" width={20} height={20}
    fill="currentColor" aria-hidden="true" focusable="false" data-icon="barbell" className={className}>
    <rect x="1" y="18" width="62" height="4" rx="2" />
    <rect x="7" y="9" width="6" height="22" rx="2" />
    <rect x="14" y="3" width="8" height="34" rx="2" />
    <rect x="42" y="3" width="8" height="34" rx="2" />
    <rect x="51" y="9" width="6" height="22" rx="2" />
  </svg>;
  const Icon = slug === "bench" ? Chair : slug === "kettlebell" ? Weight : /dumbbell/.test(slug) ? Dumbbell : Box;
  return <Icon className={className} />;
}

export function WorkshopPosePicture({ endpoint, className = "h-20 w-24" }: { slug: string; endpoint: "start" | "finish"; className?: string }) {
  return <Person className={`${className} ${endpoint === "finish" ? "text-primary" : "text-muted-foreground"}`} />;
}
