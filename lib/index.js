/*!
 * Copyright (c) 2024 Digital Bazaar, Inc. All rights reserved.
 */
import {decodeBase64Url, encodeBase64Url} from './helpers.js';
import {crypto} from './platform.js';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// input: bytes from PDF417. returns base64Url encoded hash of canonized bytes.
export async function base64UrlFromPdfBytes({pdfBytes, fields} = {}) {
  const hashedBytes = await hashCanonicalized({pdfBytes, fields});
  const base64Bytes = encodeBase64Url(hashedBytes);
  return base64Bytes;
}

// input: bytes from Pdf, fields. fields: 3 bytes, base64Url encoded.
// Returns CANONIZED BYTES
// for privacy reasons, use hashCanonicalizeds
// or base64UrlFromPdf417Bytes if sending data anywhere.
export async function canonicalize({pdfBytes, fields} = {}) {
  const pdfDataAsString = decoder.decode(pdfBytes);

  // process PDF data
  // assumption for parsing: DL is first subfile, 'DL' string first 2
  // appearances are subfile indicator and subfile beginning
  const subfileIndicatorIndex = pdfDataAsString.indexOf('DL');
  const subfiles = pdfDataAsString.slice(
    pdfDataAsString.indexOf('DL', subfileIndicatorIndex + 1) + 2);
  const dlSubfile = subfiles.split('\r')[0];
  const dlElements = dlSubfile.split('\n');

  const fieldsAlphabetized = [
    'DAC', 'DAD', 'DAG', 'DAI', 'DAJ', 'DAK', 'DAQ', 'DAU', 'DAY',
    'DBA', 'DBB', 'DBC', 'DBD', 'DCA', 'DCB', 'DCD', 'DCF', 'DCG',
    'DCS', 'DDE', 'DDF', 'DDG'];

  // create includedFields from fields param
  const fieldsBytes = await decodeBase64Url(fields);
  let fieldsBinary = '';
  const includedFields = [];
  // remove header from multibase
  for(const byte of fieldsBytes.slice(1)) {
    for(let i = 0; i < 8; i++) {
      const byteTrimmed = byte >>> (7 - i);
      fieldsBinary = fieldsBinary + (byteTrimmed % 2).toString();
    }
  }
  for(let i = 0; i < fieldsBinary.length; i++) {
    if(fieldsBinary[i] == '1' && i < 22) {
      includedFields.push(fieldsAlphabetized[i]);
    }
  }

  const dataToCanonicalize = [];

  // find elements corresponding to included fields
  for(const field of includedFields) {
    for(const elem of dlElements) {
      if(elem.indexOf(field) === 0) {
        const result = elem.concat('\n');
        dataToCanonicalize.push(result);
        break;
      }
    }
  }

  // canonicalize data once parsed (canonization here is lexicographic order)
  // FIXME: sort here is on UTF-16, not Unicode point order. raise issue.
  const canonicalizedData = dataToCanonicalize.sort().join('');
  const canonicalizedBytes = encoder.encode(canonicalizedData);
  return canonicalizedBytes;
}

// input: bytes from PDF417. returns Uint8Array hash of canonized bytes.
export async function hashCanonicalized({pdfBytes, fields} = {}) {
  const canonicalizedBytes = await canonicalize({pdfBytes, fields});
  const hashBuffer = await crypto.subtle.digest('SHA-256', canonicalizedBytes);
  const hashArray = new Uint8Array(hashBuffer);
  return hashArray;
}
