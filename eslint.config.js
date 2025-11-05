import ashNazg from 'eslint-config-ash-nazg';

export default [
  ...ashNazg(['sauron']),
  ...ashNazg(['sauron', 'browser']).map((cfg) => {
    return {
      files: ['**/*.html'],
      ...cfg
    };
  }),
  {
    files: ['**/*.md/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        document: true,
        range: true
      }
    },
    rules: {
      strict: 0,
      'import/no-unresolved': 0,
      'import/unambiguous': 0
    }
  },
  {
    rules: {
      'prefer-named-capture-group': 0,
      'unicorn/prefer-spread': 0
    }
  }
];
