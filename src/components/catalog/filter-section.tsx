export function FilterSection({ title, name, options, selected, defaultOpen = false }: {
  title: string;
  name: string;
  options: { slug: string; name: string }[];
  selected: readonly string[];
  defaultOpen?: boolean;
}) {
  return (
    <details id={`filter-${name}`} open={defaultOpen || selected.length > 0} className="scroll-mt-6 border-t border-border">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">{title}{selected.length > 0 && <span className="ml-2 text-xs text-muted-foreground">({selected.length})</span>}</summary>
      <div className="mb-2 max-h-48 overflow-y-auto overscroll-contain pr-1">
        {options.map((option) => (
          <label key={option.slug} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1.5 text-sm text-foreground hover:bg-muted has-checked:bg-accent has-checked:font-medium has-checked:text-accent-foreground">
            <input type="checkbox" name={name} value={option.slug} defaultChecked={selected.includes(option.slug)}
              className="size-4 shrink-0 accent-primary" />
            <span>{option.name}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
