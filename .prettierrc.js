module.exports = {
  singleQuote: true,
  printWidth: 120,
  overrides: [
    {
      files: "*.sol",
      options: {
        printWidth: 120,
        tabWidth: 2,
        useTabs: false,
        singleQuote: false,
        bracketSpacing: false,
        explicitTypes: "always"
      }
    }
  ],
  plugins: [require.resolve('prettier-plugin-solidity')]
}
