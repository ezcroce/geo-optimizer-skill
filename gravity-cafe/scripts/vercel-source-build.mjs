import { execFileSync } from "node:child_process";
import { mkdirSync, cpSync, existsSync } from "node:fs";
// Vercel connector bootstrap: build an exact public Git commit without a Git login connection.
const sha =
  process.env.SOURCE_COMMIT || "72bdd89cf23c5af571820110373fe48ee0b5baab";
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Expected a full commit SHA");
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
if (process.argv[2] === "install") {
  mkdirSync("source", { recursive: true });
  run("curl", [
    "--fail",
    "--location",
    "--retry",
    "3",
    "--output",
    "source.tar.gz",
    "https://codeload.github.com/ezcroce/geo-optimizer-skill/tar.gz/" + sha,
  ]);
  run("tar", ["-xzf", "source.tar.gz", "--strip-components=1", "-C", "source"]);
  run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: "source/gravity-cafe" });
} else {
  if (!existsSync("source/gravity-cafe/package.json"))
    throw new Error("Source archive not installed");
  run("npm", ["run", "build"], { cwd: "source/gravity-cafe" });
  cpSync("source/gravity-cafe/dist", "dist", { recursive: true });
  console.log("Gravity Cafe release", sha);
}
