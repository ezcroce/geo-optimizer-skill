// Identità stabile della stazione (tag), non indice nell'elenco delle mappe.
export function createRecords(getStorage = () => globalThis.localStorage) {
  const key = (station) => `gravity-best:${station}`;
  function read(station) {
    try {
      const score = Number(getStorage()?.getItem(key(station)));
      return Number.isFinite(score) && score >= 0 ? Math.floor(score) : 0;
    } catch {
      return 0;
    }
  }
  function save(station, score, { eligible = true } = {}) {
    const best = read(station);
    if (!eligible || !Number.isFinite(score) || score <= best) return best;
    const next = Math.floor(score);
    try {
      getStorage()?.setItem(key(station), String(next));
    } catch {
      /* Storage privato o quota esaurita: il turno resta giocabile. */
    }
    return next;
  }
  return { read, save };
}
