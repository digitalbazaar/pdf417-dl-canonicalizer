/*!
 * Copyright (c) 2024 Digital Bazaar, Inc. All rights reserved.
 */
import {crypto} from './platform.js';
import {Parser} from 'binary-parser';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const asInt = val => parseInt(val, 10);
const sortByPointCode = (a, b) => a.localeCompare(b, 'en', {
  sensitivity: 'variant'
});

const mandatoryAamvaFields = [
  'DCA', 'DCB', 'DCD', 'DBA', 'DCS', 'DAC', 'DAD', 'DBD', 'DBB', 'DBC', 'DAY',
  'DAU', 'DAG', 'DAI', 'DAJ', 'DAK', 'DAQ', 'DCF', 'DCG', 'DDE', 'DDF', 'DDG'
].sort(sortByPointCode);

/**
 * Select the first 22 mandatory elements (sorted by unicode point code).
 */
const defaultSelector = 'u___8';

const parser = new Parser()
  .useContextVars()
  .string('compliance', {length: 1})
  .string('elementSeparator', {length: 1})
  .string('recordSeparator', {length: 1})
  .string('segmentTerminator', {length: 1})
  .string('fileType', {length: 5})
  .string('issuerIdentificationNumber', {length: 6})
  .string('aamvaVersionNumber', {length: 2})
  .string('jurisdictionVersionNumber', {length: 2})
  .string('numberOfEntries', {
    length: 2,
    formatter: asInt
  })
  .array('entries', {
    type: new Parser()
      .string('type', {length: 2})
      .string('offset', {
        length: 4,
        formatter: asInt
      })
      .string('length', {
        length: 4,
        formatter: asInt
      }),
    length: 'numberOfEntries'
  }).array('subfiles', {
    type: new Parser()
      .string('type', {length: 2})
      .buffer('data', {
        readUntil: function(item) {
          return item === this.$parent.segmentTerminator.codePointAt(0);
        }
      }).skip(1),
    length: 'numberOfEntries'
  });

export function canonicalize({parsedData}) {
  const fields = Array.from(parsedData.entries())
    .map(([key, value]) => `${key}${value}`);

  // sort the fields by unicode point order
  fields.sort(sortByPointCode);

  const joined = `${fields.join('\n')}\n`;
  const bytes = encoder.encode(joined);
  return bytes;
}

// input: parsed data. output: Uint8Array hash of canonicalized data.
export async function hash({parsedData}) {
  const canonicalizedBytes = canonicalize({parsedData});
  const hashBuffer = await crypto.subtle.digest('SHA-256', canonicalizedBytes);
  const hash = new Uint8Array(hashBuffer);
  return hash;
}

export function componentIndexToFieldIndex({componentIndex}) {
  const [multibaseHeader, ...encoded] = componentIndex;
  if(multibaseHeader !== 'u') {
    throw new Error(
      'Unsupported component index encoding. Expected base64url.'
    );
  }
  const bytes = Array.from(Buffer.from(encoded.join(), 'base64url'));

  const bitmap = Array.from(
    bytes, byte => byte.toString(2).padStart(8, '0')
  ).join('');

  // Last two bits MUST be 00 per vc-barcode spec.
  if(bitmap.slice(-2) !== '00') {
    throw new Error('Invalid component index encoding: last bits must be 00.');
  }

  return bitmap;
}

export function fieldIndexToComponentIndex({fieldIndex}) {
  if(fieldIndex.length % 8 !== 0) {
    throw new Error('Invalid field index: bit length must be a multiple of 8.');
  }
  const bytes = fieldIndex.match(/.{8}/g).map(byte => parseInt(byte, 2));

  // Ensure last two bits are 00
  if((bytes[bytes.length - 1] & 0b11) !== 0) {
    throw new Error('Invalid field index: last two bits must be 00.');
  }

  const encoded = Buffer.from(bytes).toString('base64url');
  return ['u', encoded].join('');
}

function parseElementFields({elementSeparator, data}) {
  const elements = data.split(elementSeparator);
  const fields = new Map();
  for(const element of elements) {
    const key = element.slice(0, 3);
    const value = element.slice(3);
    fields.set(key, value);
  }
  return fields;
}

export async function parse({pdfBytes, fields}) {
  const parsed = parser.parse(pdfBytes);
  const {subfiles, elementSeparator} = parsed;
  const dl = subfiles.find(({type}) => type === 'DL');
  const dataContent = decoder.decode(dl.data);

  // parse out the fields by elementSeparator and into a map
  const parsedFields = parseElementFields({
    elementSeparator, data: dataContent
  });
  const componentIndex = fields ?? defaultSelector;

  const fieldIndex = componentIndexToFieldIndex({componentIndex});

  const selectedMandatoryFields = mandatoryAamvaFields.filter(
    (_, i) => fieldIndex[i] === '1'
  );

  // Select the MANDATORY fields based on the field index
  // return the selected fields from the map
  const selectedFieldsMap = new Map();
  for(const [key, value] of parsedFields.entries()) {
    if(selectedMandatoryFields.includes(key)) {
      selectedFieldsMap.set(key, value);
    }
  }

  return selectedFieldsMap;
}
