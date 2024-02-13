/*!
 * Copyright (c) 2024 Digital Bazaar, Inc. All rights reserved.
 */
import {
  base64UrlFromPdfBytes,
  canonizedBytesFromPdfBytes,
  hashFromPdfBytes
} from '../lib/canonize.js';

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

// what to test against here for correctness?
describe('Canonizer Test', function() {
  it('Function calls should return correct types', async function() {
    const testBytes = canonizedBytesFromPdfBytes({pdfBytes});
    const testHash = await hashFromPdfBytes({pdfBytes});
    const testBase64 = await base64UrlFromPdfBytes({pdfBytes});

    testBytes.should.be.an('uint8array');
    testHash.should.be.an('uint8array');
    testBase64.should.be.a('string');
  });
});
