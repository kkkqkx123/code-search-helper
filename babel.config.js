export const presets = [
  ['@babel/preset-env', {
    targets: {
      node: 'current'
    }
  }]
];
export const env = {
  test: {
    presets: [
      ['@babel/preset-env', {
        targets: {
          node: 'current'
        },
        modules: 'commonjs'
      }]
    ]
  }
};