/*!
 * Copyright (c) 2024-2025 Digital Bazaar, Inc. All rights reserved.
 */
import {aamva} from '../lib/index.js';
import {crypto} from '../lib/platform.js';

const {
  canonicalize,
  decode,
  hash,
  parse
} = aamva;

const encoder = new TextEncoder();
const pdf417StringPre = '@\n';
const recSep = String.fromCharCode(30);
const sigData = 'NRecFIyZjocrir2Zuzp3K' +
'DOYh30ohkVkVqJzq+Ns2kjfm2KLbDesFNsrPqIpsRueu8rb6V0tcYjyDs5jETx95EgJeCjG' +
'mRZLzJ0WNeYcQwEDO/UuMXUwR1lFMxNic2Hx9+Z5NLNMxjt4wsk6pBEXO1Ul0T/4LFEKzRM' +
'31Vf+z0l5x077DZwtb3V88Nwq26xaDDZZW1xAi0I99limW7fZqZ0DQFvcEeiCqTq0EvNieX' +
'XU/sYB';
const pdf417StringPost = '\rANSI 000000090002DL00410267ZZ03080162DLDAQ0' +
'0000000\nDCSDOE\nDDEN\nDACJOHN\nDDFN\nDADNONE\nDDGN\nDCANONE\nDCBNONE\nDCDN' +
'ONE\nDBD01012024\nDBB01011950\nDBA01012029\nDBC1\nDAU072 IN\nDAYBLK\nDAG' +
'123 EXAMPLE ST\nDAIGOTHAM\nDAJNY\nDAK123450000  \nDCFTESTDOCDISCRIM\nDCG' +
'USA\nDAW160\nDCK1234567890\nDDAN\nDDB01012000\rZZZZA' + sigData + '\r';

const pdf417String = pdf417StringPre.concat(recSep, pdf417StringPost);
const data = encoder.encode(pdf417String);

const orderedFields =
  'DAG123 EXAMPLE ST\n' + 'DAIGOTHAM\n' + 'DAJNY\n' +
  'DAK123450000  \n' + 'DAQ00000000\n' + 'DAU072 IN\n' +
  'DAYBLK\n' + 'DBA01012029\n' + 'DBB01011950\n' +
  'DBC1\n' + 'DCGUSA\n';
const selector = {componentIndex: 'uP_BA'};
const orderedFieldsMandatory =
  'DACJOHN\n' + 'DADNONE\n' + 'DAG123 EXAMPLE ST\n' +
  'DAIGOTHAM\n' + 'DAJNY\n' + 'DAK123450000  \n' + 'DAQ00000000\n' +
  'DAU072 IN\n' + 'DAYBLK\n' + 'DBA01012029\n' +
  'DBB01011950\n' + 'DBC1\n' + 'DBD01012024\n' + 'DCANONE\n' +
  'DCBNONE\n' + 'DCDNONE\n' + 'DCFTESTDOCDISCRIM\n' +
  'DCGUSA\n' + 'DCSDOE\n' + 'DDEN\n' + 'DDFN\n' + 'DDGN\n';
const testBytes = encoder.encode(orderedFields);
const testBytesMandatory = encoder.encode(orderedFieldsMandatory);
const orderedFieldsComplete =
  'DACJOHN\n' + 'DADNONE\n' + 'DAG123 EXAMPLE ST\n' +
  'DAIGOTHAM\n' + 'DAJNY\n' + 'DAK123450000  \n' + 'DAQ00000000\n' +
  'DAU072 IN\n' + 'DAW160\n' + 'DAYBLK\n' + 'DBA01012029\n' +
  'DBB01011950\n' + 'DBC1\n' + 'DBD01012024\n' + 'DCANONE\n' +
  'DCBNONE\n' + 'DCDNONE\n' + 'DCFTESTDOCDISCRIM\n' +
  'DCGUSA\n' + 'DCK1234567890\n' +
  'DCSDOE\n' + 'DDAN\n' + 'DDB01012000\n' + 'DDEN\n' + 'DDFN\n' + 'DDGN\n';
const testBytesComplete = encoder.encode(orderedFieldsComplete);

