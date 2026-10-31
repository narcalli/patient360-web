// The options of a SelectField: value, label, and optionally the heading it is listed under.
export type Choice = [value: string, label: string, group?: string];

/** Above this many options a list is opened in a modal with a search box instead of a native select. */
export const MOST_WITHOUT_SEARCH = 10;

export const needsSearch = (options: readonly Choice[]) => options.length > MOST_WITHOUT_SEARCH;

/** Options holding every word typed, in any order, in the label or the heading. */
export function matchChoices(options: Choice[], query: string): Choice[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return options.filter(([, label, group]) => {
    const text = `${label} ${group ?? ""}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** Options under their headings, each heading once, in the order they first appear. */
export function groupChoices(options: Choice[]): { group: string | undefined; choices: Choice[] }[] {
  const groups = new Map<string | undefined, Choice[]>();
  for (const option of options) {
    const list = groups.get(option[2]);
    if (list) list.push(option);
    else groups.set(option[2], [option]);
  }
  return [...groups].map(([group, choices]) => ({ group, choices }));
}
