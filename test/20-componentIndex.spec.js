/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {
  decodeComponentIndex, encodeMandatoryIndex
} from '../lib/componentIndex.js';

describe('Component index functions', function() {
  describe('encodeMandatoryIndex', function() {
    it('should encode mandatory index values', async function() {
      const expectedResults = [
        [0, 0b100000000000000000000000],
        [1, 0b010000000000000000000000],
        [23, 0b1]
      ];

      for(const [index, expected] of expectedResults) {
        const encoded = encodeMandatoryIndex(index);
        encoded.should.equal(expected);
      }
    });

    describe('when given invalid input', function() {
      it('should error for out-of-bounds indices', async function() {
        const outOfBoundsIndices = [-1, 24, 100];
        for(const index of outOfBoundsIndices) {
          should.throw(() => encodeMandatoryIndex(index),
            'Index out of bounds. Must be between 0 and 23.'
          );
        }
      });
    });
  });
  describe('decodeComponentIndex', function() {
    it('should decode base64url-encoded multibase strings', async function() {
      const expectedResults = [
        ['uP_BA', 0b001111111111000001000000],
        ['u___8', 0b111111111111111111111100]
      ];

      for(const [encodedMultibase, expected] of expectedResults) {
        const decoded = decodeComponentIndex(encodedMultibase);
        decoded.should.equal(expected);
      }
    });

    describe('when given invalid input', function() {
      it('should error for invalid multibase headers', async function() {
        const invalidMultibaseHeaders = [
          'v', 'z', '0', '1', '2', '3', '4', '5'
        ];
        for(const header of invalidMultibaseHeaders) {
          const encodedMultibase = `${header}____`;
          should.throw(() => decodeComponentIndex(encodedMultibase),
            'Invalid multibase header. Expected base64url.'
          );
        }
      });

      it('should error for invalid encoded lengths', async function() {
        const invalidEncodedLengths = ['u', 'uP', 'uP_', 'uP__', 'uP___X'];
        for(const encodedMultibase of invalidEncodedLengths) {
          should.throw(() => decodeComponentIndex(encodedMultibase),
            'Encoded value must be exactly 5 characters long.'
          );
        }
      });
    });
  });
});
