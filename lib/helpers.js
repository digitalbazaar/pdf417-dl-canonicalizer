/*!
 * Copyright (c) 2024 Digital Bazaar, Inc. All rights reserved.
 */
import {decode, encode} from 'base64url-universal';
// encode Uint8Array in base64url
export async function encodeBase64Url(inputBytes) {
  return encode(inputBytes);
}

// decode base64url in base64url
export async function decodeBase64Url(inputBase64) {
  return decode(inputBase64);
}
