export function FilterSection({ title, name, options, selected }: {
  title: string;
  name: string;
  options: { slug: string; name: string }[];
  selected: readonly string[];
}) {
  return (
    <details open={selected.length > 0} className="border-t border-[#edf1eb] py-4">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-2">
        {options.map((option) => (
          <label key={option.slug} className="flex cursor-pointer items-start gap-2 text-sm text-[#50645a]">
            <input type="checkbox" name={name} value={option.slug} defaultChecked={selected.includes(option.slug)}
              className="mt-0.5 accent-[#26775b]" />
            <span>{option.name}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
