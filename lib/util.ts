export type FD = number

export const native = require('../build/Release/bpf_binding.node')

// TypedArray conversion utilities

type TypedArray =
    Int8Array | Int16Array | Int32Array | BigInt64Array |
    Uint8Array | Uint16Array | Uint32Array | BigUint64Array |
    Float32Array | Float64Array

export const getBuffer = (x: TypedArray) =>
    x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength)

export const asBuffer = (x: TypedArray) => new Buffer(getBuffer(x))

export const asInt8Array = (x: TypedArray) => new Int8Array(getBuffer(x))
export const asInt16Array = (x: TypedArray) => new Int16Array(getBuffer(x))
export const asInt32Array = (x: TypedArray) => new Int32Array(getBuffer(x))
export const asBigInt64Array = (x: TypedArray) => new BigInt64Array(getBuffer(x))
export const asUint8Array = (x: TypedArray) => new Uint8Array(getBuffer(x))
export const asUint16Array = (x: TypedArray) => new Uint16Array(getBuffer(x))
export const asUint32Array = (x: TypedArray) => new Uint32Array(getBuffer(x))
export const asBigUint64Array = (x: TypedArray) => new BigUint64Array(getBuffer(x))
export const asFloat32Array = (x: TypedArray) => new Float32Array(getBuffer(x))
export const asFloat64Array = (x: TypedArray) => new Float64Array(getBuffer(x))

// Other

export function sliceBuffer(x: Buffer, count: number, size: number) {
    const ret = []
    for (let i = 0; i < count; i++)
        ret.push(x.subarray(i * size, (i + 1) * size))
    return ret
}
