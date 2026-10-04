/** Compare submitted values, excluding React's action transport metadata. */
export function formSnapshot(data: FormData): string {
  return JSON.stringify([...data.entries()]
    .filter(([name]) => !name.startsWith("$ACTION_"))
    .map(([name, value]) => [name, typeof value === "string" ? value : value.name])
    .sort(([keyA, valueA], [keyB, valueB]) => keyA.localeCompare(keyB) || valueA.localeCompare(valueB)));
}
