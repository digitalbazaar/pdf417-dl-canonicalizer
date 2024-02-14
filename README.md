# Driver's License PDF417 Canonicalizer _(@digitalbazaar/pdf417-dl-canonicalizer)_

[![Build Status](https://img.shields.io/github/actions/workflow/status/digitalbazaar/pdf417-dl-canonicalizer/main.yaml)](https://github.com/digitalbazaar/pdf417-dl-canonicalizer/actions/workflows/main.yaml)
[![Coverage Status](https://img.shields.io/codecov/c/github/digitalbazaar/pdf417-dl-canonicalizer)](https://codecov.io/gh/digitalbazaar/pdf417-dl-canonicalizer)
[![NPM Version](https://img.shields.io/npm/v/@digitalbazaar/pdf417-dl-canonicalizer.svg)](https://npm.im/@digitalbazaar/pdf417-dl-canonicalizer)

> Drivers' License PDF417 Canonicalizer.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Status](#status)
- [Developing](#developing)
- [Commercial Support](#commercial-support)
- [License](#license)

## Background

...

## Install

- Requires Node.js 18+

To install via NPM:

```
npm install @digitalbazaar/pdf417-dl-canonicalizer
```

## Usage

To canonize a Uint8Array of bytes from a PDF417 drivers' license:
```js
canonizedBytesFromPdfBytes(pdfBytes)
```

To canonize, but return the hash of the canonized form:
```js
hashFromPdfBytes(pdfBytes)
```

To canonize, but return the base64url encoded hash of the canonized form:
```js
base64UrlFromPdfBytes(pdfBytes)
```

This package can be used with bundlers, such as [webpack][], in browser
applications.

## API

...

## Status

...

## Developing

Source is available at:
- https://github.com/digitalbazaar/pdf417-dl-canonicalizer

## Commercial Support

Commercial support for this library is available upon request from
Digital Bazaar: support@digitalbazaar.com

## License

- BSD 3-Clause © Digital Bazaar, Inc.
- See the [LICENSE](./LICENSE) file for details.

[webpack]: https://webpack.js.org
