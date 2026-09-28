"use client";

import { useActionState } from "react";
import { assignRole, saveTaxonomy, toggleLibraryAsset, type AdminActionState } from "@/app/admin/manage-actions";
import { Constants } from "@/lib/database.types";
import { describedTaxonomies, parentTaxonomies, type TaxonomyName, type TaxonomyRecord } from "@/lib/moderation/taxonomies";

type Choice = { id: string; name: string };
const inputClass = "mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm";

export function TaxonomyForm({ table, record, parents, joints, categories }: {
  table: TaxonomyName; record: TaxonomyRecord | null; parents: Choice[]; joints: Choice[]; categories: Choice[];
}) {
  const [state, action, pending] = useActionState(saveTaxonomy, { error: null });
  return <form action={action} className="space-y-4">
    <input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={record?.id ?? ""} />
    <label className="block text-sm font-semibold">Name<input name="name" required minLength={2} maxLength={120} defaultValue={record?.name ?? ""} className={inputClass} /></label>
    <label className="block text-sm font-semibold">Slug<input name="slug" required readOnly={!!record} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} defaultValue={record?.slug ?? ""} className={inputClass} />
      {record && <span className="mt-2 block text-xs font-normal text-muted-foreground">The saved slug stays fixed so bookmarks keep working.</span>}
    </label>
    {describedTaxonomies.includes(table) && <label className="block text-sm font-semibold">Description<textarea name="description" maxLength={2000} rows={3} defaultValue={record?.description ?? ""} className={inputClass} /></label>}
    {parentTaxonomies.includes(table) && <TaxonomySelect name="parentId" label="Parent" choices={parents.filter((item) => item.id !== record?.id)} value={record?.parent_id ?? ""} />}
    {table === "joint_actions" && <TaxonomySelect name="jointId" label="Anatomical joint" choices={joints} value={record?.joint_id ?? ""} required />}
    {table === "equipment" && <TaxonomySelect name="categoryId" label="Equipment category" choices={categories} value={record?.category_id ?? ""} required />}
    <button name="operation" value="save" disabled={pending} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{pending ? "Saving…" : record ? "Save classification" : "Add classification"}</button>
    {record && <div className="border-t border-border pt-4">
      <label className="flex items-center gap-2 text-xs text-muted-foreground"><input name="confirmDelete" type="checkbox" value="1" />Delete this unused classification</label>
      <button name="operation" value="delete" formNoValidate disabled={pending} className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300">Delete classification</button>
    </div>}
    <ActionFeedback state={state} />
  </form>;
}

function TaxonomySelect({ name, label, choices, value, required }: { name: string; label: string; choices: Choice[]; value: string; required?: boolean }) {
  return <label className="block text-sm font-semibold">{label}<select name={name} defaultValue={value} required={required} className={inputClass}>
    <option value="">{required ? "Choose a classification" : "No parent"}</option>{choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
  </select></label>;
}

export function AssetAvailabilityForm({ table, id, active }: { table: "rigs" | "equipment_assets"; id: string; active: boolean }) {
  const [state, action, pending] = useActionState(toggleLibraryAsset, { error: null });
  return <form action={action}>
    <input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={active ? "0" : "1"} />
    <button disabled={pending} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">{pending ? "Saving…" : active ? "Retire" : "Enable"}</button><ActionFeedback state={state} />
  </form>;
}

export function RoleForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(assignRole, { error: null });
  return <form action={action} className="space-y-4">
    <label className="block text-sm font-semibold">Account ID<input name="userId" required defaultValue={userId} className={inputClass} /></label>
    <label className="block text-sm font-semibold">Role<select name="role" className={inputClass} defaultValue="reviewer">
      {Constants.public.Enums.app_role.map((role) => <option key={role} value={role}>{role}</option>)}
    </select></label>
    <label className="block text-sm font-semibold">Reason<textarea name="comment" required minLength={5} maxLength={1000} rows={2} className={inputClass} /></label>
    <button disabled={pending} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{pending ? "Saving…" : "Assign role"}</button><ActionFeedback state={state} />
  </form>;
}

function ActionFeedback({ state }: { state: AdminActionState }) {
  return <>{state.error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{state.error}</p>}{state.message && <p role="status" className="mt-3 text-sm text-primary">{state.message}</p>}</>;
}
