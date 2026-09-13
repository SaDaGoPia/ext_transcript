import { loadDriveFolder, saveDriveFolder } from '../lib/storage.js';
import { openFolderPicker } from '../lib/picker.js';

const DEVELOPER_KEY = 'REPLACE_WITH_YOUR_GOOGLE_API_KEY';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const connectButton = document.getElementById('connect');
const chooseFolderButton = document.getElementById('choose-folder');
const folderStatusEl = document.getElementById('folder-status');

async function refreshFolderStatus() {
  const folder = await loadDriveFolder();
  folderStatusEl.textContent = folder ? `Current folder: ${folder.name}` : 'No folder selected yet.';
}

connectButton.addEventListener('click', async () => {
  const token = await chrome.identity.getAuthToken({ interactive: true, scopes: [DRIVE_SCOPE] });
  const accessToken = token.token ?? token;
  chooseFolderButton.disabled = false;
  chooseFolderButton.dataset.token = accessToken;
  folderStatusEl.textContent = 'Connected. Now choose a folder.';
});

chooseFolderButton.addEventListener('click', async () => {
  const oauthToken = chooseFolderButton.dataset.token;
  const folder = await openFolderPicker({ oauthToken, developerKey: DEVELOPER_KEY });
  if (folder) {
    await saveDriveFolder(folder);
    await refreshFolderStatus();
  }
});

refreshFolderStatus();
