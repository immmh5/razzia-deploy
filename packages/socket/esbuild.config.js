import esbuild from "esbuild"

export const config = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  outfile: "dist/index.cjs",
  // libsql loads a platform-specific native module at runtime; bundling it
  // inlines a single architecture and breaks the other half of the multi-arch
  // image. Resolve from node_modules instead.
  packages: "external",
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
}

void esbuild.build(config)
