import { MessageType, createMessage, isMessageOfType } from '../lib/messaging.js';
import { loadDriveFolder, loadTranscript, saveTranscript } from '../lib/storage.js';
import { buildTranscriptFilename } from '../lib/filename.js';

const startStopButton = document.getElementById('start-stop');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const downloadButton = document.getElementById('download');
const uploadButton = document.getElementById('upload');
const folderInfoEl = document.getElementById('folder-info');

let isRecording = false;
let lastTranscript = null;
let activeTabTitle = '';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshFolderInfo() {
  const folder = await loadDriveFolder();
  if (folder) {
    folderInfoEl.innerHTML = `Uploading to: <b>${folder.name}</b> · <a href="https://drive.google.com/drive/folders/${folder.id}" target="_blank" rel="noopener">Open in Drive</a>`;
  } else {
    folderInfoEl.textContent = 'No Drive folder configured (see Options).';
    uploadButton.disabled = true;
  }
}

async function restoreTranscript() {
  const cached = await loadTranscript();
  if (cached) {
    lastTranscript = cached.text;
    activeTabTitle = cached.tabTitle;
    transcriptEl.value = cached.text;
    downloadButton.disabled = false;
    uploadButton.disabled = false;
    statusEl.textContent = 'Done (restored)';
  }
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
        createMessage(MessageType.POPUP_START_RECORDING, { tabId: tab.id })
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
      const response = await chrome.runtime.sendMessage(createMessage(MessageType.POPUP_STOP_RECORDING));

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
      uploadButton.disabled = false;
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
  const blob = new Blob([lastTranscript], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false });
});

uploadButton.addEventListener('click', async () => {
  uploadButton.disabled = true;
  statusEl.textContent = 'Uploading to Drive…';
  const filename = buildTranscriptFilename(activeTabTitle);

  try {
    const response = await chrome.runtime.sendMessage(
      createMessage(MessageType.DRIVE_UPLOAD_REQUEST, { filename, content: lastTranscript })
    );

    uploadButton.disabled = false;
    statusEl.textContent = isMessageOfType(response, MessageType.ERROR)
      ? `Upload failed: ${response.payload.message}`
      : 'Uploaded to Drive';
  } catch (error) {
    uploadButton.disabled = false;
    statusEl.textContent = `Error: ${error.message}`;
  }
});

restoreTranscript();
refreshFolderInfo();
