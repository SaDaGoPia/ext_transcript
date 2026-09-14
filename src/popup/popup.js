import { MessageType, createMessage, isMessageOfType } from '../lib/messaging.js';
import { loadRecordingState, loadTranscript, saveTranscript } from '../lib/storage.js';
import { buildTranscriptFilename } from '../lib/filename.js';

const startStopButton = document.getElementById('start-stop');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const downloadButton = document.getElementById('download');

let isRecording = false;
let lastTranscript = null;
let activeTabTitle = '';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function restoreTranscript() {
  const cached = await loadTranscript();
  if (!cached) return false;

  lastTranscript = cached.text;
  activeTabTitle = cached.tabTitle;
  transcriptEl.value = cached.text;
  downloadButton.disabled = false;
  statusEl.textContent = 'Done (restored)';
  return true;
}

// The popup closes on blur, so it can be reopened while the offscreen document
// is still recording. Without this, the button would read "Start Recording" and
// clicking it would throw `Cannot start recording from state "recording"`.
async function restoreRecordingState() {
  const state = await loadRecordingState();
  if (!state?.inProgress) return false;

  isRecording = true;
  activeTabTitle = state.tabTitle ?? activeTabTitle;
  startStopButton.textContent = 'Stop Recording';
  statusEl.textContent = 'Recording…';
  return true;
}

startStopButton.addEventListener('click', async () => {
  if (!isRecording) {
    const tab = await getActiveTab();
    activeTabTitle = tab.title ?? 'transcript';
    statusEl.textContent = 'Recording…';
    startStopButton.textContent = 'Stop Recording';
    isRecording = true;

    try {
      const response = await chrome.runtime.sendMessage(
        createMessage(MessageType.POPUP_START_RECORDING, { tabId: tab.id, tabTitle: activeTabTitle })
      );
      if (isMessageOfType(response, MessageType.ERROR)) {
        statusEl.textContent = `Error: ${response.payload.message}`;
        isRecording = false;
        startStopButton.textContent = 'Start Recording';
      }
    } catch (error) {
      statusEl.textContent = `Error: ${error.message}`;
      isRecording = false;
      startStopButton.textContent = 'Start Recording';
    }
  } else {
    statusEl.textContent = 'Transcribing…';
    startStopButton.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage(
        createMessage(MessageType.POPUP_STOP_RECORDING, { tabTitle: activeTabTitle })
      );

      startStopButton.disabled = false;
      startStopButton.textContent = 'Start Recording';
      isRecording = false;

      if (isMessageOfType(response, MessageType.ERROR)) {
        statusEl.textContent = `Error: ${response.payload.message}`;
        return;
      }

      lastTranscript = response.payload.text;
      statusEl.textContent = 'Done';
      transcriptEl.value = lastTranscript;
      downloadButton.disabled = false;
      // The offscreen document already saved this; re-saving the same data is
      // harmless and keeps this path working on its own if that ever changes.
      await saveTranscript({ text: lastTranscript, tabTitle: activeTabTitle });
    } catch (error) {
      startStopButton.disabled = false;
      startStopButton.textContent = 'Start Recording';
      isRecording = false;
      statusEl.textContent = `Error: ${error.message}`;
    }
  }
});

downloadButton.addEventListener('click', () => {
  const filename = buildTranscriptFilename(activeTabTitle);
  const blob = new Blob([lastTranscript], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false });
});

async function init() {
  await restoreTranscript();
  // Last, so an in-progress recording's status text wins over "Done (restored)".
  await restoreRecordingState();
}

init().catch((error) => {
  statusEl.textContent = `Error: ${error.message}`;
});
