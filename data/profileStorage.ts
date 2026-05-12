import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system";

const ONBOARD_KEY = "hasOnboarded";
const PROFILE_NAME_KEY = "profileName";
const PROFILE_PHOTO_KEY = "profilePhotoUri";
const PROFILE_DONE_KEY = "hasCompletedLocalProfile";
const APP_LOCK_ENABLED_KEY = "appLockEnabled";
const PROFILE_PHOTOS_DIR_NAME = "profile-photos";

function getProfilePhotosDirectory() {
  return new FileSystem.Directory(
    FileSystem.Paths.document,
    PROFILE_PHOTOS_DIR_NAME,
  );
}

function isManagedProfilePhotoUri(uri: string) {
  const clean = uri.trim();
  if (!clean) return false;
  return clean.startsWith(getProfilePhotosDirectory().uri);
}

export async function deleteManagedProfilePhoto(uri: string) {
  const clean = uri.trim();
  if (!clean || !isManagedProfilePhotoUri(clean)) return;

  try {
    const file = new FileSystem.File(clean);
    if (file.exists) {
      file.delete();
    }
  } catch {}
}

export async function normalizeStoredProfilePhotoUri(uri: string) {
  const clean = uri.trim();
  if (!clean) return "";

  try {
    const file = new FileSystem.File(clean);
    return file.exists ? clean : "";
  } catch {
    return "";
  }
}

async function loadBoolean(key: string): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(key);
    return v === "true";
  } catch {
    return false;
  }
}

async function saveBoolean(key: string, value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value ? "true" : "false");
  } catch {}
}

async function loadString(key: string): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(key)) ?? "";
  } catch {
    return "";
  }
}

async function saveString(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {}
}

export async function loadOnboardedFlag(): Promise<boolean> {
  return loadBoolean(ONBOARD_KEY);
}

export async function saveOnboardedFlag(value: boolean): Promise<void> {
  await saveBoolean(ONBOARD_KEY, value);
}

export async function loadProfileName(): Promise<string> {
  return loadString(PROFILE_NAME_KEY);
}

export async function saveProfileName(value: string): Promise<void> {
  await saveString(PROFILE_NAME_KEY, value);
}

export async function loadProfilePhotoUri(): Promise<string> {
  return loadString(PROFILE_PHOTO_KEY);
}

export async function saveProfilePhotoUri(value: string): Promise<void> {
  await saveString(PROFILE_PHOTO_KEY, value);
}

export async function loadProfileDoneFlag(): Promise<boolean> {
  return loadBoolean(PROFILE_DONE_KEY);
}

export async function saveProfileDoneFlag(value: boolean): Promise<void> {
  await saveBoolean(PROFILE_DONE_KEY, value);
}

export async function loadAppLockEnabledFlag(): Promise<boolean> {
  return loadBoolean(APP_LOCK_ENABLED_KEY);
}

export async function saveAppLockEnabledFlag(value: boolean): Promise<void> {
  await saveBoolean(APP_LOCK_ENABLED_KEY, value);
}
