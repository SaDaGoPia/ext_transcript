const TRANSCRIPT_KEY = 'lastTranscript';
const RECORDING_STATE_KEY = 'recordingState';

export async function saveTranscript(transcript, storageArea = chrome.storage.session) {
  await storageArea.set({ [TRANSCRIPT_KEY]: transcript });
}

export async function loadTranscript(storageArea = chrome.storage.session) {
  const result = await storageArea.get(TRANSCRIPT_KEY);
  return result[TRANSCRIPT_KEY] ?? null;
}

export async function saveRecordingState(state, storageArea = chrome.storage.session) {
  await storageArea.set({ [RECORDING_STATE_KEY]: state });
}

export async function loadRecordingState(storageArea = chrome.storage.session) {
  const result = await storageArea.get(RECORDING_STATE_KEY);
  return result[RECORDING_STATE_KEY] ?? null;
}

// Clears by writing null rather than removing the key, so callers only ever
// need a storage area that supports get/set (matches the rest of this module).
export async function clearRecordingState(storageArea = chrome.storage.session) {
  await storageArea.set({ [RECORDING_STATE_KEY]: null });
}
