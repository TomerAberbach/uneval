<h1 align="center">
  uneval
</h1>

<div align="center">
  <a href="https://npmjs.org/package/uneval">
    <img src="https://badgen.net/npm/v/uneval" alt="version" />
  </a>
  <a href="https://github.com/TomerAberbach/uneval/actions">
    <img src="https://github.com/TomerAberbach/uneval/workflows/CI/badge.svg" alt="CI" />
  </a>
  <a href="https://unpkg.com/uneval/dist/index.js">
    <img src="https://deno.bundlejs.com/?q=uneval&badge" alt="gzip size" />
  </a>
  <a href="https://unpkg.com/uneval/dist/index.js">
    <img src="https://deno.bundlejs.com/?q=uneval&config={%22compression%22:{%22type%22:%22brotli%22}}&badge" alt="brotli size" />
  </a>
  <a href="https://github.com/sponsors/TomerAberbach">
    <img src="https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86" alt="Sponsor" />
  </a>
</div>

<div align="center">
  🪄 Convert a JS value to JS source code, like <code>eval</code> in reverse.
</div>

<div align="center">
  <a href="#features">Features</a> •
  <a href="#priorities">Priorities</a> •
  <a href="#install">Install</a> •
  <a href="#usage">Usage</a> •
  <a href="#security-guarantees">Security guarantees</a> •
  <a href="#comparison">Comparison</a>
</div>

## Features

- Shared and circular references
- Every built-in type, including sparse arrays, `-0`, invalid `Date`s,
  `null`-prototype objects, property descriptors, `Temporal`, and `TypedArray`s
  with non-canonical NaNs
