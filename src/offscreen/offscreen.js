import { TabRecorder } from './recorder.js';
import { transcribeAudioBlob } from './transcriber.js';
import { MessageType, createMessage, isMessageOfType } from '../lib/messaging.js';

const recorder = new TabRecorder();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isMessageOfType(message, MessageType.START_RECORDING)) {
    recorder.start(message.payload.streamId)
      .then(() => sendResponse(createMessage(MessageType.RECORDING_STARTED)))
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  if (isMessageOfType(message, MessageType.STOP_RECORDING)) {
    recorder.stop()
      .then(async (blob) => {
        const text = await transcribeAudioBlob(blob);
        sendResponse(createMessage(MessageType.TRANSCRIPTION_DONE, { text }));
      })
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  return false;
});

console.log('Tab Transcript offscreen document ready');
