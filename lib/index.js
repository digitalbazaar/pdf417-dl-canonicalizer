/*!
 * Copyright (c) 2024 Digital Bazaar, Inc. All rights reserved.
 */
import {crypto} from './platform.js';
import {encodeBase64Url} from './helpers.js';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// input: bytes from PDF417. returns base64Url encoded hash of canonized bytes.
export async function base64UrlFromPdfBytes({pdfBytes} = {}) {
  const hashedBytes = await hashCanonicalized({pdfBytes});
  const base64Bytes = encodeBase64Url(hashedBytes);
  return base64Bytes;
}

// input: bytes from Pdf. Returns CANONIZED BYTES
// for privacy reasons, use hashCanonicalizeds
// or base64UrlFromPdf417Bytes if sending data anywhere.
export function canonicalize({pdfBytes} = {}) {
  const pdfDataAsString = decoder.decode(pdfBytes);

  // process PDF data
  // assumption for parsing: DL is first subfile, 'DL' string first 2
  // appearances are subfile indicator and subfile beginning
  const subfileIndicatorIndex = pdfDataAsString.indexOf('DL');
  const subfiles = pdfDataAsString.slice(
    pdfDataAsString.indexOf('DL', subfileIndicatorIndex + 1) + 2);
  const dlSubfile = subfiles.split('\r')[0];
  const dlElements = dlSubfile.split('\n');

  // list of fields to include in canonization
  // CURRENT STATE: 
  //   - no name (DCS, DAC, DAD)
  //   - no name truncations (DDE, DDF, DDG)
  //   - no class, restr, endorsements (DCA, DCB, DCD)
  //   - no discriminator, issuance date (impossible)

  const includedFields = [
    'DBA', 'DBB', 'DBC', 'DAY', 'DAU', 'DAJ',
    'DAK', 'DAI', 'DAQ', 'DAG', 'DCG'];
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
export async function hashCanonicalized({pdfBytes} = {}) {
  const canonicalizedBytes = canonicalize({pdfBytes});
  const hashBuffer = await crypto.subtle.digest('SHA-256', canonicalizedBytes);
  const hashArray = new Uint8Array(hashBuffer);
  return hashArray;
}
