export type FD = number

export const native = require('node-gyp-build')(__dirname + '/..')

export const versions: {
    /** libelf version used */
    libelf: string
    /** libbpf version used */
    libbpf: string
    /** supported BTF version */
    btf: number
    /** running kernel release */
    kernel: string
} = native.versions

/** alias of `versions.libbpf` */
export const version: string = versions.libbpf


// TypedArray conversion utilities

type TypedArray =
    Int8Array | Int16Array | Int32Array | BigInt64Array |
    Uint8Array | Uint16Array | Uint32Array | BigUint64Array |
    Float32Array | Float64Array

export const asBuffer = (x: TypedArray, length: number = x.byteLength / Buffer.BYTES_PER_ELEMENT, byteOffset: number = 0) => Buffer.from(x.buffer, x.byteOffset + byteOffset, length)

export const asInt8Array = (x: TypedArray, length: number = x.byteLength / Int8Array.BYTES_PER_ELEMENT, byteOffset: number = 0) => new Int8Array(x.buffer, x.byteOffset + byteOffset, length)
export const asInt16Array = (x: TypedArray, length: number = x.byteLength / Int16Array.BYTES_PER_ELEMENT, byteOffset: number = 0) => new Int16Array(x.buffer, x.byteOffset + byteOffset, length)
export const asInt32Array = (x: TypedArray, length: number = x.byteLength / Int32Array.BYTES_PER_ELEMENT, byteOffset: number = 0) => new Int32Array(x.buffer, x.byteOffset + byteOffset, length)
export const asBigInt64Array = (x: TypedArray, length: number = x.byteLength / BigInt64Array.BYTES_PER_ELEMENT, byteOffset: number = 0) => new BigInt64Array(x.buffer, x.byteOffset + byteOffset, length)
export const asUint8Array = (x: TypedArray, length: number = x.byteLength / Uint8Array.BYTES_PER_ELEMENT, byteOffset: number = 0) => new Uint8Array(x.buffer, x.byteOffset + byteOffset, length)
export const asUint16Array = (x: TypedArray, length: number = x.byteLength / Uint16Array.BYTES_PER_ELEMENT, byteOffset: number = 0) => new Uint16Array(x.buffer, x.byteOffset + byteOffset, length)
export const asUint32Array = (x: TypedArray, length: number = x.byteLength / Uint32Array.BYTES_PER_ELEMENT, byteOffset: number = 0) => new Uint32Array(x.buffer, x.byteOffset + byteOffset, length)
export const asBigUint64Array = (x: TypedArray, length: number = x.byteLength / BigUint64Array.BYTES_PER_ELEMENT, byteOffset: number = 0) => new BigUint64Array(x.buffer, x.byteOffset + byteOffset, length)
export const asFloat32Array = (x: TypedArray, length: number = x.byteLength / Float32Array.BYTES_PER_ELEMENT, byteOffset: number = 0) => new Float32Array(x.buffer, x.byteOffset + byteOffset, length)
export const asFloat64Array = (x: TypedArray, length: number = x.byteLength / Float64Array.BYTES_PER_ELEMENT, byteOffset: number = 0) => new Float64Array(x.buffer, x.byteOffset + byteOffset, length)

// Other

export function sliceBuffer(x: Buffer, count: number, size: number) {
    const ret = []
    for (let i = 0; i < count; i++)
        ret.push(x.subarray(i * size, (i + 1) * size))
    return ret
}

export function checkU32(x: number) {
    if (x !== (x >>> 0))
        throw new RangeError(`${x} is not a valid u32`)
    return x
}
