export function makeId(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
}
