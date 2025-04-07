/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {decodeComponentIndex, encodeMandatoryIndex} from './componentIndex.js';
import {crypto} from './platform.js';

import {parser as pdf417Parser} from './pdf417.js';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const MANDATORY_AAMVA_FIELDS = [
  'DCA', 'DCB', 'DCD', 'DBA', 'DCS', 'DAC', 'DAD', 'DBD', 'DBB', 'DBC', 'DAY',
  'DAU', 'DAG', 'DAI', 'DAJ', 'DAK', 'DAQ', 'DCF', 'DCG', 'DDE', 'DDF', 'DDG'
].sort(_sortAsciiByPointCode);

/**
 * Select the first 22 mandatory elements.
 */
const DEFAULT_SELECTOR = 0b111111111111111111111100;

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

  const parsed = pdf417Parser.parse(data);
  // console.log(otherParser, otherParser.subfiles);
  // const parsed = parser.parse(pdfBytes);
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
 * @param {Array} options.fields - The fields to include in the parsed data.
 *
 * @returns {Promise<Function>} The type table loader.
 */
export async function parse({data, fields}) {
  const parsed = decode({data});
  const {subfiles} = parsed;
  const dl = subfiles.find(({type}) => type === 'DL' || type === 'ID');

  if(!dl) {
    throw new Error('DL or ID subfile not detected.');
  }

  // FIXME: change fields to a "selector" and allow it to be empty
  const fieldIndex = fields ? decodeComponentIndex(fields) : DEFAULT_SELECTOR;

  const selectedMandatoryFields = MANDATORY_AAMVA_FIELDS.filter(
    (_, i) => fieldIndex & encodeMandatoryIndex(i));

  // select the MANDATORY fields based on the field index
  // return the selected fields from the map
  const selectedFieldsMap = new Map();
  for(const [key, value] of Object.entries(dl.data)) {
    if(selectedMandatoryFields.includes(key)) {
      selectedFieldsMap.set(key, value);
    }
  }

  return selectedFieldsMap;
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
