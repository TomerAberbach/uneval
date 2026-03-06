/** Returns a unique valid JS identifier for the given {@link index}. */
export const generateIdentifier = (index: number): string => {
  let identifier = ``
  do {
    identifier = IDENTIFIER_CHARS[index % IDENTIFIER_CHARS.length]! + identifier
    // For smaller bundle size.
    // eslint-disable-next-line unicorn/prefer-math-trunc
    index = ~~(index / IDENTIFIER_CHARS.length) - 1
  } while (index >= 0)

  if (identifier.length > 1) {
    // Any identifiers with 2 or more characters could clash with reserved
    // keywords or global identifiers we reference. We could list all those out
    // and check them, but ending up with identifiers are more than
    // `IDENTIFIER_CHARS.length` in length is so rare in `uneval` (requires a
    // ton of shared or circular references) that it's not worth increasing the
    // bundle size for.
    identifier = `$${identifier}`
  }

  return identifier
}

let IDENTIFIER_CHARS = `abcdefghijklmnopqrstuvwxyz`
IDENTIFIER_CHARS += IDENTIFIER_CHARS.toUpperCase()
