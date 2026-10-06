import esbuild from "esbuild"

export const config = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  outfile: "dist/index.cjs",
  // libsql loads a platform-specific native module at runtime; bundling it
  // inlines a single architecture and breaks the other half of the multi-arch
  // image. Only the native @libsql/* packages stay external.
  external: ["@libsql/*"],
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
}

void esbuild.build(config)
