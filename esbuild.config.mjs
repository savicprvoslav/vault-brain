import esbuild from "esbuild";

const production = process.argv[2] === "production";

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", "node:*"],
  format: "cjs",
  target: "es2022",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  platform: "browser",
});

if (production) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
  console.log("esbuild watching…");
}
