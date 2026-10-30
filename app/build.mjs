// Bundle web/ → www/ (dipakai GitHub Pages dan APK). `--serve` untuk uji lokal di http://localhost:5177
import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("www", { recursive: true, force: true });
await mkdir("www");
await cp("web", "www", { recursive: true, filter: (src) => !src.endsWith("ui.js") });

const options = {
  entryPoints: ["web/ui.js"],
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2020",
  outfile: "www/ui.js",
};

if (process.argv.includes("--serve")) {
  const ctx = await esbuild.context(options);
  await ctx.serve({ servedir: "www", port: 5177 });
  console.log("http://localhost:5177");
} else {
  await esbuild.build(options);
}
