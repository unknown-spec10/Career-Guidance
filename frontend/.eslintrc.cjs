module.exports = {
  root: true,
  env: { 
    browser: true, 
    node: true, 
    es2020: true 
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-useless-escape': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/no-unescaped-entities': 'off',
    'no-empty': 'off',
    'no-extra-semi': 'off',
    'react/jsx-no-target-blank': 'off',
    'react-refresh/only-export-components': 'off',
    'react/prop-types': 'off',
    'no-constant-condition': 'off',
    'react/jsx-no-undef': 'off',
    'react-hooks/exhaustive-deps': 'off',
    // Theme system: ban hardcoded light-surface utilities. Use semantic
    // tokens instead (bg-surface-container-lowest for cards/modals,
    // bg-surface-muted for page washes/wells). See
    // docs_wiki/LIGHT_THEME_AUDIT.md. Non-standard shades (slate-150, …)
    // are defined in tailwind.config.js and remapped by the index.css
    // dark blanket — do not reintroduce raw surface steps.
    'no-restricted-syntax': ['error',
      {
        selector: 'Literal[value=/bg-white([\\s\\x2f]|$)|bg-(gray|slate)-50([\\s\\x2f]|$)/]',
        message: 'Hardcoded surface color banned — use bg-surface-container-lowest (cards) or bg-surface-muted (washes/wells).',
      },
      {
        selector: 'TemplateElement[value.raw=/bg-white([\\s\\x2f]|$)|bg-(gray|slate)-50([\\s\\x2f]|$)/]',
        message: 'Hardcoded surface color banned — use bg-surface-container-lowest (cards) or bg-surface-muted (washes/wells).',
      },
    ],
  },
}
