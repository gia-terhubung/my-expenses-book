/** @type {import('jest').Config} */
module.exports = {
  globalSetup: "<rootDir>/test/globalTz.js",
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
      testMatch: ["<rootDir>/src/**/*.test.tsx", "<rootDir>/test/**/*.test.tsx"],
      // Reanimated 4's own Jest mock loads the native module, so UI suites get a light stand-in.
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^react-native-reanimated$": "<rootDir>/test/reanimatedMock.js",
        // The worklets runtime needs the native module; its own mock runs worklets as plain JS.
        "^react-native-worklets$": "<rootDir>/node_modules/react-native-worklets/lib/module/mock.js",
        "^expo-notifications$": "<rootDir>/test/expoNotificationsMock.js",
        // Screens now reach the key store through their imports; the native module is not in Jest.
        "^react-native-quick-crypto$": "<rootDir>/test/nodeCrypto.js",
      },
      // Ruling T: UI suites exceed the 5 s default under full parallel load. `testTimeout` is a
      // global-only option (ignored inside `projects`), so the project sets it in a setup file.
      setupFilesAfterEnv: ["<rootDir>/test/jestExpoTimeout.js"],
      // Mocks gesture-handler's native module so its components and hooks render under Jest.
      setupFiles: ["<rootDir>/node_modules/react-native-gesture-handler/jestSetup.js"],
    },
  ],
};
