/* eslint-disable @typescript-eslint/no-wrapper-object-types */

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

// TODO: Support circular references
const srcifyObject = (value: object): string => {
  const type = getType(value)
  switch (type) {
    // TODO: Serialize extremely sparse arrays more efficiently.
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
    case `Boolean`: {
      const primitive = (value as Boolean).valueOf()
      return `new ${type}(${primitive ? srcify(primitive) : ``})`
    }
    case `Number`: {
      const primitive = (value as Number).valueOf()
      return `new ${type}(${Object.is(primitive, 0) ? `` : srcify(primitive)})`
    }
    case `String`: {
      const primitive = (value as String).valueOf()
      return `new ${type}(${primitive ? srcify(primitive) : ``})`
    }
    case `Date`:
      return `new Date(${srcify(value.valueOf())})`
    case `URL`:
      return `new URL(${srcify((value as URL).href)})`
    // TODO: Serialize RegExp objects as literals.
    case `RegExp`: {
      const { source, flags } = value as RegExp
      return `new RegExp(${srcify(source)}${flags && `,${srcify(flags)}`})`
    }
    case `Map`:
    case `Set`:
    case `URLSearchParams`: {
      const values = [...(value as Iterable<unknown>)]
      return `new ${type}(${values.length ? srcify(values) : ``})`
    }
    case `Int8Array`:
    case `Uint8Array`:
    case `Uint8ClampedArray`:
    case `Int16Array`:
    case `Uint16Array`:
    case `Int32Array`:
    case `Uint32Array`:
    case `Float32Array`:
    case `Float64Array`: {
      const values = [...(value as Iterable<number>)]
      return `new ${type}(${
        values.length
          ? values.every(value => Object.is(value, 0))
            ? values.length
            : srcify(values)
          : ``
      })`
    }
    case `BigInt64Array`:
    case `BigUint64Array`: {
      const values = [...(value as Iterable<bigint>)]
      return `new ${type}(${
        values.length
          ? values.every(value => value === 0n)
            ? values.length
            : srcify(values)
          : ``
      })`
    }
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

const IDENTIFIER_REG_EXP = /^\p{ID_Start}\p{ID_Continue}*$/u

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const getType = (value: object): string => value.constructor?.name ?? `Object`

export default srcify
