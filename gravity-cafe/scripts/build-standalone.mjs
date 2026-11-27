// Un HTML reale per file://: nessun modulo esterno, fetch su disco o CDN.
import { build } from "vite";
import { readFile, mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(join(tmpdir(), "gravity-standalone-"));
try {
  const modelData = Object.fromEntries(
    await Promise.all(
      ["barista", "customer", "cup"].map(async (name) => [
        name,
        `data:model/gltf-binary;base64,${(await readFile(join(root, "public/models", `${name}.glb`))).toString("base64")}`,
      ]),
    ),
  );
  const fonts = new Map();
  for (const weight of [400, 500, 600, 700]) {
    const name = `geist-latin-${weight}-normal.woff2`;
    fonts.set(
      `/fonts/${name}`,
      `data:font/woff2;base64,${(await readFile(join(root, "public/fonts", name))).toString("base64")}`,
    );
  }
  await build({
    configFile: false,
    root,
    base: "./",
    publicDir: false,
    plugins: [
      {
        name: "gravity-self-contained",
        enforce: "pre",
        transform(source, id) {
          if (id.replaceAll("\\", "/").endsWith("/src/model-assets.js"))
            return `const urls=${JSON.stringify(modelData)};export function modelURL(name){if(!urls[name])throw new Error('Modello sconosciuto');return urls[name];}`;
          if (id.replaceAll("\\", "/").endsWith("/src/style.css"))
            return source.replace(
              /url\(["']?(\/fonts\/[^)'"\s]+)["']?\)/g,
              (_, path) => {
                if (!fonts.has(path))
                  throw new Error(`Font non incorporato: ${path}`);
                return `url("${fonts.get(path)}")`;
              },
            );
        },
      },
    ],
    build: {
      outDir: temporary,
      emptyOutDir: true,
      cssCodeSplit: false,
      reportCompressedSize: false,
      rollupOptions: { output: { inlineDynamicImports: true, format: "iife" } },
    },
  });
  let html = await readFile(join(temporary, "index.html"), "utf8");
  const scripts = [
    ...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g),
  ];
  if (scripts.length !== 1)
    throw new Error("La build autonoma richiede un solo bundle.");
  const js = await readFile(join(temporary, scripts[0][1]), "utf8");
  const cssLinks = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
  let css = "";
  for (const [tag] of cssLinks) {
    const href = tag.match(/href="([^"]+)"/)?.[1];
    if (!href) throw new Error("CSS senza percorso");
    css += await readFile(join(temporary, href), "utf8");
    html = html.replace(tag, "");
  }
  html = html.replace(scripts[0][0], "");
  html = html.replace(
    "</head>",
    `<style>${css.replaceAll("</style", "<\\/style")}</style>\n</head>`,
  );
  // Sostituzione con callback: il bundle contiene $&, $` e template letterali.
  html = html.replace(
    "</body>",
    () =>
      `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>\n</body>`,
  );
  if (/<script\b[^>]*src=|<link\b[^>]*(?:stylesheet|modulepreload)/i.test(html))
    throw new Error("Rimangono dipendenze HTML esterne.");
  const output = join(root, "downloads", "Gravity-Cafe.html");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html);
  console.log(
    `\nPronto: ${output}\n${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB · doppio clic · nessun server necessario`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
