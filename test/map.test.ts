import { createMap, MapType, ConvMap, RawMap, u32type, MapFlags, MapDef, createMapRef, openMap } from '../lib'
import { asUint32Array } from '../lib/util'
import { concat, sortKeys, conditionalTest, kernelAtLeast, isRoot } from './util'

describe('RawMap tests', () => {

    it('map creation', () => {
        expect(() => createMap({
            type: 0,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })).toThrowError('EINVAL')

        expect(() => createMap({
            type: MapType.HASH,
            keySize: -1,
            valueSize: 4,
            maxEntries: 5,
        })).toThrow('-1 is not a valid u32')

        expect(() => createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: -1,
            maxEntries: 5,
        })).toThrow('-1 is not a valid u32')

        expect(() => createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: -1,
        })).toThrow('-1 is not a valid u32')

        expect(createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
            numaNode: 0,
        }).flags).toBe(MapFlags.NUMA_NODE)

        const ref = createMap({
            name: "testMap",
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        expect(ref.flags).toBe(0)
        const map = new RawMap(ref)

        expect(map.ref).toBe(ref)
        ref.fd // should not throw
        ref.close() // should not throw
        expect(() => ref.fd).toThrowError('FD was closed')
        expect(() => map.get(Buffer.alloc(4))).toThrowError('FD was closed')
        ref.close() // should not throw
    })

    it('throws for invalid length buffers', () => {
        const ref = createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new RawMap(ref)

        expect(() => map.set(Buffer.alloc(5), Buffer.alloc(4))).toThrow()
        expect(() => map.set(Buffer.alloc(4), Buffer.alloc(5))).toThrow()
        map.set(Buffer.alloc(4), Buffer.alloc(4)) // should not throw

        expect(() => map.get(Buffer.alloc(5))).toThrow()
        map.get(Buffer.alloc(4)) // should not throw

        expect(() => map.get(Buffer.alloc(4), 0, Buffer.alloc(5))).toThrow()
        const out = Buffer.alloc(4)
        expect(map.get(Buffer.alloc(4), 0, out)).toBe(out)
    })

    conditionalTest(kernelAtLeast('4.13'), 'createMapRef', () => {
        const ref = createMap({
            type: MapType.ARRAY,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        expect(ref.id).not.toBeUndefined()

        const ref2 = createMapRef(ref.fd)
        expect(ref2.fd).not.toBe(ref.fd)
        expect(ref2.id).toBe(ref.id!)

        ref.close()
        ref2.close()
    })

    conditionalTest(kernelAtLeast('4.13') && isRoot, 'openMap', () => {
        const ref = createMap({
            type: MapType.ARRAY,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        expect(ref.id).not.toBeUndefined()
        
        const ref2 = openMap(ref.id!)
        expect(ref2.id).toBe(ref.id!)

        ref.close()
        ref2.close()
    })

    conditionalTest(kernelAtLeast('4.12'), 'map-in-map support', () => {
        const innerMap: MapDef = {
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 7,
        }
        const ref = createMap({
            type: MapType.ARRAY_OF_MAPS,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
            innerMap,
        })
        const map = new ConvMap(ref, u32type, u32type)

        expect(map.get(3)).toBeUndefined()
        expect([...map]).toStrictEqual([])

        const map3 = new ConvMap(createMap(innerMap), u32type, u32type)
        map.set(3, map3.ref.fd)
        expect([...map]).toStrictEqual([ [3, map3.ref.id!] ])

        // Test that we fall back to MapDesc if we can't get FD
        const ref2 = createMap(innerMap)
        createMap({
            type: MapType.ARRAY_OF_MAPS,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
            innerMap: ref2,
        }) // should not throw
        ref2.close()
        createMap({
            type: MapType.ARRAY_OF_MAPS,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
            innerMap: ref2,
        }) // should not throw
    })

    conditionalTest(kernelAtLeast('5.6'), 'getBatch should not share buffers', () => {
        const ref = createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const rawMap = new RawMap(ref)
        const map = new ConvMap(ref, u32type, u32type)
        map.set(0, 4).set(2, 8).set(3, 7).set(1, 10)
        const entries = concat(...rawMap.getBatch(3)).map(e => e.map(x => asUint32Array(x)[0])) as [number, number][]
        expect(sortKeys(entries)).toStrictEqual([ [0, 4], [1, 10], [2, 8], [3, 7] ])
    })

})

describe('ConvMap tests', () => {

    it('basic HASH operations', () => {
        const ref = createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new ConvMap(ref, u32type, u32type)

        // EINVAL if kernel doesn't have the operation, ENOTSUPP if it does
        //expect(() => map.getDelete(2)).toThrow()
        //FIXME: above op was implemented in 5.14.x

        expect(sortKeys(map)).toStrictEqual([])
        expect(map.get(2)).toBeUndefined()
        expect(map.delete(2)).toBe(false)
        
        map.set(2, 5)
        expect(sortKeys(map)).toStrictEqual([ [2, 5] ])
        expect(map.get(2)).toStrictEqual(5)
        
        map.set(0, 4)
        expect(sortKeys(map)).toStrictEqual([ [0, 4], [2, 5] ])
        expect(map.get(2)).toStrictEqual(5)
        expect(map.get(0)).toStrictEqual(4)

        expect([0, 2].includes(map.keys(7).next().value!)).toBeTruthy()
        expect(map.has(0)).toBe(true)
        expect(map.has(7)).toBe(false)
        
        map.set(2, 7)
        expect(sortKeys(map)).toStrictEqual([ [0, 4], [2, 7] ])
        expect(map.get(2)).toStrictEqual(7)
        expect(map.get(0)).toStrictEqual(4)
        
        expect(map.delete(2)).toBe(true)
        expect(sortKeys(map)).toStrictEqual([ [0, 4] ])
        expect(map.get(2)).toBeUndefined()
        expect(map.get(0)).toStrictEqual(4)

        map.ref.close()
    })

    // FIXME: test update flags

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

        expect(sortKeys(map.entries(100))).toStrictEqual([ [0, 4], [2, 8], [3, 7] ])
        expect([...map.keys(100)].sort()).toStrictEqual([ 0, 2, 3 ])
        expect([...map.values(100)].sort()).toStrictEqual([ 4, 7, 8 ])
        const firstKey = [...map.keys()][0]
        expect([...map.keys(firstKey)].length).toBe(2)
        expect([...map.entries(firstKey)].length).toBe(2)
        
        // remember these tests will fail with older kernels
        expect(sortKeys(map)).toStrictEqual([ [0, 4], [2, 8], [3, 7] ])
        expect(sortKeys(map.entries())).toStrictEqual([ [0, 4], [2, 8], [3, 7] ])
        expect([...map.keys()].sort()).toStrictEqual([ 0, 2, 3 ])
        expect([...map.values()].sort()).toStrictEqual([ 4, 7, 8 ])

        map.clear()
        expect(sortKeys(map)).toStrictEqual([])

        map.ref.close()
    })

    conditionalTest(kernelAtLeast('5.2') && isRoot, 'freezing', () => {
        const ref = createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new ConvMap(ref, u32type, u32type)
        map.set(0, 4).set(2, 8).set(3, 7)
        map.freeze()

        expect(() => map.set(1, 5)).toThrow()
        expect(() => map.set(0, 5)).toThrow()
        expect(() => map.delete(0)).toThrow()
        expect(() => map.delete(1)).toThrow()

        expect(map.get(1)).toBeUndefined()
        expect(map.get(0)).toBe(4)
    })

    conditionalTest(kernelAtLeast('5.6'), 'batched operations', () => {
        const ref = createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new ConvMap(ref, u32type, u32type)

        expect(() => [...map.getBatch(0)]).toThrow()
        expect([...map.getBatch(2)]).toStrictEqual([])
        expect([...map.getBatch(1)]).toStrictEqual([])
        expect([...map.getBatch(5)]).toStrictEqual([])
        expect([...map.getBatch(6)]).toStrictEqual([])

        map.set(0, 4)
        map.set(2, 8)
        map.set(3, 7)

        const entries = [ [0, 4], [2, 8], [3, 7] ]
        expect(sortKeys( concat(...map.getBatch(2)) )).toStrictEqual(entries)
        // expect(sortKeys( concat(...map.getBatch(1)) )).toStrictEqual(entries) (HASH implementation sometimes throws ENOSPC)
        expect(sortKeys( concat(...map.getBatch(3)) )).toStrictEqual(entries)
        expect(sortKeys( concat(...map.getBatch(5)) )).toStrictEqual(entries)
        expect(sortKeys( concat(...map.getBatch(6)) )).toStrictEqual(entries)

        map.setBatch([])
        map.deleteBatch([ 0 ])
        expect(sortKeys([...map])).toStrictEqual([ [2, 8], [3, 7] ])

        map.setBatch([ [0, 4], [2, 100], [5, 50] ])
        expect(sortKeys([...map])).toStrictEqual([ [0, 4], [2, 100], [3, 7], [5, 50] ])

        map.deleteBatch([ 2, 3, 5 ])
        expect(sortKeys([...map])).toStrictEqual([ [0, 4] ])

        map.set(2, 8)
        map.set(3, 7)
        expect(() => map.deleteBatch([3, 7, 2])).toThrow()
        expect(sortKeys([...map])).toStrictEqual([ [0, 4], [2, 8] ])

        // FIXME: test flags with setBatch
    })

    it('ARRAY operations', () => {
        const ref = createMap({
            type: MapType.ARRAY,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new ConvMap(ref, u32type, u32type)

        // EINVAL if kernel doesn't have the operation, ENOTSUPP if it does
        expect(() => map.deleteBatch([])).toThrow()
    })

    function testQueue(type: MapType, isFIFO: boolean) {
        const ref = createMap({
            type,
            keySize: 0,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new ConvMap(ref, { parse() {}, format() {} }, u32type)

        // get is used to peek the next value
        expect(map.get()).toBeUndefined()
        // getDelete() is used to consume the next value
        expect(map.getDelete()).toBeUndefined()

        // set() is used to push a value to the queue
        map.set(undefined, 2341)
        map.set(undefined, 235)
        map.set(undefined, 84)
        expect(map.get()).toBe(isFIFO ? 2341 : 84)

        expect(map.getDelete()).toBe(isFIFO ? 2341 : 84)
        expect(map.getDelete()).toBe(isFIFO ? 235 : 235)
        expect(map.getDelete()).toBe(isFIFO ? 84 : 2341)

        expect(map.getDelete()).toBeUndefined()
    }

    conditionalTest(kernelAtLeast('4.20') && isRoot, 'QUEUE operations',
        () => testQueue(MapType.QUEUE, true))

    conditionalTest(kernelAtLeast('4.20') && isRoot, 'STACK operations',
        () => testQueue(MapType.STACK, false))

})