// what to test against here for correctness?
describe('AAMVA API', function() {
  it('function calls should return correct types', async function() {
    const document = await parse({data, selector});
    const testHash = await hash({document});
    const testCanonicalized = canonicalize({document});

    document.should.be.a('map');
    testHash.should.be.an('uint8array');
    testCanonicalized.should.be.an('uint8array');
  });
  it('should canonicalize correctly', async function() {
    const document = await parse({data, selector});
    const canonizedBytes = canonicalize({document});

    testBytes.should.deep.equal(canonizedBytes);
  });
  it('should canonicalize + hash correctly', async function() {
    // test against different hasher here?
    const testHash = await _sha256(testBytes);
    const document = await parse({data, selector});
    const canonizedHash = await hash({document});

    testHash.should.deep.equal(canonizedHash);
  });
  it('should canonicalize correctly with mandatory selector param',
    async function() {
      const testHash = await _sha256(testBytesMandatory);
      const document = await parse({data, selector: {fields: 'mandatory'}});
      const canonizedHash = await hash({document});

      testHash.should.deep.equal(canonizedHash);
    });
  it('should canonicalize everything with no selector param',
    async function() {
      const testHash = await _sha256(testBytesComplete);
      const document = await parse({data});
      const canonizedHash = await hash({document});

      testHash.should.deep.equal(canonizedHash);
    });
  it('should decode raw bytes', async function() {
    const result = await decode({data});

    // Expect the optional fields too
    const expectedDlData = {
      DAW: '160',
      DCK: '1234567890',
      DDA: 'N',
      DDB: '01012000'
    };

    const fields = orderedFieldsMandatory.split('\n');
    for(const field of fields) {
      const key = field.slice(0, 3);
      const value = field.slice(3);
      if(key) {
        expectedDlData[key] = value;
      }
    }

    result.should.deep.equal({
      compliance: '@',
      aamvaVersionNumber: '09',
      elementSeparator: '\n',
      fileType: 'ANSI ',
      issuerIdentificationNumber: '000000',
      jurisdictionVersionNumber: '00',
      numberOfEntries: 2,
      recordSeparator: '\u001e',
      segmentTerminator: '\r',
      entries: [
        {
          type: 'DL',
          offset: 41,
          length: 267
        },
        {
          type: 'ZZ',
          offset: 308,
          length: 162
        }
      ],
      subfiles: [
        {
          type: 'DL',
          data: expectedDlData
        },
        {
          type: 'ZZ',
          data: {
            ZZA: sigData
          }
        }
      ]
    });
  });
  it('should handle ID parsing', async function() {
    const raw = pdf417String.replace(/DL/g, 'ID');
    const data = encoder.encode(raw);
    const result = await decode({data});

    // Expect the optional fields too
    const expectedDlData = {
      DAW: '160',
      DCK: '1234567890',
      DDA: 'N',
      DDB: '01012000'
    };

    const fields = orderedFieldsMandatory.split('\n');
    for(const field of fields) {
      const key = field.slice(0, 3);
      const value = field.slice(3);
      if(key) {
        expectedDlData[key] = value;
      }
    }

    result.should.deep.equal({
      compliance: '@',
      aamvaVersionNumber: '09',
      elementSeparator: '\n',
      fileType: 'ANSI ',
      issuerIdentificationNumber: '000000',
      jurisdictionVersionNumber: '00',
      numberOfEntries: 2,
      recordSeparator: '\u001e',
      segmentTerminator: '\r',
      entries: [
        {
          type: 'ID',
          offset: 41,
          length: 267
        },
        {
          type: 'ZZ',
          offset: 308,
          length: 162
        }
      ],
      subfiles: [
        {
          type: 'ID',
          data: expectedDlData
        },
        {
          type: 'ZZ',
          data: {
            ZZA: sigData
          }
        }
      ]
    });
  });
  it('should parse ID data', async function() {
    const raw = pdf417String.replace(/DL/g, 'ID');
    const data = encoder.encode(raw);

    const testHash = await _sha256(testBytes);
    const document = await parse({data, selector});
    const canonizedHash = await hash({document});

    testHash.should.deep.equal(canonizedHash);
  });
});

async function _sha256(data) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}
