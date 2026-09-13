import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MessageType, createMessage, isMessageOfType } from '../src/lib/messaging.js';

test('createMessage builds a valid envelope for a known type', () => {
  const message = createMessage(MessageType.START_RECORDING, { streamId: 'abc' });
  assert.equal(message.type, MessageType.START_RECORDING);
  assert.deepEqual(message.payload, { streamId: 'abc' });
  assert.equal(typeof message.timestamp, 'number');
});

test('createMessage defaults payload to an empty object', () => {
  const message = createMessage(MessageType.RECORDING_STARTED);
  assert.deepEqual(message.payload, {});
});

test('createMessage throws for an unknown type', () => {
  assert.throws(() => createMessage('NOT_A_REAL_TYPE'), /Unknown message type/);
});

test('isMessageOfType matches only the given type', () => {
  const message = createMessage(MessageType.ERROR, { message: 'boom' });
  assert.equal(isMessageOfType(message, MessageType.ERROR), true);
  assert.equal(isMessageOfType(message, MessageType.START_RECORDING), false);
});

test('isMessageOfType handles null/undefined safely', () => {
  assert.equal(isMessageOfType(null, MessageType.ERROR), false);
  assert.equal(isMessageOfType(undefined, MessageType.ERROR), false);
});
