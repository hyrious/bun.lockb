import * as fs from 'node:fs'
import * as dts from '@hyrious/dts'
import * as esbuild from 'esbuild'

esbuild.build({
  entryPoints: ["src/lockb.ts", "src/lockb-cli.ts"],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  logLevel: 'info',
  target: 'node20',
  plugins: [{
    name: 'cli',
    setup({ onResolve, onLoad }) {
      onResolve({ filter: /^\.\/.+\.js$/ }, (args) => {
        return { path: args.path, external: true }
      })
      onLoad({ filter: /\-cli\.ts$/ }, (args) => {
        const code = fs.readFileSync(args.path, 'utf8')
        return { contents: `#!/usr/bin/env node\n${code}`, loader: "default" }
      })
    }
  }]
}).catch(() => process.exit(1))

const { elapsed } = await dts.build('src/lockb.ts', 'dist/lockb.d.ts')
console.log("✅ DTS built in", (elapsed / 1000).toFixed(2), "s")