- Safe to run on untrusted input and to embed in a `<script>` tag
- Custom types via a callback
- Passes more [roundtrip tests](#comparison) than any other package compared

See the [full list of supported types](#supported-types).

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

## Install

```sh
$ npm i uneval
```

## Usage

<!-- eslint-disable security/detect-eval-with-expression, no-eval -->

```js
import assert from 'node:assert'
import uneval from 'uneval'

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

`uneval` accepts a `custom` callback for `uneval`ing values.

<!-- eslint-disable consistent-return, security/detect-eval-with-expression, no-eval -->

```js
import assert from 'node:assert'
import uneval from 'uneval'

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
> sub-values that are incidentally `uneval`ed as part of `uneval`ing a value.
>
> Some examples:
>
> - `custom` is called for each element of an `Array` because an `Array` is a
>   container and its elements are its logical sub-values.
> - `custom` is called for each `Date` value, but _not_ for a `Date` value's
>   underlying numerical timestamp because the `Date` itself is the logical
>   value while `new Date(numericalTimestamp)` is just one way a `Date` could be
>   `uneval`ed. Other ways are possible, which means the numerical timestamp in
>   the source is just an implementation detail, not a logical sub-value.
> - `custom` is called for each `ArrayBuffer` value even when it's nested within
>   a `TypedArray` or Node `Buffer` because the underlying `ArrayBuffer` is the
>   logical sub-value backing these parent values. The fact that it can be
>   shared between `TypedArray` and/or Node `Buffer` instances is proof of this.
>
> This principle is a bit hand-wavy, but we use our best judgement. If you find
> a scenario where `custom` doesn't work the way you expect, then
> [create an issue](https://github.com/TomerAberbach/uneval/issues/new).

## Supported types

- `undefined` and `null`
- `boolean`
- `number` (including [`-0`](https://en.wikipedia.org/wiki/Signed_zero))
- `string` and
  [`RegExp`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp)
  (including
  [unpaired surrogates](<https://en.wikipedia.org/wiki/UTF-16#U+D800_to_U+DFFF_(surrogates)>),
  [`</script>` escaping](#security-guarantees), etc.)
- Boxed primitives
- [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
- [Shared](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#shared_symbols_in_the_global_symbol_registry)
  and
  [well-known](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#well-known_symbols)
  [`Symbol`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
- [`Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)
  (including
  [sparse arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#array_methods_and_empty_slots))
- [`Object`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)
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
  [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
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
- [`DataView`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView)
- [`arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments)
  object (both sloppy and strict mode)
- [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)
  (including subclasses)
- Shared/circular reference (for _all_ of the above types)
- [Custom type](#customization)

## Security guarantees

These guarantees assume the attacker controls the input value, but not the
environment. `uneval` inspects values through the standard globals and prototype
methods, so replaced globals and patched prototypes are out of scope. An
attacker who can tamper with the environment already runs code in the process.

The following are safe UNLESS [`custom`](#customization) is used:

1. Running `uneval` on untrusted input.

   `uneval` returns a string and never evaluates the input, so converting an
   untrusted value runs no attacker code through `uneval` itself.

   Converting a value reads it, though, so a coercion method the input defines
   on itself runs while `uneval` inspects it (e.g. its own `valueOf`). That runs
   the input's own code, but the returned string stays safe. Treat converting
   untrusted input the way you would treat `JSON.stringify` of the same input,
   which runs the input's own `toJSON`.

2. Running ``(0, eval)(`(${uneval(value)})`)``.

   Call `eval` indirectly, as `(0, eval)(...)`, so the evaluated source runs in
   the global scope instead of the surrounding one and cannot read local
   variables. `new Function(...)` runs in the global scope for the same reason.

3. Embedding `uneval(value)` in JS source code, including inside an HTML
   `<script>` tag.

   We always escape `</script>` to avoid the following
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
       untrustedInput:
         "<\u002fscript><script src='https://evil.com/hacked.js'>",
     }
   </script>
   ```

4. Running `uneval` on a
   [pooled `Buffer`](https://nodejs.org/api/buffer.html#static-method-bufferallocunsafesize).

   `uneval`ing the underlying `ArrayBuffer` of a pooled `Buffer` and using it in
   the output source would be more correct from a roundtripping perspective, but
   wouldn't be safe because the underlying `ArrayBuffer` may contain sensitive
   data from other `Buffer`s.

   Instead, a `Buffer` is `uneval`ed with a sliced `ArrayBuffer` containing only
   the data in its view if the `ArrayBuffer`'s size matches
   [`Buffer.poolSize`](https://nodejs.org/api/buffer.html#bufferpoolsize). This
   results in false-positives for `Buffer`s containing `ArrayBuffer`s that
   coincidentally have a size of `Buffer.poolSize`.

   To force an `ArrayBuffer` to be `uneval`ed as-is, include it elsewhere in the
   input to signal that it's expected to be in the output. For example:

   ```js
   const poolSizeArrayBuffer = new ArrayBuffer(Buffer.poolSize)
   const source = uneval([
     poolSizeArrayBuffer,
     Buffer.from(poolSizeArrayBuffer, 5, 3),
   ])
   console.log(source)
   //=> (a=>[a,Buffer.from(a,5,3)])(new ArrayBuffer(8192))
   ```

## Comparison

The tables are [auto-generated](./scripts/generate-comparison-table.ts).
[`docs/comparison.md`](./docs/comparison.md) shows the result of each
[roundtrip test](./src/index.test.ts) for each package.

The table below shows the results of [`uneval`ing](./src/index.bench.ts) the
same 5,000 randomly generated values with each package. The numbers are from one
machine and vary between runs. Each row also shows how many of the roundtrip
tests the package passes, because a faster package may pass fewer of them.

<!-- prettier-ignore-start -->
<!-- BENCHMARK TABLE START -->

<!-- BENCHMARK DIGEST: 38f1294cd3aa016a23451a1346faa825060b1c5303782370b6a3c0be44cf923f -->

| Package | [Tests passing](./docs/comparison.md) | Ops/sec | Mean | Relative |
| :-- | --: | --: | --: | --: |
| <code>uneval</code> | 🟢 497/507 | 137 | 7.29ms ±0.81% | 2.06× slower |
| <a href="https://npm.im/package/seroval/v/1.6.4"><code>seroval@1⁠.⁠6⁠.⁠4</code></a>&nbsp;(sync) | 🟡 357/507 | 129 | 7.74ms ±0.58% | 2.19× slower |
| <a href="https://npm.im/package/devalue/v/5.9.2"><code>devalue@5⁠.⁠9⁠.⁠2</code></a> | 🟡 355/507 | 82.7 | 12.11ms ±0.78% | 3.43× slower |
| <a href="https://npm.im/package/javascript-stringify/v/2.1.0"><code>javascript⁠-⁠stringify@2⁠.⁠1⁠.⁠0</code></a> | 🟠 205/507 | 83.7 | 12.06ms ±2.59% | 3.39× slower |
| <a href="https://npm.im/package/serialize-javascript/v/7.1.1"><code>serialize⁠-⁠javascript@7⁠.⁠1⁠.⁠1</code></a> | 🟠 149/507 | 115 | 8.74ms ±0.84% | 2.47× slower |
| <a href="https://npm.im/package/jsesc/v/3.1.0"><code>jsesc@3⁠.⁠1⁠.⁠0</code></a> | 🟠 134/507 | 36.1 | 27.73ms ±0.90% | 7.85× slower |
| <a href="https://npm.im/package/tosource/v/2.0.0-alpha.3"><code>tosource@2⁠.⁠0⁠.⁠0⁠-⁠alpha⁠.⁠3</code></a> | 🟠 134/507 | 135 | 7.41ms ±0.99% | 2.10× slower |
| <a href="https://npm.im/package/js-stringify/v/1.0.2"><code>js⁠-⁠stringify@1⁠.⁠0⁠.⁠2</code></a> | 🔴 65/507 | 284 | 3.53ms ±0.56% | fastest |

<!-- BENCHMARK TABLE END -->
<!-- prettier-ignore-end -->

Found an inaccuracy?
[Please create an issue](https://github.com/TomerAberbach/uneval/issues/new) or
a pull request!

## Contributing

Stars are always welcome!

For bugs and feature requests,
[please create an issue](https://github.com/TomerAberbach/uneval/issues/new).

Special thanks to [Chakrit Wichian](https://chakrit.net) for donating the
package name!

## License

[MIT](https://github.com/TomerAberbach/uneval/blob/main/license) ©
