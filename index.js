/**
 * With 2 bits for the sign and reciprocal bit, 30 bits remain to store the
 * actual number. We could divide this into 523776 chunks of length 2050.
 * 523776 is the 1023rd triangle number, and also fits into 30^2-1 with
 * modulo 1023. Doing this means we can get denominators and numerators of
 * at most 2050 though. So this "balanced" approach may not be best.
 *
 * We could divide this into 37128 chunks of length 28920 too. This is more
 * imbalanced, but allows numbers as large as 28920/1 and as small as
 * 1/28920. The trade-off is that the other part can only go up to 271, so
 * for big numbers you lose a bunch of precision when you pass a multiple of
 * this number, and for small numbers the denominators get restricted a bit
 * too much.
 *
 * This has only 63 left over which is a nicer number which doesn't let the
 * n/1 rows get too imbalanced at the end, which is another plus.
 */

/**
 * Calculates the greatest common divisor of two positive numbers. To be
 *  maximally efficient, `a` should be greater than `b`, but this is not
 *  required for the algorithm to work.
 * @param {number} a - 1st number
 * @param {number} b - 2nd number
 * @returns {number} greatest common divisor between `a` and `b`.
 */
function gcd (a, b) {
  while (true) {
    if (b === 0) return a
    a %= b
    if (a === 0) return b
    b %= a
  }
}

function triangle (n) {
  return n * (n + 1) / 2
}

function triangleInverse (n) {
  return (Math.sqrt(8 * n + 1) - 1) / 2
}

function getFormat (bits, chunkSize) {
  const max = 2 ** (bits - 2) - 1
  const softCap = triangle(Math.floor(triangleInverse((max - 1) / chunkSize)))
  return {
    bits,
    max,
    chunkSize,
    softCap
  }
}

function getReciprocal (format, reciprocal = true) {
  return reciprocal ? 1 << format.bits - 2 : 0
}

function getSign (format, sign) {
  return (sign === -1 || Object.is(sign, -0)) ? 1 << format.bits - 1 : 0
}

/**
 * Returns an error value for this format.
 * @param {object} format - the number format
 * @param {number} sign - the sign, from the set {-1, -0, 0, 1}
 * @returns {number} the computed error value
 */
function getNaN (format, sign = 1) {
  return getReciprocal(format) | getSign(format, sign)
}

function getZero (format, sign) {
  return format.max | getSign(format, sign)
}

function getInf (format, sign) {
  return format.max | getReciprocal(format) | getSign(format, sign)
}

function encodeNumber (format, num, denom) {
  const sign = Math.sign(num * denom)
  num = Math.abs(num)
  denom = Math.abs(denom)

  // Special cases we can take shortcuts for
  if (sign === 0 || isNaN(sign) || num === Infinity || denom === Infinity) {
    // -NaN is NaN by invalid input
    if (isNaN(sign)) return getNaN(format, -1)
    if (num === 0 && denom === 0) return getNaN(format, -1)
    if (num === Infinity && denom === Infinity) return getNaN(format, -1)

    // Infinity
    if (num === Infinity) return getInf(format, sign)
    if (denom === 0) return getInf(format, sign)

    // Zero
    if (num === 0) return getZero(format, sign)
    if (denom === Infinity) return getZero(format, sign)
  }

  // Swap numbers around if they're in the wrong order
  const reciprocal = getReciprocal(format, num < denom)
  if (reciprocal) {
    const temp = num
    num = denom
    denom = temp
  }

  // Ensure the fraction is irreducible
  const div = gcd(num, denom)
  num /= div
  denom /= div

  const overflowCount = Math.floor((num / denom - 1) / format.chunkSize)
  const chunkOffset = denom * (overflowCount + 1)
  const absoluteOffset = triangle(chunkOffset - 1)

  const numTrunc = num - format.chunkSize * overflowCount
  const numOffset = numTrunc - denom
  const numSpaced = numOffset * (overflowCount + 1)

  // Handle overflows
  if (absoluteOffset >= format.softCap) {
    // +NaN is NaN by incalculable output
    if (denom > 1) return getNaN(format)
    if (denom === 1) {
      const offsetRemaining = absoluteOffset - format.softCap
      const mainDataEnd = format.softCap * format.chunkSize
      if (mainDataEnd + offsetRemaining * format.chunkSize + numOffset >= format.max) return getNaN(format)
      return mainDataEnd + offsetRemaining * format.chunkSize + numOffset | getSign(format, sign) | reciprocal
    }
  } else {
    return (absoluteOffset * format.chunkSize) + numSpaced | getSign(format, sign) | reciprocal
  }
}
