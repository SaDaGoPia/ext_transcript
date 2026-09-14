export const MessageType = Object.freeze({
  POPUP_START_RECORDING: 'POPUP_START_RECORDING',
  POPUP_STOP_RECORDING: 'POPUP_STOP_RECORDING',
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  RECORDING_STARTED: 'RECORDING_STARTED',
  TRANSCRIPTION_DONE: 'TRANSCRIPTION_DONE',
  ERROR: 'ERROR',
});

export function createMessage(type, payload = {}) {
  if (!Object.values(MessageType).includes(type)) {
    throw new Error(`Unknown message type: ${type}`);
  }
  return { type, payload, timestamp: Date.now() };
}

export function isMessageOfType(message, type) {
  return Boolean(message) && message.type === type;
}
