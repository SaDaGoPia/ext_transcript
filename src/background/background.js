import { MessageType, createMessage, isMessageOfType } from '../lib/messaging.js';
import { loadDriveFolder } from '../lib/storage.js';
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

async function startRecording(tabId) {
  await ensureOffscreenDocument();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  return chrome.runtime.sendMessage(createMessage(MessageType.START_RECORDING, { streamId }));
}

async function stopRecording() {
  return chrome.runtime.sendMessage(createMessage(MessageType.STOP_RECORDING));
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
    startRecording(message.payload.tabId)
      .then(() => sendResponse(createMessage(MessageType.RECORDING_STARTED)))
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  if (isMessageOfType(message, MessageType.POPUP_STOP_RECORDING)) {
    stopRecording()
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
