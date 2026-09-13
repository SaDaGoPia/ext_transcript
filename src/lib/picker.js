const PICKER_API_SRC = 'https://apis.google.com/js/api.js';

let pickerApiLoadPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export function loadPickerApi() {
  if (!pickerApiLoadPromise) {
    pickerApiLoadPromise = loadScript(PICKER_API_SRC).then(
      () => new Promise((resolve) => gapi.load('picker', resolve))
    );
  }
  return pickerApiLoadPromise;
}

export function openFolderPicker({ oauthToken, developerKey }) {
  return loadPickerApi().then(
    () =>
      new Promise((resolve) => {
        const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
          .setSelectFolderEnabled(true)
          .setIncludeFolders(true);

        const picker = new google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(oauthToken)
          .setDeveloperKey(developerKey)
          .setCallback((data) => {
            if (data.action === google.picker.Action.PICKED) {
              const folder = data.docs[0];
              resolve({ id: folder.id, name: folder.name });
            } else if (data.action === google.picker.Action.CANCEL) {
              resolve(null);
            }
          })
          .build();

        picker.setVisible(true);
      })
  );
}
