"use client";

import { deletePrivateExercise } from "@/app/my-exercises/actions";

export function DeletePrivateButton({ privateId }: { privateId: string }) {
  return (
    <form action={deletePrivateExercise} onSubmit={(event) => {
      if (!window.confirm("Delete this private exercise and its draft content?")) event.preventDefault();
    }}>
      <input type="hidden" name="privateId" value={privateId} />
      <button type="submit" className="text-sm font-medium text-red-700 hover:underline">Delete exercise</button>
    </form>
  );
}
