import { createMap, ConvArrayMap, createArrayMap, u32type, MapType, RawArrayMap, MapRef } from '../lib'

describe('ConvArrayMap tests', () => {

    it('throws for invalid types', () => {
        let ref: MapRef

        ref = createMap({
            type: MapType.HASH,
            maxEntries: 5,
            keySize: 4,
            valueSize: 4,
        })
        expect(() => new RawArrayMap(ref)).toThrow()

        ref = createMap({
            type: MapType.ARRAY,
            maxEntries: 5,
            keySize: 4,
            valueSize: 4,
        })
        new RawArrayMap(ref) // shouldn't throw
    })

    it('basic functionality', () => {
        const array = createArrayMap(5, 4, u32type)

        expect([...array]).toStrictEqual([ 0, 0, 0, 0, 0 ])
        expect(array.get(3)).toBe(0)
        expect(() => array.get(5)).toThrow(RangeError)
        expect(() => array.set(5, 0)).toThrow(RangeError)
        expect(() => array.get(-1)).toThrow(RangeError)
        expect(() => array.set(-1, 0)).toThrow(RangeError)
        expect(() => array.get(0.2)).toThrow('0.2 is not a valid u32')

        array.set(0, 1)
        array.set(2, 5)
        array.set(3, 0xFFFFFFFF)
        
        expect([...array]).toStrictEqual([ 1, 0, 5, 0xFFFFFFFF, 0 ])
        expect(array.get(0)).toBe(1)
        expect(array.get(2)).toBe(5)
        expect(array.get(3)).toBe(0xFFFFFFFF)

        array.set(3, 0)
        expect([...array]).toStrictEqual([ 1, 0, 5, 0, 0 ])
    })

})
