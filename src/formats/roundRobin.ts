export function roundRobinPairings(ids: string[]): Array<Array<[string, string]>> {
  if (ids.length < 2) return [];
  const normalized = [...ids];
  const hasBye = normalized.length % 2 !== 0;
  if (hasBye) normalized.push("__ghost__");
  const rounds: Array<Array<[string, string]>> = [];
  const n = normalized.length;
  const slots = [...normalized];
  for (let round = 0; round < n - 1; round += 1) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = slots[i];
      const b = slots[n - 1 - i];
      if (a !== "__ghost__" && b !== "__ghost__") {
        pairs.push([a, b]);
      }
    }
    rounds.push(pairs);
    const fixed = slots[0];
    const rest = slots.slice(1);
    rest.unshift(rest.pop()!);
    slots.splice(0, n, fixed, ...rest);
  }
  return rounds;
}
