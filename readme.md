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
  Convert a JS value to JS source code, like <code>eval</code> in reverse.
</div>

## Features

- `undefined` and `null`
- booleans
- numbers (including [`-0`](https://en.wikipedia.org/wiki/Signed_zero))
- strings and
  [`RegExp`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp)
  (including
  [unpaired surrogates](<https://en.wikipedia.org/wiki/UTF-16#U+D800_to_U+DFFF_(surrogates)>),
  [`</script>` escaping](#security-guarantees), etc.)
- Boxed primitives
- [`BigInt`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
- [Shared](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#shared_symbols_in_the_global_symbol_registry)
  and
  [well-known](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#well-known_symbols)
  [`Symbol`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
- [`Array`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)
  (including
  [sparse arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#array_methods_and_empty_slots))
- [`Object`s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)
  (including
  [`null`-prototype](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#null-prototype_objects),
  arbitrary
  [descriptors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty#description),
  etc.)
- [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
- [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
- [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)
  (including
  [invalid ones](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#the_epoch_timestamps_and_invalid_date))
- [`Temporal`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)
- [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) and
  [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams),
- [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)
  (including
  [`resizable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/resizable),
  [`detached`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/detached),
  and
  [`maxByteLength`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/maxByteLength))
- [Node `Buffer`](https://nodejs.org/api/buffer.html#class-buffer)
- [`TypedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray)
  (including `BigInt` arrays,
  [`Float16Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float16Array),
  and float arrays with
  [non-canonical NaNs](https://en.wikipedia.org/wiki/NaN#Canonical_NaN))
- Shared and circular references (for _all_ of the above types)
- [Custom types](#customization)

And more!

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

const circularObject = {}
circularObject.self = circularObject

const circularSource = uneval(circularObject)
console.log(circularSource)
//=> (a=>a.self=a)({})

const roundtrippedCircularObject = (0, eval)(`(${circularSource})`)
assert.deepEqual(roundtrippedCircularObject, circularObject)
```

### Customization

> [!WARNING]
>
> We cannot ensure our [security guarantees](#security-guarantees) when the
> `custom` option is used.

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

## Priorities

We prioritize these metrics in the following order:

1. Security (see [our guarantees](#security-guarantees))
2. Correctness (i.e. ``(0, eval)(`(${uneval(value)})`)`` roundtrips)
3. Generated source size (human-readable output is a non-goal)
4. Generated source runtime performance
5. `uneval` runtime performance
6. `uneval` bundle size

Note that we do still care about metrics lower on the list. We just care about
other metrics more.

## Security guarantees

The following are safe UNLESS [`custom`](#customization) is used:

1. Running `uneval` on untrusted input
2. Running ``(0, eval)(`(${uneval(value)})`)``
3. Embedding `uneval(value)` in JS source code, including inside an HTML
   `<script>` tag

For (3), we always escape `</script>` to avoid the following
[XSS](https://en.wikipedia.org/wiki/Cross-site_scripting) attack:

```js
const value = {
  untrustedInput: `</script><script src='https://evil.com/hacked.js'>`,
}

const html = `
  <script>
    var preloaded = ${uneval(value)};
  </script>
`
```

Without escaping, we'd end up with this (after formatting):

```html
<script>
  var preloaded = {untrustedInput:"
</script>
<!-- Oh no! We've loaded an evil script :( -->
<script src="https://evil.com/hacked.js">
  "}
</script>
```

But with escaping we get:

```html
<script>
  var preloaded = {
    untrustedInput: "<\u002fscript><script src='https://evil.com/hacked.js'>",
  }
</script>
```

## Contributing

Stars are always welcome!

For bugs and feature requests,
[please create an issue](https://github.com/TomerAberbach/uneval/issues/new).

## License

[MIT](https://github.com/TomerAberbach/uneval/blob/main/license) ©
[Tomer Aberbach](https://github.com/TomerAberbach)
