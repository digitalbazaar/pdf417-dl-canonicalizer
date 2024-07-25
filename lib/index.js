/*!
 * Copyright (c) 2024 Digital Bazaar, Inc. All rights reserved.
 */
import {crypto} from './platform.js';
import {decode as decodeBase64Url} from 'base64url-universal';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// input: parsed data. output: encoded canonicalized data.
export function canonicalize({parsedData}) {
  // canonicalize data once parsed (c14n here is lexicographic order)
  // FIXME: sort here is on UTF-16, not Unicode point order. raise issue.
  const dataToCanonicalize = [];
  for(const [fieldName, value] of parsedData) {
    dataToCanonicalize.push(fieldName + value + '\n');
  }
  const canonicalizedData = dataToCanonicalize.sort().join('');
  const canonicalizedBytes = encoder.encode(canonicalizedData);
  return canonicalizedBytes;
}

// input: parsed data. output: Uint8Array hash of canonicalized data.
export async function hash({parsedData}) {
  const canonicalizedBytes = canonicalize({parsedData});
  const hashBuffer = await crypto.subtle.digest('SHA-256', canonicalizedBytes);
  const hash = new Uint8Array(hashBuffer);
  return hash;
}

// input: bytes from pdf417, fields: 4 bytes, base64Url multibase encoded.
// See Verifiable Credential Barcodes specification for more info on `fields`.
// If fields not present, all mandatory fields extracted.
// If sending data anywhere, use `hash` for privacy reasons.
// result: Map from field name to field data
export async function parse({pdfBytes, fields} = {}) {
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

  // create includedFields from fields param if it exists
  let includedFields;
  if(fields != undefined) {
    includedFields = [];
    const fieldsBytes = await decodeBase64Url(fields.slice(1));
    let fieldsBinary = '';
    // remove header from multibase
    for(const byte of fieldsBytes) {
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
  } else {
  // otherwise use entire list of fields
    includedFields = fieldsAlphabetized;
  }

  const parsedData = new Map();

  // find elements corresponding to included fields
  for(const field of includedFields) {
    for(const elem of dlElements) {
      if(elem.indexOf(field) === 0) {
        parsedData.set(field, elem.slice(3));
        break;
      }
    }
  }
  return parsedData;
}
