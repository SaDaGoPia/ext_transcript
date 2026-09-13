export function sanitizeForFilename(text) {
  return text.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 100);
}

export function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

export function buildTranscriptFilename(tabTitle, date = new Date()) {
  return `Transcript – ${sanitizeForFilename(tabTitle)} – ${formatTimestamp(date)}.txt`;
}
