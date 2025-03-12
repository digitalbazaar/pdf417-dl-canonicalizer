/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {decodeComponentIndex, encodeMandatoryIndex} from './component-index.js';
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
 * Select the first 22 mandatory elements.
 */
const defaultSelector = 0b111111111111111111111100;

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

export function decode({pdfBytes}) {
  const parsed = parser.parse(pdfBytes);
  const {elementSeparator} = parsed;
  parsed.subfiles.forEach(subfile => {
    const data = decoder.decode(subfile.data);
    const parsedFields = parseElementFields({
      elementSeparator, data
    });

    subfile.data = Object.fromEntries(parsedFields);
  });

  return parsed;
}

export async function parse({pdfBytes, fields}) {
  const parsed = decode({pdfBytes});
  const {subfiles} = parsed;
  const dl = subfiles.find(({type}) => type === 'DL');

  const fieldIndex = fields ? decodeComponentIndex(fields) : defaultSelector;

  const selectedMandatoryFields = mandatoryAamvaFields.filter(
    (_, i) => fieldIndex & encodeMandatoryIndex(i)
  );

  // Select the MANDATORY fields based on the field index
  // return the selected fields from the map
  const selectedFieldsMap = new Map();
  for(const [key, value] of Object.entries(dl.data)) {
    if(selectedMandatoryFields.includes(key)) {
      selectedFieldsMap.set(key, value);
    }
  }

  return selectedFieldsMap;
}
