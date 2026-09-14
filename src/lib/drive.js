export function buildMultipartUploadBody(boundary, metadata, fileContent, mimeType) {
  const delimiter = `--${boundary}\r\n`;
  const closeDelimiter = `--${boundary}--`;
  return (
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    '\r\n' +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    fileContent +
    '\r\n' +
    closeDelimiter
  );
}

export async function uploadTranscriptToDrive({ accessToken, folderId, filename, content, fetchImpl = fetch }) {
  // Spanish transcripts contain accented characters, so the charset must be explicit.
  const TRANSCRIPT_MIME_TYPE = 'text/plain; charset=UTF-8';
  const boundary = `tab_transcript_boundary_${Date.now()}`;
  const metadata = { name: filename, parents: [folderId], mimeType: TRANSCRIPT_MIME_TYPE };
  const body = buildMultipartUploadBody(boundary, metadata, content, TRANSCRIPT_MIME_TYPE);

  const response = await fetchImpl('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Drive upload failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export async function findOrCreateAppFolder({ accessToken, folderName, fetchImpl = fetch }) {
  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id,name)`;

  const listResponse = await fetchImpl(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    const errorBody = await listResponse.text();
    throw new Error(`Drive folder lookup failed (${listResponse.status}): ${errorBody}`);
  }

  const { files } = await listResponse.json();
  if (files && files.length > 0) {
    return { id: files[0].id, name: files[0].name };
  }

  const createResponse = await fetchImpl('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }),
  });

  if (!createResponse.ok) {
    const errorBody = await createResponse.text();
    throw new Error(`Drive folder creation failed (${createResponse.status}): ${errorBody}`);
  }

  const created = await createResponse.json();
  return { id: created.id, name: created.name };
}
