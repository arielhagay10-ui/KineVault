import { Box, Chair, Dumbbell, Person, Weight } from "@/components/ui/icons";

export function WorkshopEquipmentPicture({ slug, className = "h-24 w-full" }: { slug: string; className?: string }) {
  const Icon = slug === "bench" ? Chair : slug === "kettlebell" ? Weight : /dumbbell|barbell/.test(slug) ? Dumbbell : Box;
  return <Icon className={className} />;
}

export function WorkshopPosePicture({ endpoint, className = "h-20 w-24" }: { slug: string; endpoint: "start" | "finish"; className?: string }) {
  return <Person className={`${className} ${endpoint === "finish" ? "text-primary" : "text-muted-foreground"}`} />;
}
