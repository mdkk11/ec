module.exports = {
  forbidden: [],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        '\\.next',
        '\\.storybook',
        'coverage',
        'node_modules',
        'playwright-report',
        'test-results',
        'tests',
      ].join('|'),
    },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      conditionNames: ['types', 'import', 'module', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
}
