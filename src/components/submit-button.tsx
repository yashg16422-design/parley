"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Three small dots in place of the label while the parent form's server action runs. */
export const InlineDots = () => (
  <span className="flex gap-1 py-1" aria-label="Working">
    {[0, 1, 2].map((i) => <span key={i} className="loading-dot size-1.5 rounded-full bg-current" />)}
  </span>
);

/** A form's submit button that shows it's working and can't be double-submitted. */
export function SubmitButton({ children, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? <InlineDots /> : children}
    </Button>
  );
}
