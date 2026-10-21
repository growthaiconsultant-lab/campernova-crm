import fs from 'node:fs'
import { createRequire } from 'node:module'
import postcss from 'postcss'
import tailwind from 'tailwindcss'

const localRequire = createRequire(import.meta.url)
const { build } = createRequire(localRequire.resolve('tsx'))('esbuild')

async function main() {
  fs.mkdirSync('.artifacts/buyer-followup', { recursive: true })
  await build({
    entryPoints: ['tests/ui/buyer-followup-fixture.tsx'],
    bundle: true,
    outfile: '.artifacts/buyer-followup/app.js',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [
      {
        name: 'next-browser-fixture',
        setup(plugin) {
          plugin.onResolve({ filter: /^next\/(navigation|link)$/ }, ({ path }) => ({
            path,
            namespace: 'fixture',
          }))
          plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
            contents: path.endsWith('navigation')
              ? 'export function useRouter() { return { refresh() {}, replace() {} } }'
              : 'import React from "react"; export default function Link(props) { return React.createElement("a", props) }',
            resolveDir: process.cwd(),
          }))
        },
      },
    ],
  })
  const css = await postcss([tailwind('./tailwind.config.ts')]).process(
    fs.readFileSync('app/globals.css', 'utf8'),
    { from: 'app/globals.css' }
  )
  fs.writeFileSync('.artifacts/buyer-followup/style.css', css.css)
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
