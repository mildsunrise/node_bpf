import { createMap, ConvArrayMap, createArrayMap, u32type, MapType, RawArrayMap, MapRef } from '../lib'
import { asUint32Array } from '../lib/util'
import { concat, conditionalTest, kernelAtLeast, isRoot } from './util'

describe('RawArrayMap tests', () => {

    it('throws for invalid types', () => {
        let ref: MapRef
        let array: ConvArrayMap<number>

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

        array = createArrayMap(7, 6, u32type)
        expect(array.length).toBe(7)
        expect(array.ref.valueSize).toBe(6)
    })

    it('throws for invalid length buffers', () => {
        const ref = createMap({
            type: MapType.ARRAY,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const array = new RawArrayMap(ref)

        expect(() => array.set(0, Buffer.alloc(5))).toThrow()
        array.set(0, Buffer.alloc(4)) // should not throw

        expect(() => array.get(0, 0, Buffer.alloc(5))).toThrow()
        const out = Buffer.alloc(4)
        expect(array.get(0, 0, out)).toBe(out)
    })

    conditionalTest(kernelAtLeast('5.6'), 'getBatch should not share buffers', () => {
        const ref = createMap({
            type: MapType.ARRAY,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const rawArray = new RawArrayMap(ref)
        const array = new ConvArrayMap(ref, u32type)
        array.set(0, 4).set(2, 8).set(3, 7).set(1, 10)
        const entries = concat(...rawArray.getBatch(2)).map(x => asUint32Array(x)[0])
        expect(entries).toStrictEqual([ 4, 10, 8, 7, 0 ])
    })

})

describe('ConvArrayMap tests', () => {

    it('basic operations', () => {
        const array = createArrayMap(5, 4, u32type)

        expect([...array]).toStrictEqual([ 0, 0, 0, 0, 0 ])
        expect(array.get(3)).toBe(0)

        // should throw for invalid indexes
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

    conditionalTest(kernelAtLeast('5.6'), 'batched operations', () => {
        const array = createArrayMap(5, 4, u32type)

        expect(() => [...array.getBatch(0)]).toThrow()
        expect(concat(...array.getBatch(2))).toStrictEqual([0,0,0,0,0])
        expect(concat(...array.getBatch(1))).toStrictEqual([0,0,0,0,0])
        expect(concat(...array.getBatch(5))).toStrictEqual([0,0,0,0,0])
        expect(concat(...array.getBatch(6))).toStrictEqual([0,0,0,0,0])

        array.set(0, 4).set(2, 8).set(3, 7)

        const entries = [ 4, 0, 8, 7, 0 ]
        expect( concat(...array.getBatch(2)) ).toStrictEqual(entries)
        expect( concat(...array.getBatch(1)) ).toStrictEqual(entries)
        expect( concat(...array.getBatch(3)) ).toStrictEqual(entries)
        expect( concat(...array.getBatch(5)) ).toStrictEqual(entries)
        expect( concat(...array.getBatch(6)) ).toStrictEqual(entries)

        array.setBatch([])
        expect([...array]).toStrictEqual(entries)

        array.setBatch([ [0, 4], [2, 100], [4, 50] ])
        expect([...array]).toStrictEqual([ 4, 0, 100, 7, 50 ])

        // should throw for invalid indexes
        expect(() => array.setBatch([ [1, 7], [-1, 5] ])).toThrow()
    })

    conditionalTest(kernelAtLeast('5.6'), 'getAll / setAll', () => {
        const array = createArrayMap(5, 4, u32type)

        expect(array.getAll()).toStrictEqual([0,0,0,0,0])

        array.set(0, 4).set(2, 8).set(3, 7)

        expect(array.getAll()).toStrictEqual([4, 0, 8, 7, 0])

        expect(() => array.setAll([])).toThrow()
        expect(() => array.setAll([1, 2, 3, 4])).toThrow()
        expect(() => array.setAll([1, 2, 3, 4, 5, 6])).toThrow()

        array.setAll([1, 2, 3, 4, 5])
        expect(array.getAll()).toStrictEqual([1, 2, 3, 4, 5])
    })

    conditionalTest(kernelAtLeast('5.2') && isRoot, 'freezing', () => {
        const map = createArrayMap(7, 4, u32type)
        map.set(0, 4).set(2, 8).set(3, 7)
        map.freeze()
        expect(() => map.set(0, 5)).toThrow()
        expect(map.get(1)).toBe(0)
        expect(map.get(0)).toBe(4)
    })

})
