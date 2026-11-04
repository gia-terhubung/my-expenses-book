import * as SecureStore from "expo-secure-store";
import type { SecretStore } from "./keys";

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const expoSecretStore: SecretStore = {
  get: (k) => SecureStore.getItemAsync(k, options),
  set: (k, v) => SecureStore.setItemAsync(k, v, options),
  delete: (k) => SecureStore.deleteItemAsync(k, options),
};
