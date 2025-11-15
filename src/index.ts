const srcify = (value: unknown): string => {
  switch (typeof value) {
    case `undefined`:
      return `undefined`
    case `boolean`:
      return String(value)
    case `number`:
      return Object.is(value, -0) ? `-0` : String(value)
    case `bigint`:
      return `${value}n`
    case `string`:
      return JSON.stringify(value)
    case `object`:
      return value === null ? `null` : srcifyObject(value)
    case `symbol`:
    case `function`:
      throw new Error(`Unsupported type: ${typeof value}`)
  }
}

const srcifyObject = (value: object): string => {
  const type = getType(value)
  switch (type) {
    case `Array`: {
      const array = value as unknown[]
      const itemSources: string[] = []
      for (let i = 0; i < array.length; i++) {
        itemSources.push(i in array ? srcify(array[i]) : ``)
      }
      if (!(array.length - 1 in array)) {
        // The array is sparse and has a trailing empty slot. This requires an
        // extra comma because otherwise the last comma is interpreted as a
        // no-op trailing comma.
        itemSources.push(``)
      }
      return `[${itemSources.join(`,`)}]`
    }
    case `Boolean`:
    case `Date`:
    case `Number`:
    case `String`:
      return `new ${type}(${srcify(value.valueOf())})`
    case `URL`:
      return `new URL(${srcify((value as URL).href)})`
    case `RegExp`: {
      const { source, flags } = value as RegExp
      return `new RegExp(${srcify(source)}${flags && `,${srcify(flags)}`})`
    }
    case `ArrayBuffer`:
      return `${srcify(new Uint8Array(value as ArrayBuffer))}.buffer`
    case `Buffer`:
      return `Buffer.from(${srcify([...(value as Iterable<unknown>)])})`
    case `Map`:
    case `Set`:
    case `URLSearchParams`:
    case `Int8Array`:
    case `Uint8Array`:
    case `Uint8ClampedArray`:
    case `Int16Array`:
    case `Uint16Array`:
    case `Int32Array`:
    case `Uint32Array`:
    case `Float32Array`:
    case `Float64Array`:
    case `BigInt64Array`:
    case `BigUint64Array`:
      return `new ${type}(${srcify([...(value as Iterable<unknown>)])})`
    default:
      return srcifyObjectLike(value)
  }
}

const srcifyObjectLike = (value: object): string => {
  let __proto__: { value: unknown } | undefined
  let source = `{${Object.entries(value)
    .filter(([key, value]) => {
      if (key === `__proto__`) {
        __proto__ = { value }
        return false
      } else {
        return true
      }
    })
    .map(
      ([key, value]) =>
        `${
          IDENTIFIER_REG_EXP.test(key) ? key : JSON.stringify(key)
        }:${srcify(value)}`,
    )
    .join(`,`)}}`
  if (__proto__) {
    source = `Object.defineProperty(${source},"__proto__",{value:${srcify(
      __proto__.value,
    )},writable:true,enumerable:true,configurable:true})`
  }

  const prototype = Object.getPrototypeOf(value) as unknown
  if (
    typeof prototype !== `object` ||
    prototype === null ||
    getType(prototype) !== `Object`
  ) {
    source = `Object.setPrototypeOf(${source},${srcify(prototype)})`
  }

  return source
}

const IDENTIFIER_REG_EXP = /^\p{ID_Start}\p{ID_Continue}+$/u

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const getType = (value: object): string => value.constructor?.name ?? `Object`

export default srcify
