"use client";

import { useId, useState } from "react";
import type { Option } from "@/lib/private-exercises/options";
import { searchPrivateOptions } from "@/lib/private-exercises/details";

export function SelectedPrivateOptions({ title, name, options, selected, roles, rolePrefix, onChange }: {
  title: string; name: string; options: Option[]; selected: readonly string[];
  roles?: { slug: string; role: string }[]; rolePrefix?: "jointRole" | "actionRole" | "equipmentRole";
  onChange?: (slugs: string[]) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [local, setLocal] = useState([...selected]);
  const checked = onChange ? selected : local;
  const matches = searchPrivateOptions(options, query);
  const roleOptions = rolePrefix === "equipmentRole"
    ? [["required", "Required"], ["optional", "Optional"]]
    : [["primary", "Primary"], ["secondary", "Secondary"], ["stabilization", "Stabilization"]];
  function toggle(slug: string, enabled: boolean) {
    const next = enabled ? [...checked, slug] : checked.filter(value => value !== slug);
    if (onChange) onChange(next); else setLocal(next);
  }
  return <fieldset className="min-w-0">
    <legend className="text-base font-semibold">{title}</legend>
    <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
      {checked.length ? checked.map(slug => <span key={slug} className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
        {options.find(option => option.slug === slug)?.name ?? slug}
      </span>) : <p className="text-sm text-muted-foreground">Unknown / not reviewed</p>}
    </div>
    <label htmlFor={id} className="mt-3 block text-sm">Search {title.toLowerCase()}</label>
    <input id={id} type="search" value={query} onChange={event => setQuery(event.target.value)}
      placeholder="Name or body area" className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base" />
    <div className="mt-3 space-y-2">
      {/* Hide unmatched rows rather than unmounting checked fields or role values. */}
      {options.map(option => {
        const active = checked.includes(option.slug);
        const visible = active || matches.some(match => match.slug === option.slug);
        return <div key={option.slug} hidden={!visible} className="rounded-xl border border-border bg-background px-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
            <input type="checkbox" name={name} value={option.slug} checked={active}
              onChange={event => toggle(option.slug, event.target.checked)} className="size-5 shrink-0 accent-primary" />
            <span>{option.name}</span>
          </label>
          {rolePrefix && <div hidden={!active} className="flex flex-wrap items-center gap-3 pb-3">
            <label htmlFor={`${id}-${option.slug}`} className="text-sm">{option.name} role</label>
            <select id={`${id}-${option.slug}`} name={`${rolePrefix}.${option.slug}`}
              defaultValue={roles?.find(item => item.slug === option.slug)?.role ?? roleOptions[0][0]}
              className="min-h-11 rounded-lg border border-border bg-card px-3 text-base">
              {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>}
        </div>;
      })}
    </div>
    {query && !matches.length && <p role="status" className="mt-3 text-sm text-muted-foreground">No match. Try a familiar area such as chest or shoulders, or a formal name. Selected entries stay above. You can leave this unknown.</p>}
  </fieldset>;
}
