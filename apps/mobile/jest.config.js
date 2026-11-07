/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
      transform: { "^.+\\.tsx?$": ["babel-jest", { presets: ["babel-preset-expo"] }] },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^react-native-quick-crypto$": "<rootDir>/test/nodeCrypto.js",
      },
    },
    {
      displayName: "jest-expo",
      preset: "jest-expo",
      testMatch: ["<rootDir>/src/**/*.test.tsx"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
      // Ruling T: UI suites exceed the 5 s default under full parallel load. `testTimeout` is a
      // global-only option (ignored inside `projects`), so the project sets it in a setup file.
      setupFilesAfterEnv: ["<rootDir>/test/jestExpoTimeout.js"],
    },
  ],
};
