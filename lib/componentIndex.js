/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {decode as decodeBase64Url} from 'base64url-universal';

export function decodeComponentIndex(encodedMultibase) {
  if(encodedMultibase.length !== 5) {
    throw new Error('Encoded value must be exactly 5 characters long.');
  }

  const multibaseHeader = encodedMultibase[0];
  if(multibaseHeader !== 'u') {
    throw new Error('Invalid multibase header. Expected base64url.', {
      expected: 'u',
      actual: multibaseHeader
    });
  }

  const bytes = decodeBase64Url(encodedMultibase.slice(1));
  if(bytes.length !== 3) {
    throw new Error('Decoded value must be exactly 3 bytes (24 bits).');
  }

  // pack bytes into a 24-bit integer
  const asInt = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];

  // convert the full integer to a 24-bit binary string
  return asInt;
}

export function encodeMandatoryIndex(index) {
  if(index < 0 || index >= 24) {
    throw new Error('Index out of bounds. Must be between 0 and 23.');
  }
  return (1 << (23 - index));
}
