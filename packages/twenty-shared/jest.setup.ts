// jsdom does not expose TextEncoder/TextDecoder, which @noble/hashes needs to
// encode strings. Both are standard in browsers and in Node, so this only
// patches the test environment.
import { TextDecoder, TextEncoder } from 'node:util';

Object.assign(globalThis, { TextDecoder, TextEncoder });
