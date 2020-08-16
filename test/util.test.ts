import { checkU32, asUint32Array, asUint16Array } from "../lib/util"

describe('utilities', () => {

    it('checkU32', () => {
        expect(checkU32(0)).toBe(0)
        expect(checkU32(5)).toBe(5)
        expect(checkU32(0xFFFFFFFF)).toBe(0xFFFFFFFF)
        expect(() => checkU32(-1)).toThrow('-1 is not a valid u32')
        expect(() => checkU32(5.1)).toThrow('5.1 is not a valid u32')
        expect(() => checkU32(NaN)).toThrow('NaN is not a valid u32')
        expect(() => checkU32(0x100000000)).toThrow('4294967296 is not a valid u32')
    })

    it('as<X>Array', () => {
        const buf = Buffer.allocUnsafe(9)
        const arr1 = asUint16Array(buf)
        expect(arr1.length).toBe(4)
        arr1.set([1,1,2,2])
        const arr2 = asUint32Array(arr1)
        expect(arr2.length).toBe(2)
        expect(Array.from(arr2)).toStrictEqual([ 0x00010001, 0x00020002 ])
        arr2[0] = 0x00030003
        expect(Array.from(arr1)).toStrictEqual([ 3,3,2,2 ])
        buf.fill(1)
        expect(Array.from(arr2)).toStrictEqual([ 0x01010101, 0x01010101 ])
    })

})
