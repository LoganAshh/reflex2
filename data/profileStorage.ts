import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";

const ONBOARD_KEY = "hasOnboarded";
const PROFILE_NAME_KEY = "profileName";
const PROFILE_PHOTO_KEY = "profilePhotoUri";
const PROFILE_DONE_KEY = "hasCompletedLocalProfile";
const APP_LOCK_ENABLED_KEY = "appLockEnabled";
const PROFILE_PHOTOS_DIR_NAME = "profile-photos";

const profilePhotoPrefix = `${PROFILE_PHOTOS_DIR_NAME}/`;

function getProfilePhotosDirectoryUri() {
  return `${FileSystem.documentDirectory}${PROFILE_PHOTOS_DIR_NAME}/`;
}

function getPhotoExtension(uri: string) {
  const cleanUri = uri.split("?")[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

function isRelativeProfilePhotoPath(value: string) {
  return value.startsWith(profilePhotoPrefix) && !value.includes("..");
}

function getRelativeProfilePhotoPath(uri: string) {
  const clean = uri.trim();
  if (!clean) return "";

  if (isRelativeProfilePhotoPath(clean)) return clean;

  const currentDir = getProfilePhotosDirectoryUri();
  if (clean.startsWith(currentDir)) {
    return `${profilePhotoPrefix}${clean.slice(currentDir.length)}`;
  }

  const marker = `/${PROFILE_PHOTOS_DIR_NAME}/`;
  const markerIndex = clean.indexOf(marker);

  if (markerIndex >= 0) {
    const fileName = clean.slice(markerIndex + marker.length);
    if (fileName && !fileName.includes("..")) {
      return `${profilePhotoPrefix}${fileName}`;
    }
  }

  return "";
}

function getUriFromRelativeProfilePhotoPath(value: string) {
  if (!isRelativeProfilePhotoPath(value)) return "";
  return `${FileSystem.documentDirectory}${value}`;
}

async function fileExists(uri: string) {
  if (!uri.trim()) return false;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !(info as any).isDirectory;
  } catch {
    return false;
  }
}

async function ensureProfilePhotoDirectory() {
  const dir = getProfilePhotosDirectoryUri();
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => {},
  );
  return dir;
}

async function normalizeProfilePhotoStorageValue(value: string) {
  const clean = value.trim();
  if (!clean) return "";

  const relative = getRelativeProfilePhotoPath(clean);

  if (relative) {
    const currentUri = getUriFromRelativeProfilePhotoPath(relative);
    if (await fileExists(currentUri)) return relative;
  }

  if (clean.startsWith("file://") && (await fileExists(clean))) return clean;

  return "";
}

export async function persistPickedProfilePhoto(uri: string) {
  const source = uri.trim();
  if (!source) throw new Error("Missing photo file.");

  const dir = await ensureProfilePhotoDirectory();
  const ext = getPhotoExtension(source);
  const destination = `${dir}profile-${Date.now()}.${ext}`;

  await FileSystem.copyAsync({ from: source, to: destination });

  return destination;
}

export async function deleteManagedProfilePhoto(uri: string) {
  const clean = uri.trim();
  if (!clean) return;

  const relative = getRelativeProfilePhotoPath(clean);
  const currentUri = relative
    ? getUriFromRelativeProfilePhotoPath(relative)
    : "";

  if (!currentUri) return;

  try {
    const info = await FileSystem.getInfoAsync(currentUri);
    if (info.exists) {
      await FileSystem.deleteAsync(currentUri, { idempotent: true });
    }
  } catch {}
}

export async function normalizeStoredProfilePhotoUri(uri: string) {
  const storageValue = await normalizeProfilePhotoStorageValue(uri);
  if (!storageValue) return "";

  if (isRelativeProfilePhotoPath(storageValue)) {
    return getUriFromRelativeProfilePhotoPath(storageValue);
  }

  return storageValue;
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
  const storedValue = await loadString(PROFILE_PHOTO_KEY);
  return normalizeStoredProfilePhotoUri(storedValue);
}

export async function saveProfilePhotoUri(value: string): Promise<void> {
  const storageValue = await normalizeProfilePhotoStorageValue(value);
  await saveString(PROFILE_PHOTO_KEY, storageValue);
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
