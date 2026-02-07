<h1 align="center">
  uneval
</h1>

<div align="center">
  <a href="https://npmjs.org/package/@tomer/uneval">
    <img src="https://badgen.net/npm/v/@tomer/uneval" alt="version" />
  </a>
  <a href="https://github.com/TomerAberbach/uneval/actions">
    <img src="https://github.com/TomerAberbach/uneval/workflows/CI/badge.svg" alt="CI" />
  </a>
  <a href="https://unpkg.com/@tomer/uneval/dist/index.js">
    <img src="https://deno.bundlejs.com/?q=@tomer/uneval&badge" alt="gzip size" />
  </a>
  <a href="https://unpkg.com/@tomer/uneval/dist/index.js">
    <img src="https://deno.bundlejs.com/?q=@tomer/uneval&config={%22compression%22:{%22type%22:%22brotli%22}}&badge" alt="brotli size" />
  </a>
  <a href="https://github.com/sponsors/TomerAberbach">
    <img src="https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86" alt="Sponsor" />
  </a>
</div>

<div align="center">
  Convert a JS value to JS source code.
</div>

## Features

TODO

## Install

```sh
$ npm i @tomer/uneval
```

## Usage

<!-- eslint-disable security/detect-eval-with-expression, no-eval -->

```js
import assert from 'node:assert'
import uneval from '@tomer/uneval'

const object = { message: `hello world` }

const source = uneval(object)
console.log(source)
//=> {message:"hello world"}

const roundtrippedObject = (0, eval)(`(${source})`)
assert.deepEqual(roundtrippedObject, object)
```

## Contributing

Stars are always welcome!

For bugs and feature requests,
[please create an issue](https://github.com/TomerAberbach/uneval/issues/new).

## License

[MIT](https://github.com/TomerAberbach/uneval/blob/main/license) ©
[Tomer Aberbach](https://github.com/TomerAberbach)
