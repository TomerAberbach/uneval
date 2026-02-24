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

### Customization

`uneval` accepts a `custom` callback for unevaling values.

<!-- eslint-disable consistent-return, security/detect-eval-with-expression, no-eval -->

```js
import assert from 'node:assert'
import uneval from '@tomer/uneval'

class Person {
  constructor(name) {
    this.name = name
  }
}

const people = {
  tomer: new Person(`Tomer`),
  amanda: new Person(`Amanda`),
}

const source = uneval(people, {
  custom: (value, uneval) => {
    if (value instanceof Person) {
      return `new Person(${uneval(value.name)})`
    }
  },
})
console.log(source)
//=> {tomer:new Person("Tomer"),amanda:new Person("Amanda")}

const roundtrippedPeople = (0, eval)(`(${source})`)
assert.deepEqual(roundtrippedPeople, people)
```

Return the following types depending on the desired behavior:

- `string` to provide custom source for the input value
- `null` to omit the input value from the output (e.g. in arrays, objects, Sets,
  Maps). Omitting the root value throws an `Error`.
- `undefined` (or don't return anything, which is equivalent) to use the default
  behavior for the input value

The callback can be used to uneval already supported values differently or to
uneval unsupported values such as functions. It also receives a second `uneval`
param, which is the same `uneval` function the options were passed to. You can
use it to delegate back to `uneval` for sub-values.

> [!NOTE]
>
> `custom` is only called for each _logical_ value. It is not called for
> sub-values that are incidentally unevaled as part of unevaling a value.
>
> Some examples:
>
> - `custom` is called for each element of an `Array` because an `Array` is a
>   container and its elements are its logical sub-values.
> - `custom` is called for each `Date` value, but _not_ for a `Date` value's
>   underlying numerical timestamp because the `Date` itself is the logical
>   value while `new Date(numericalTimestamp)` is just one way a `Date` could be
>   unevaled. Other ways are possible, which means the numerical timestamp in
>   the source is just an implementation detail, not a logical sub-value.
> - `custom` is called for each `ArrayBuffer` value even when it's nested within
>   a `TypedArray` or Node `Buffer` because the underlying `ArrayBuffer` is the
>   logical sub-value backing these parent values. The fact that it can be
>   shared between `TypedArray` and/or Node `Buffer` instances is proof of this.
>
> This principle is a bit hand-wavy, but we use our best judgement. If you find
> a scenario where `custom` doesn't work the way you expect, then
> [create an issue](https://github.com/TomerAberbach/uneval/issues/new).

## Contributing

Stars are always welcome!

For bugs and feature requests,
[please create an issue](https://github.com/TomerAberbach/uneval/issues/new).

## License

[MIT](https://github.com/TomerAberbach/uneval/blob/main/license) ©
[Tomer Aberbach](https://github.com/TomerAberbach)
