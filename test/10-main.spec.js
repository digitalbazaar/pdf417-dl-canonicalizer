/*!
 * Copyright (c) 2024 Digital Bazaar, Inc. All rights reserved.
 */
import {
  canonicalize,
  hash,
  parse
} from '../lib/index.js';
import {crypto} from '../lib/platform.js';

const encoder = new TextEncoder();
const pdf417StringPre = '@\n';
const recSep = String.fromCharCode(30);
const pdf417StringPost = '\rANSI 000000090002DL00410267ZZ03080162DLDAQ0' +
'0000000\nDCSDOE\nDDEN\nDACJOHN\nDDFN\nDADNONE\nDDGN\nDCANONE\nDCBNONE\nDCDN' +
'ONE\nDBD01012024\nDBB01011950\nDBA01012029\nDBC1\nDAU072 IN\nDAYBLK\nDAG' +
'123 EXAMPLE ST\nDAIGOTHAM\nDAJNY\nDAK123450000  \nDCFTESTDOCDISCRIM\nDCG' +
'USA\nDAW160\nDCK1234567890\nDDAN\nDDB01012000\rZZZZANRecFIyZjocrir2Zuzp3K' +
'DOYh30ohkVkVqJzq+Ns2kjfm2KLbDesFNsrPqIpsRueu8rb6V0tcYjyDs5jETx95EgJeCjG' +
'mRZLzJ0WNeYcQwEDO/UuMXUwR1lFMxNic2Hx9+Z5NLNMxjt4wsk6pBEXO1Ul0T/4LFEKzRM' +
'31Vf+z0l5x077DZwtb3V88Nwq26xaDDZZW1xAi0I99limW7fZqZ0DQFvcEeiCqTq0EvNieX' +
'XU/sYB\r';

const pdf417String = pdf417StringPre.concat(recSep, pdf417StringPost);
const pdfBytes = encoder.encode(pdf417String);

const orderedFields =
      'DAG123 EXAMPLE ST\n' + 'DAIGOTHAM\n' + 'DAJNY\n' +
      'DAK123450000  \n' + 'DAQ00000000\n' + 'DAU072 IN\n' +
      'DAYBLK\n' + 'DBA01012029\n' + 'DBB01011950\n' +
      'DBC1\n' + 'DCGUSA\n';
const fields = 'uP_BA';
const orderedFieldsComplete =
      'DACJOHN\n' + 'DADNONE\n' + 'DAG123 EXAMPLE ST\n' +
      'DAIGOTHAM\n' + 'DAJNY\n' + 'DAK123450000  \n' + 'DAQ00000000\n' +
      'DAU072 IN\n' + 'DAYBLK\n' + 'DBA01012029\n' +
      'DBB01011950\n' + 'DBC1\n' + 'DBD01012024\n' + 'DCANONE\n' +
      'DCBNONE\n' + 'DCDNONE\n' + 'DCFTESTDOCDISCRIM\n' +
      'DCGUSA\n' + 'DCSDOE\n' + 'DDEN\n' + 'DDFN\n' + 'DDGN\n';
const testBytes = encoder.encode(orderedFields);
const testBytesComplete = encoder.encode(orderedFieldsComplete);

// what to test against here for correctness?
describe('Canonicalizer Test', function() {
  it('Function calls should return correct types', async function() {
    const parsedData = await parse({pdfBytes, fields});
    const testHash = await hash({parsedData});
    const testCanonicalized = canonicalize({parsedData});

    parsedData.should.be.a('map');
    testHash.should.be.an('uint8array');
    testCanonicalized.should.be.an('uint8array');
  });
  it('Should canonize correctly', async function() {
    const parsedData = await parse({pdfBytes, fields});
    const canonizedBytes = canonicalize({parsedData});

    testBytes.should.deep.equal(canonizedBytes);
  });
  it('Should canonize + hash correctly', async function() {
    // test against different hasher here?
    const testHash = await crypto.subtle.digest('SHA-256', testBytes);
    const testArray = new Uint8Array(testHash);
    const parsedData = await parse({pdfBytes, fields});
    const canonizedHash = await hash({parsedData});

    testArray.should.deep.equal(canonizedHash);
  });
  it('Should canonicalize correctly without fields param',
    async function() {
      const testHash = await crypto.subtle.digest('SHA-256', testBytesComplete);
      const testArray = new Uint8Array(testHash);
      const parsedData = await parse({pdfBytes});
      const canonizedHash = await hash({parsedData});

      testArray.should.deep.equal(canonizedHash);
    });
});
