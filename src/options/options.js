import { loadDriveFolder, saveDriveFolder } from '../lib/storage.js';
import { findOrCreateAppFolder } from '../lib/drive.js';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const APP_FOLDER_NAME = 'Tab Transcripts';

const connectButton = document.getElementById('connect');
const folderStatusEl = document.getElementById('folder-status');

async function refreshFolderStatus() {
  const folder = await loadDriveFolder();
  if (folder) {
    folderStatusEl.innerHTML = `Uploading to: <b></b> · <a href="https://drive.google.com/drive/folders/${folder.id}" target="_blank" rel="noopener">Open in Drive</a>`;
    folderStatusEl.querySelector('b').textContent = folder.name;
  } else {
    folderStatusEl.textContent = 'Not connected.';
  }
}

connectButton.addEventListener('click', async () => {
  connectButton.disabled = true;
  folderStatusEl.textContent = 'Connecting…';
  try {
    const token = await chrome.identity.getAuthToken({ interactive: true, scopes: [DRIVE_SCOPE] });
    const accessToken = token.token ?? token;
    const folder = await findOrCreateAppFolder({ accessToken, folderName: APP_FOLDER_NAME });
    await saveDriveFolder(folder);
    await refreshFolderStatus();
  } catch (error) {
    folderStatusEl.textContent = `Error: ${error.message}`;
  } finally {
    connectButton.disabled = false;
  }
});

refreshFolderStatus();
