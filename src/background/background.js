import { MessageType, createMessage, isMessageOfType } from '../lib/messaging.js';
import { clearRecordingState, loadDriveFolder, saveRecordingState } from '../lib/storage.js';
import { uploadTranscriptToDrive } from '../lib/drive.js';

const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['USER_MEDIA'],
    justification: 'Record and transcribe tab audio locally.',
  });
}

async function startRecording(tabId, tabTitle) {
  await ensureOffscreenDocument();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  const response = await chrome.runtime.sendMessage(
    createMessage(MessageType.START_RECORDING, { streamId })
  );

  // Only mark a recording as in progress if the offscreen document actually
  // started one; otherwise a reopened popup would show a bogus "Recording…".
  // Guarded: the recorder is already running at this point, so a storage failure
  // must not turn a successful start into an ERROR the popup reports as "not recording".
  if (isMessageOfType(response, MessageType.RECORDING_STARTED)) {
    try {
      await saveRecordingState({ inProgress: true, tabTitle });
    } catch (error) {
      console.error('Failed to persist the recording-in-progress flag', error);
    }
  }

  return response;
}

async function stopRecording(tabTitle) {
  try {
    return await chrome.runtime.sendMessage(
      createMessage(MessageType.STOP_RECORDING, { tabTitle })
    );
  } finally {
    // Clear the in-progress flag whether the stop/transcribe succeeded or threw,
    // so the popup never reopens into an unrecoverable "Recording…" state. Guarded
    // so a storage failure here can't mask an otherwise successful transcript.
    try {
      await clearRecordingState();
    } catch (error) {
      console.error('Failed to clear the recording-in-progress flag', error);
    }
  }
}

async function uploadToDrive(filename, content) {
  const folder = await loadDriveFolder();
  if (!folder) {
    throw new Error('No Drive folder configured. Set one up in the extension options.');
  }
  const token = await chrome.identity.getAuthToken({ interactive: true });
  const accessToken = token.token ?? token;
  return uploadTranscriptToDrive({ accessToken, folderId: folder.id, filename, content });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isMessageOfType(message, MessageType.POPUP_START_RECORDING)) {
    startRecording(message.payload.tabId, message.payload.tabTitle)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  if (isMessageOfType(message, MessageType.POPUP_STOP_RECORDING)) {
    stopRecording(message.payload.tabTitle)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  if (isMessageOfType(message, MessageType.DRIVE_UPLOAD_REQUEST)) {
    uploadToDrive(message.payload.filename, message.payload.content)
      .then(() => sendResponse(createMessage(MessageType.DRIVE_UPLOAD_DONE)))
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  return false;
});
