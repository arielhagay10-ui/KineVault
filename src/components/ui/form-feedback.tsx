"use client";

import { startTransition, useEffect, type FormEvent, type RefObject } from "react";

/** Dispatch explicitly so returned validation errors do not reset uncontrolled fields. */
export function submitPreservingValues(event: FormEvent<HTMLFormElement>, action: (data: FormData) => void) {
  event.preventDefault();
  const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
  startTransition(() => action(data));
}

export function FormError({ children, id = "form-error" }: { children: string | null; id?: string }) {
  return children ? <p id={id} role="alert" tabIndex={-1} className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{children}</p> : null;
}

/** Reveal validation errors inside collapsed sections and focus their input. */
export function focusInvalidField(form: HTMLFormElement, name?: string | null) {
  const field = name ? form.elements.namedItem(name) : form.querySelector(":invalid");
  const input = field instanceof RadioNodeList ? field[0] : field;
  if (!(input instanceof HTMLElement)) return;
  let ancestor = input.parentElement;
  while (ancestor && ancestor !== form) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    ancestor = ancestor.parentElement;
  }
  input.focus();
}

export function useFormErrorFocus(form: RefObject<HTMLFormElement | null>, error: string | null, field?: string | null) {
  useEffect(() => {
    if (!error || !form.current) return;
    focusInvalidField(form.current, field);
    const control = field ? form.current.elements.namedItem(field) : null;
    const inputs = control instanceof RadioNodeList ? [...control] : control ? [control] : [];
    for (const input of inputs) if (input instanceof HTMLElement) {
      input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", "form-error");
    }
    if (!field && !form.current.querySelector(":invalid")) form.current.querySelector<HTMLElement>("[role=alert]")?.focus();
    return () => {
      for (const input of inputs) if (input instanceof HTMLElement) {
        input.removeAttribute("aria-invalid"); input.removeAttribute("aria-describedby");
      }
    };
  }, [form, error, field]);
}
