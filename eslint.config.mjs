import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/**
 * Next.js 16 ESLint flat config.
 *
 * React Compiler–oriented react-hooks rules from eslint-plugin-react-hooks v7
 * are disabled because this app does not enable the React Compiler. Classic
 * Rules of Hooks + exhaustive-deps remain active via eslint-config-next.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/component-hook-factories': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.eslint-report.json',
    'public/sw.js',
    'public/workbox-*.js',
    'public/worker-*.js',
    'public/swe-worker-*.js',
    'public/fallback-*.js',
    'vendor/**',
    // Maintenance scripts (service-role); not part of the app runtime.
    'scripts/**',
  ]),
])

export default eslintConfig
