/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {decodeComponentIndex, encodeMandatoryIndex} from './componentIndex.js';
import {BinaryParser} from './BinaryParser.js';
import {crypto} from './platform.js';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const MANDATORY_FIELDS = [
  'DCA', 'DCB', 'DCD', 'DBA', 'DCS', 'DAC', 'DAD', 'DBD', 'DBB', 'DBC', 'DAY',
  'DAU', 'DAG', 'DAI', 'DAJ', 'DAK', 'DAQ', 'DCF', 'DCG', 'DDE', 'DDF', 'DDG'
].sort(_sortAsciiByPointCode);

// Note: A selector for the first 22 mandatory elements would be:
// 0b111111111111111111111100

const PARSER = new BinaryParser()
  .string('compliance', {length: 1})
  .string('elementSeparator', {length: 1})
  .string('recordSeparator', {length: 1})
  .string('segmentTerminator', {length: 1})
  .string('fileType', {length: 5})
  .string('issuerIdentificationNumber', {length: 6})
  .string('aamvaVersionNumber', {length: 2})
  .string('jurisdictionVersionNumber', {length: 2})
  .int('numberOfEntries', {length: 2})
  .array('entries', {
    parser: new BinaryParser()
      .string('type', {length: 2})
      .int('offset', {length: 4})
      .int('length', {length: 4}),
    length: 'numberOfEntries'
  })
  .array('subfiles', {
    parser: new BinaryParser()
      .string('type', {length: 2})
      .buffer('data', {
        readUntil: function(byte, context) {
          return byte === context.$parent.segmentTerminator.codePointAt(0);
        }
      }),
    length: 'numberOfEntries'
  });

/**
 * Canonicalizes an AAMVA DL or ID card. The DL or ID card must be expressed
 * as a Map of fields => values.
 *
 * @param {object} options - The options to use.
 * @param {Map} options.document - The AAMVA document.
 *
 * @returns {Uint8Array} The canonicalized data.
 */
export function canonicalize({document} = {}) {
  /* Note: No delimiter is required to separate keys and values because
  keys have a fixed length of 3 characters. */
  const fields = Array.from(document.entries())
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
 * @param {Map} options.document - The AAMVA document.
 *
 * @returns {Promise<Uint8Array>} The hash digest.
 */
export async function hash({document} = {}) {
  const canonicalizedBytes = canonicalize({document});
  const hashBuffer = await crypto.subtle.digest('SHA-256', canonicalizedBytes);
  return new Uint8Array(hashBuffer);
}

/**
 * Decodes PDF417 data into parsed AAMVA object. Any DL or ID card will be
 * expressed as an object in "subfile".
 *
 * @param {object} options - The options to use.
 * @param {Uint8Array|string} options.data - The data to parse.
 * @param {string} options.encoding - The encoding to use to convert "data",
 *   if it is given as a string, to a Uint8Array (only "utf8" is supported).
 *
 * @returns {object} The parsed AAMVA object.
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

  const decoded = PARSER.parse(data);
  const {elementSeparator} = decoded;
  decoded.subfiles.forEach(subfile => {
    const data = TEXT_DECODER.decode(subfile.data);
    const decodedFields = _decodeElementFields({elementSeparator, data});
    subfile.data = Object.fromEntries(decodedFields);
  });
  return decoded;
}

/**
 * Parses an AAMVA object (expressed as a Uint8Array) containing a DL
 * or ID card (subfile) into a Map of fields => values for the found DL or
 * ID card.
 *
 * An already parsed subfile from an AAMVA object can be passed instead of
 * Uint8Array `data` for the whole AAMVA file if desired.
 *
 * @param {object} options - The options to use.
 * @param {Uint8Array} options.data - The data to parse.
 * @param {object} options.selector - A selector to pick out specific fields
 *   from a DL or ID subfile in the parsed data; the selector can include one
 *   of the following:
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
export async function parse({data, selector} = {}) {
  selector = {
    ...selector,
    subfile: ['DL', 'ID']
  };
  const object = decode({data});
  return select({object, selector});
}

/**
 * Selects the first AAMVA DL or ID card (subfile) from a parsed AAMVA object
 * into a Map of fields => values for the found DL or ID card.
 *
 * @param {object} options - The options to use.
 * @param {object} options.object - The AAMVA object to select from.
 * @param {object} options.selector - A selector to pick out a subfile and
 *   specific fields from the parsed data; the selector must include a
 *   "subfiles" selector:
 *
 *   "subfile": An array of subfile types to choose from; first match wins:
 *     ['DL', 'ID'].
 *
 *   And can include one of the following:
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
export async function select({object, selector} = {}) {
  if(!(Array.isArray(selector?.subfile) && selector.subfile.length > 0)) {
    throw new TypeError('"selector.subfile" must be an array of length > 0.');
  }
  if(!selector.subfile.every(e => e === 'DL' || e === 'ID')) {
    throw new TypeError('Only subfiles of type "DL" or "ID" can be selected.');
  }

  // find subfile based on selector
  const {subfiles} = object;
  const subfile = subfiles?.find(({type}) => selector.subfile.includes(type));
  if(!subfile) {
    throw new Error(selector.subfile.join(' or ') + ' subfile not detected.');
  }

  let selectedFields;
  const {fields, componentIndex} = selector;
  if(fields !== undefined) {
    if(componentIndex !== undefined) {
      throw new TypeError(
        'Only one of "selector.fields" or "selector.componentIndex" may ' +
        'be specified.');
    }
    if(fields === 'mandatory') {
      selectedFields = MANDATORY_FIELDS;
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
    selectedFields = MANDATORY_FIELDS.filter(
      (_, i) => fieldIndex & encodeMandatoryIndex(i));
  }

  let entries = [...Object.entries(subfile.data)];

  // if specified, filter entries on selected fields
  if(selectedFields) {
    selectedFields = new Set(selectedFields);
    entries = entries.filter(e => selectedFields.has(e[0]));
  }

  // return parsed document
  return new Map(entries);
}

function _decodeElementFields({elementSeparator, data}) {
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
