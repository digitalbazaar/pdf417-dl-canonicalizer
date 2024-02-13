/*!
 * Copyright (c) 2024 Digital Bazaar, Inc. All rights reserved.
 */
import {encodeBase64Url} from './helpers.js';
const {subtle} = globalThis.crypto;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// input: bytes from PDF417. returns base64Url encoded hash of canonized bytes.
export async function base64UrlFromPdfBytes({pdfBytes} = {}) {
  const hashedBytes = await hashFromPdfBytes({pdfBytes});
  const base64Bytes = encodeBase64Url(hashedBytes);
  return base64Bytes;
}

// input: bytes from Pdf. Returns CANONIZED BYTES
// for privacy reasons, use hashCanonizedBytesFromPdfBytes
// or base64UrlFromPdf417Bytes if sending data anywhere.
export function canonizedBytesFromPdfBytes({pdfBytes} = {}) {

  const pdfDataAsString = decoder.decode(pdfBytes);

  // process PDF data
  // assumption for parsing: DL is first subfile, 'DL' string first 2
  // appearances are subfile indicator and subfile beginning
  const subfile_indicator_index = pdfDataAsString.indexOf('DL');
  const subfiles = pdfDataAsString.slice(pdfDataAsString.indexOf('DL',
    subfile_indicator_index + 1) + 2);
  const dl_subfile = subfiles.split('\r')[0];
  const dl_elements = dl_subfile.split('\n');

  // list of fields to include in canonization
  const included_fields = ['DBA', 'DBD', 'DBB', 'DBC', 'DAY', 'DAU', 'DAJ',
    'DAK', 'DCS', 'DAC', 'DAD', 'DCB', 'DAI', 'DAQ', 'DAG', 'DCG'];
  const data_to_canonicalize = [];

  // find elements corresponding to included fields
  for(const field of included_fields) {
    for(const elem of dl_elements) {
      if(elem.indexOf(field) === 0) {
        // add newline to each piece?
        data_to_canonicalize.push(elem);
        break;
      }
    }
  }

  // canonicalize data once parsed (canonization here is lexicographic order)
  const canonicalizedData = data_to_canonicalize.sort().join('');
  const canonicalizedBytes = encoder.encode(canonicalizedData);
  return canonicalizedBytes;
}

// input: bytes from PDF417. returns Uint8Array hash of canonized bytes.
export async function hashFromPdfBytes({pdfBytes} = {}) {
  const canonicalizedBytes = canonizedBytesFromPdfBytes({pdfBytes});
  const hashBuffer = await subtle.digest('SHA-256', canonicalizedBytes);
  const hashArray = new Uint8Array(hashBuffer);
  return hashArray;
}
