import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForFilename, formatTimestamp, buildTranscriptFilename } from '../src/lib/filename.js';

test('sanitizeForFilename strips characters illegal in filenames', () => {
  assert.equal(sanitizeForFilename('Meeting: Q3 / Planning?'), 'Meeting Q3  Planning');
});

test('sanitizeForFilename trims whitespace and caps length at 100', () => {
  const long = 'a'.repeat(150);
  assert.equal(sanitizeForFilename(`  ${long}  `).length, 100);
});

test('formatTimestamp pads single digits', () => {
  const date = new Date(2026, 0, 5, 9, 3);
  assert.equal(formatTimestamp(date), '2026-01-05 09-03');
});

test('buildTranscriptFilename combines sanitized title and timestamp', () => {
  const date = new Date(2026, 8, 12, 14, 30);
  assert.equal(
    buildTranscriptFilename('Weekly Sync', date),
    'Transcript – Weekly Sync – 2026-09-12 14-30.txt'
  );
});
