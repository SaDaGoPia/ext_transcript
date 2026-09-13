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
  const boundary = `tab_transcript_boundary_${Date.now()}`;
  const metadata = { name: filename, parents: [folderId], mimeType: 'text/plain' };
  const body = buildMultipartUploadBody(boundary, metadata, content, 'text/plain');

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
