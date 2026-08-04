import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []

const requiredFiles = [
  'AGENTS.md',
  'CONTRIBUTING.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'docs/README.md',
  'docs/governance/sdd-workflow.md',
  'docs/templates/change-brief.md',
]

for (const file of requiredFiles) {
  if (!existsSync(join(repoRoot, file))) errors.push(`Falta el archivo obligatorio: ${file}`)
}

const agentsPath = join(repoRoot, 'AGENTS.md')
if (existsSync(agentsPath)) {
  const agents = readFileSync(agentsPath, 'utf8')
  const lineCount = agents.split(/\r?\n/).length
  if (lineCount > 250) {
    errors.push(`AGENTS.md tiene ${lineCount} líneas; el máximo estable es 250`)
  }

  const volatilePatterns = [/^## Estado actual/im, /^### Sprint \d/im, /COMPLETADO ✅/i]
  for (const pattern of volatilePatterns) {
    if (pattern.test(agents)) {
      errors.push(`AGENTS.md contiene estado volátil prohibido: ${pattern}`)
    }
  }
}

const specsDir = join(repoRoot, 'docs', 'specs')
const changeBriefPattern = /^[A-Z][A-Z0-9]*-\d+-[^/]+\.md$/
const allowedStatuses = new Set([
  'DRAFT',
  'APPROVED',
  'IMPLEMENTED',
  'DEPLOYED',
  'VALIDATED',
  'SUPERSEDED',
])

const changeBriefs = existsSync(specsDir)
  ? readdirSync(specsDir).filter((name) => changeBriefPattern.test(name))
  : []

for (const name of changeBriefs) {
  const relative = `docs/specs/${name}`
  const content = readFileSync(join(specsDir, name), 'utf8')
  const state = content.match(/^\|\s*\*\*Estado\*\*\s*\|\s*([A-Z]+)\s*\|$/m)?.[1]

  if (!state || !allowedStatuses.has(state)) {
    errors.push(`${relative}: Estado ausente o inválido`)
  }

  const requiredSections = [
    /^## Problema/m,
    /^## Resultado esperado/m,
    /^## Criterios de aceptación/m,
    /^## Rollout/m,
  ]

  for (const section of requiredSections) {
    if (!section.test(content)) errors.push(`${relative}: falta la sección ${section}`)
  }
}

const markdownFiles = [
  ...requiredFiles,
  ...readdirSync(join(repoRoot, 'docs', 'governance'))
    .filter((name) => extname(name) === '.md')
    .map((name) => `docs/governance/${name}`),
  ...changeBriefs.map((name) => `docs/specs/${name}`),
]

for (const relative of new Set(markdownFiles)) {
  const absolute = join(repoRoot, relative)
  if (!existsSync(absolute)) continue
  const content = readFileSync(absolute, 'utf8')

  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const rawLink = match[1]
    if (!rawLink || /^(https?:\/\/|mailto:|#)/.test(rawLink)) continue

    const pathOnly = decodeURIComponent(rawLink.split('#')[0].split('?')[0])
    if (!pathOnly) continue

    const target = resolve(dirname(absolute), pathOnly)
    if (!existsSync(target)) errors.push(`${relative}: enlace roto -> ${rawLink}`)
  }
}

if (errors.length > 0) {
  console.error('SDD check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`SDD check passed: ${changeBriefs.length} change briefs y enlaces canónicos válidos`)
