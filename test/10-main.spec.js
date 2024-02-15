/*!
 * Copyright (c) 2024 Digital Bazaar, Inc. All rights reserved.
 */
import {
  base64UrlFromPdfBytes,
  canonicalize,
  hashCanonicalized
} from '../lib/canonize.js';
import {crypto} from '../lib/platform.js';
import {encodeBase64Url} from '../lib/helpers.js';

const encoder = new TextEncoder();
const pdf417StringPre = '@\n';
const recSep = String.fromCharCode(30);
const pdf417StringPost = '\rANSI 000000090002DL00410267ZZ03080162DLDAQ0' +
'0000000\nDCSDOE\nDDEN\nDACJOHN\nDDFN\nDADNONE\nDDGN\nDCANONE\nDCBNONE\nDCDN' +
'ONE\nDBD01012024\nDBB01011950\nDBA01012029\nDBC1\nDAU072 IN\nDAYBLK\nDAG' +
'123 EXAMPLE ST\nDAIGOTHAM\nDAJNY\nDAK123450000  \nDCFTESTDOCDISCRIM\nDCG' +
'USA\nDAW160\nDCK1234567890\nDDAN\nDDB01012000\rZZANRecFIyZjocrir2Zuzp3K' +
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
const testBytes = encoder.encode(orderedFields);

// what to test against here for correctness?
describe('Canonizer Test', function() {
  it('Function calls should return correct types', async function() {
    const testBytes = canonicalize({pdfBytes});
    const testHash = await hashCanonicalized({pdfBytes});
    const testBase64 = await base64UrlFromPdfBytes({pdfBytes});

    testBytes.should.be.an('uint8array');
    testHash.should.be.an('uint8array');
    testBase64.should.be.a('string');
  });
  it('Should canonize correctly', async function() {
    const canonizedBytes = canonicalize({pdfBytes});

    testBytes.should.deep.equal(canonizedBytes);
  });
  it('Should canonize + hash correctly', async function() {
    // test against different hasher here?
    const testHash = await crypto.subtle.digest('SHA-256', testBytes);
    const testArray = new Uint8Array(testHash);
    const canonizedHash = await hashCanonicalized({pdfBytes});
    const hashArray = new Uint8Array(canonizedHash);

    testArray.should.deep.equal(hashArray);
  });
  it('Should canonize + hash + base64url encode correctly', async function() {
    // test against different encoder here?
    const testBytes = encoder.encode(orderedFields);
    const testHash = await crypto.subtle.digest('SHA-256', testBytes);
    const testArray = new Uint8Array(testHash);
    const testBase64Url = await encodeBase64Url(testArray);
    const canonizedBase64Url = await base64UrlFromPdfBytes({pdfBytes});

    testBase64Url.should.deep.equal(canonizedBase64Url);
  });
});
