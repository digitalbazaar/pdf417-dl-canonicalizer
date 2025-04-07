/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {decodeComponentIndex, encodeMandatoryIndex} from './componentIndex.js';
import {crypto} from './platform.js';

import {parser as aamvaParser} from './aamva.js';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const MANDATORY_AAMVA_FIELDS = [
  'DCA', 'DCB', 'DCD', 'DBA', 'DCS', 'DAC', 'DAD', 'DBD', 'DBB', 'DBC', 'DAY',
  'DAU', 'DAG', 'DAI', 'DAJ', 'DAK', 'DAQ', 'DCF', 'DCG', 'DDE', 'DDF', 'DDG'
].sort(_sortAsciiByPointCode);

// Note: A selector for the first 22 mandatory elements would be:
// 0b111111111111111111111100

/**
 * Canonicalizes an AAMVA DL or ID card. The DL or ID card must be expressed
 * as a Map of fields => values.
 *
 * @param {object} options - The options to use.
 * @param {Map} options.parsedData - The parsed PDF417 data.
 *
 * @returns {Uint8Array} The canonicalized PDF417 data.
 */
export function canonicalize({parsedData} = {}) {
  // FIXME: rename `parsedData` to indicate it is an AAMVA DL or ID card

  /* Note: No delimiter is required to separate keys and values because
  keys have a fixed length of 3 characters. */
  const fields = Array.from(parsedData.entries())
    .map(([key, value]) => `${key}${value}`);

  // sort the fields by unicode point order
  fields.sort(_sortAsciiByPointCode);

  const joined = `${fields.join('\n')}\n`;
  return TEXT_ENCODER.encode(joined);
}

/**
 * Canon-hashes an AAMVA DL or ID card. The DL or ID card must be expressed
 * as a Map of fields => values. This function will serialize the information
 * into a canonicalized representation in bytes and then hash those bytes using
 * SHA-2 256, returning the resulting digest in a Uint8Array.
 *
 * @param {object} options - The options to use.
 * @param {Map} options.parsedData - The parsed PDF417 data.
 *
 * @returns {Promise<Uint8Array>} The hash digest.
 */
export async function hash({parsedData} = {}) {
  // FIXME: rename `parsedData` to indicate it is an AAMVA DL or ID card
  const canonicalizedBytes = canonicalize({parsedData});
  const hashBuffer = await crypto.subtle.digest('SHA-256', canonicalizedBytes);
  const hash = new Uint8Array(hashBuffer);
  return hash;
}

/**
 * Decodes PDF417 data into an AAMVA DL or ID card. The DL or ID card will be
 * expressed as a Map of fields => values.
 *
 * @param {object} options - The options to use.
 * @param {Uint8Array|string} options.data - The data to parse.
 * @param {string} options.encoding - The encoding to use to convert "data",
 *   if it is given as a string, to a Uint8Array (only "utf8" is supported).
 *
 * @returns {Map} The AAMVA DL or ID card.
 */
export function decode({data, encoding} = {}) {
  if(typeof data === 'string') {
    if(encoding !== 'uf8') {
      throw new TypeError('"encoding" must be "utf8" if "data" is a string.');
    }
    data = TEXT_ENCODER.encode(data);
  }
  if(!(data instanceof Uint8Array)) {
    throw new TypeError('"data" must be a Uint8Array.');
  }

  const parsed = aamvaParser.parse(data);
  const {elementSeparator} = parsed;
  parsed.subfiles.forEach(subfile => {
    const data = TEXT_DECODER.decode(subfile.data);
    const parsedFields = _parseElementFields({elementSeparator, data});
    subfile.data = Object.fromEntries(parsedFields);
  });

  return parsed;
}

/**
 * Parses an AAMVA DL or ID card (expressed as a Uint8Array) into a Map
 * of fields => values.
 *
 * @param {object} options - The options to use.
 * @param {Uint8Array} options.data - The data to parse.
 * @param {object} options.selector - A selector to pick out specific fields
 *   fields from the parsed data; the selector can include one of the following:
 *
 *   "fields": An array of fields to select or the string 'mandatory' to select
 *     all mandatory fields,
 *   "componentIndex": A value that is an index into the AAMVA mandatory
 *     fields, expressed as either a 24-bit integer or as a 24-bit integer that
 *     is expressed as a string of multibase-encoded bytes using
 *     base64url-nopad encoding (i.e., prefix `u`).
 *
 * @returns {Promise<Map>} The AAMVA DL or ID card.
 */
export async function parse({data, selector}) {
  const parsed = decode({data});
  const {subfiles} = parsed;
  const dl = subfiles.find(({type}) => type === 'DL' || type === 'ID');

  if(!dl) {
    throw new Error('DL or ID subfile not detected.');
  }

  let selectedFields;
  if(selector) {
    const {fields, componentIndex} = selector;
    if(fields !== undefined) {
      if(componentIndex !== undefined) {
        throw new TypeError(
          'Only one of "selector.fields" or "selector.componentIndex" may ' +
          'be specified.');
      }
      if(fields === 'mandatory') {
        selectedFields = MANDATORY_AAMVA_FIELDS;
      } else if(Array.isArray(fields)) {
        selectedFields = fields;
      } else {
        throw new TypeError(
          '"selected.fields" must be the string "mandatory" or an array of ' +
          'fields to select.');
      }
    } else if(componentIndex !== undefined) {
      let fieldIndex;
      const type = typeof componentIndex;
      if(type === 'number') {
        fieldIndex = componentIndex;
      } else if(type === 'string') {
        fieldIndex = decodeComponentIndex(componentIndex);
      } else {
        throw new TypeError(
          '"selector.componentIndex" must be a 24-bit integer or a 24-bit ' +
          'integer expressed as a string of multibase-encoded bytes.');
      }
      // select the MANDATORY fields based on the field index
      selectedFields = MANDATORY_AAMVA_FIELDS.filter(
        (_, i) => fieldIndex & encodeMandatoryIndex(i));
    } else {
      throw new TypeError(
        'Either "selector.fields" or "selector.componentIndex" ' +
        'must be specified.');
    }
  }

  let entries = [...Object.entries(dl.data)];

  // if specified, filter entries on selected fields
  if(selectedFields) {
    selectedFields = new Set(selectedFields);
    entries = entries.filter(e => selectedFields.has(e[0]));
  }

  return new Map(entries);
}

function _parseElementFields({elementSeparator, data}) {
  const elements = data.split(elementSeparator);
  const fields = new Map();
  for(const element of elements) {
    const key = element.slice(0, 3);
    const value = element.slice(3);
    fields.set(key, value);
  }
  return fields;
}

// note: doesn't sort any unicode chars by unicode code point; only guaranteed
// to work with ASCII strings at the moment
function _sortAsciiByPointCode(a, b) {
  return a.localeCompare(b, 'en', {
    sensitivity: 'variant'
  });
}
