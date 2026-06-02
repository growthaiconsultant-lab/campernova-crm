/**
 * Conventional Commits — enforced via husky commit-msg hook.
 * Tipos permitidos: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
 * El cuerpo y el subject pueden ir en español; el prefijo (tipo) es obligatorio.
 * Ej.: "feat(compradores): añade filtro de origen"  ·  "chore: limpieza de higiene"
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // El subject puede empezar en mayúscula o minúscula (permitimos español natural)
    'subject-case': [0],
    // Permitir subjects algo más largos (mensajes descriptivos en español)
    'header-max-length': [2, 'always', 100],
  },
}
