// La build autonoma sostituisce questo modulo con tre GLB incorporati come data URL.
// In sviluppo e nella build web rimangono normali file locali, caricati una sola volta.
export function modelURL(name, base = "/") {
  if (!["barista", "customer", "cup"].includes(name))
    throw new Error(`Modello sconosciuto: ${name}`);
  return `${base}models/${name}.glb`;
}
