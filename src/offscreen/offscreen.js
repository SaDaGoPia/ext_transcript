import { TabRecorder } from './recorder.js';
import { transcribeAudioBlob } from './transcriber.js';
import { MessageType, createMessage, isMessageOfType } from '../lib/messaging.js';
import { saveTranscript } from '../lib/storage.js';

const recorder = new TabRecorder();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isMessageOfType(message, MessageType.START_RECORDING)) {
    recorder.start(message.payload.streamId)
      .then(() => sendResponse(createMessage(MessageType.RECORDING_STARTED)))
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  if (isMessageOfType(message, MessageType.STOP_RECORDING)) {
    const tabTitle = message.payload?.tabTitle ?? 'transcript';
    recorder.stop()
      .then(async (blob) => {
        const text = await transcribeAudioBlob(blob);

        // Persist here, not only in the popup: Chrome closes the popup on blur,
        // and a long transcription means the popup is often gone by now — which
        // would otherwise tear down the message channel and lose the transcript.
        try {
          await saveTranscript({ text, tabTitle });
        } catch (error) {
          console.error('Failed to persist transcript from the offscreen document', error);
        }

        sendResponse(createMessage(MessageType.TRANSCRIPTION_DONE, { text }));
      })
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  return false;
});

console.log('Tab Transcript offscreen document ready');
