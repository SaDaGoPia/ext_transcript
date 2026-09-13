const TRANSCRIPT_KEY = 'lastTranscript';
const FOLDER_KEY = 'driveFolder';

export async function saveTranscript(transcript, storageArea = chrome.storage.session) {
  await storageArea.set({ [TRANSCRIPT_KEY]: transcript });
}

export async function loadTranscript(storageArea = chrome.storage.session) {
  const result = await storageArea.get(TRANSCRIPT_KEY);
  return result[TRANSCRIPT_KEY] ?? null;
}

export async function saveDriveFolder(folder, storageArea = chrome.storage.local) {
  await storageArea.set({ [FOLDER_KEY]: folder });
}

export async function loadDriveFolder(storageArea = chrome.storage.local) {
  const result = await storageArea.get(FOLDER_KEY);
  return result[FOLDER_KEY] ?? null;
}
