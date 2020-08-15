import { createMap, MapType, RawArrayMap } from '../lib'
import { asBuffer, asUint32Array } from '../lib/util'

const u32 = (x: number) => asBuffer(Uint32Array.of(x))
const u32get = (x: Uint8Array) => asUint32Array(x)[0]
const sortKeys = (x: Iterable<[Buffer, Buffer]>) => [...x].sort((a, b) => u32get(a[0]) - u32get(b[0]))

describe('RawArrayMap tests', () => {
    // TODO
})
