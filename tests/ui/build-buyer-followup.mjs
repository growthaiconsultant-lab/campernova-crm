import fs from 'node:fs'
import { createRequire } from 'node:module'
import postcss from 'postcss'
import tailwind from 'tailwindcss'

const localRequire = createRequire(import.meta.url)
const { build } = createRequire(localRequire.resolve('tsx'))('esbuild')

async function main() {
  fs.mkdirSync('.artifacts/buyer-followup', { recursive: true })
  await build({
    entryPoints: {
      app: 'tests/ui/buyer-followup-fixture.tsx',
      autosave: 'tests/ui/buyer-autosave-fixture.tsx',
      searchRequest: 'tests/ui/search-request-fixture.tsx',
    },
    bundle: true,
    outdir: '.artifacts/buyer-followup',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [
      {
        name: 'next-browser-fixture',
        setup(plugin) {
          plugin.onResolve({ filter: /^\.\/actions$/ }, (args) =>
            args.importer.endsWith('buyer-lead-edit-form.tsx')
              ? { path: 'buyer-actions', namespace: 'fixture' }
              : undefined
          )
          plugin.onResolve({ filter: /^next\/(navigation|link)$/ }, ({ path }) => ({
            path,
            namespace: 'fixture',
          }))
          plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
            contents:
              path === 'buyer-actions'
                ? 'export function updateBuyerLead(id, data, fields) { return window.autosaveHarness.save(data, fields) }'
                : path.endsWith('navigation')
                  ? 'const router = { refresh() {}, replace() {}, push(url) { window.autosaveHarness.destination = url } }; export function useRouter() { return router }'
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
