/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {BinaryParser} from './BinaryParser.js';

export const parser = new BinaryParser()
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
