import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail } from './validation.js';

test('registration email validation matches the backend email rules', () => {
  assert.equal(isValidEmail('resident@example.org'), true);
  assert.equal(isValidEmail('a+b@sub.example.org'), true);
  assert.equal(isValidEmail('resident@example.c'), false);
  assert.equal(isValidEmail('resident@bad..example.org'), false);
  assert.equal(isValidEmail('resident@-bad.example.org'), false);
});
