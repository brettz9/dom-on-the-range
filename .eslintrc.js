module.exports = {
  extends: ['ash-nazg', 'plugin:node/recommended-script'],
  env: {
    browser: true
  },
  settings: {
    polyfills: [
    ]
  },
  overrides: [
    {
      files: ['*.md'],
      globals: {
        range: true
      },
      rules: {
        strict: 0
      }
    }
  ],
  rules: {
    // Todo: Switch to ESM
  }
};
