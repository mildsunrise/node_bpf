import { createMap, MapType, ConvMap, u32type } from '../lib'

const sortKeys = (x: Iterable<[number, number]>) => [...x].sort((a, b) => a[0] - b[0])

describe('ConvMap tests', () => {

    it('map creation', () => {
        expect(() => createMap({
            type: 0,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })).toThrowError('EINVAL')

        const ref = createMap({
            name: "testMap",
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new ConvMap(ref, u32type, u32type)

        expect(map.ref).toBe(ref)
        ref.fd // should not throw
        ref.close() // should not throw
        expect(() => ref.fd).toThrowError('FD was closed')
        expect(() => map.get(0)).toThrowError('FD was closed')
        ref.close() // should not throw
    })

    it('basic HASH operations', () => {
        const ref = createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new ConvMap(ref, u32type, u32type)

        // ENOTSUP on some kernels, EINVAL on others
        expect(() => map.getDelete(2)).toThrow()
        
        expect(sortKeys(map)).toStrictEqual([])
        expect(map.get(2)).toBeUndefined()
        //expect(map.getDelete(2)).toBeUndefined()
        expect(map.delete(2)).toBe(false)
        
        map.set(2, 5)
        expect(sortKeys(map)).toStrictEqual([ [2, 5] ])
        expect(map.get(2)).toStrictEqual(5)
        
        map.set(0, 4)
        expect(sortKeys(map)).toStrictEqual([ [0, 4], [2, 5] ])
        expect(map.get(2)).toStrictEqual(5)
        expect(map.get(0)).toStrictEqual(4)
        
        map.set(2, 7)
        expect(sortKeys(map)).toStrictEqual([ [0, 4], [2, 7] ])
        expect(map.get(2)).toStrictEqual(7)
        expect(map.get(0)).toStrictEqual(4)
        
        expect(map.delete(2)).toBe(true)
        expect(sortKeys(map)).toStrictEqual([ [0, 4] ])
        expect(map.get(2)).toBeUndefined()
        expect(map.get(0)).toStrictEqual(4)

        //expect(map.getDelete(0)).toStrictEqual(4)
        //expect(sortKeys(map)).toStrictEqual([])
        //expect(map.get(0)).toBeUndefined()
        //expect(map.delete(0)).toBe(false)

        map.ref.close()
    })

    it('iteration', () => {
        const ref = createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new ConvMap(ref, u32type, u32type)

        map.set(0, 4)
        map.set(2, 8)
        map.set(3, 7)
        
        expect(sortKeys(map)).toStrictEqual([ [0, 4], [2, 8], [3, 7] ])
        expect(sortKeys(map.entries())).toStrictEqual([ [0, 4], [2, 8], [3, 7] ])
        expect([...map.keys()].sort()).toStrictEqual([ 0, 2, 3 ])
        expect([...map.values()].sort()).toStrictEqual([ 4, 7, 8 ])

        //expect(sortKeys(map.consumeEntries())).toStrictEqual([ [0, 4], [2, 8], [3, 7] ])
        map.clear()
        expect(sortKeys(map)).toStrictEqual([])

        map.ref.close()
    })

    // FIXME: move getDelete / consumeEntries to a test with STACK

})
