import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'
import reactHooks from 'eslint-plugin-react-hooks'

const config = [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'dist/**', 'coverage/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/immutability': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
    },
  },
]

export default config