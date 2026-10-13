const { Buffer } = require('buffer');

function decode(bytes, littleEndian) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Expected Uint8Array or Buffer');
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    const index = littleEndian ? bytes.length - 1 - i : i;
    value = (value << 8n) | BigInt(bytes[index]);
  }
  return value;
}

function encode(value, width, littleEndian) {
  if (typeof value !== 'bigint') throw new TypeError('Expected BigInt');
  if (!Number.isSafeInteger(width) || width < 0) throw new RangeError('Invalid buffer width');
  if (value < 0n) throw new RangeError('Expected unsigned BigInt');
  const bytes = Buffer.alloc(width);
  let remaining = value;
  for (let i = 0; i < width; i++) {
    bytes[littleEndian ? i : width - 1 - i] = Number(remaining & 255n);
    remaining >>= 8n;
  }
  if (remaining !== 0n) throw new RangeError('BigInt exceeds buffer width');
  return bytes;
}

exports.toBigIntLE = bytes => decode(bytes, true);
exports.toBigIntBE = bytes => decode(bytes, false);
exports.toBufferLE = (value, width) => encode(value, width, true);
exports.toBufferBE = (value, width) => encode(value, width, false);
