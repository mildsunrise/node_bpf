import { createMap, MapType, RawMap } from '../lib'
import { asBuffer, asUint32Array } from '../lib/util'

const u32 = (x: number) => asBuffer(Uint32Array.of(x))
const u32get = (x: Uint8Array) => asUint32Array(x)[0]
const sortKeys = (x: Iterable<[Buffer, Buffer]>) => [...x].sort((a, b) => u32get(a[0]) - u32get(b[0]))

describe('RawMap tests', () => {

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
        const map = new RawMap(ref)

        expect(map.ref).toBe(ref)
        ref.fd // should not throw
        ref.close() // should not throw
        expect(() => ref.fd).toThrowError('FD was closed')
        expect(() => map.get(u32(0))).toThrowError('FD was closed')
        ref.close() // should not throw
    })

    it('basic HASH operations', () => {
        const ref = createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new RawMap(ref)

        // ENOTSUP on some kernels, EINVAL on others
        expect(() => map.getDelete(u32(2))).toThrow()
        
        expect(sortKeys(map)).toStrictEqual([])
        expect(map.get( u32(2) )).toBeUndefined()
        //expect(map.getDelete( u32(2) )).toBeUndefined()
        expect(map.delete( u32(2) )).toBe(false)
        
        map.set( u32(2), u32(5) )
        expect(sortKeys(map)).toStrictEqual([ [u32(2), u32(5)] ])
        expect(map.get( u32(2) )).toStrictEqual( u32(5) )
        
        map.set( u32(0), u32(4) )
        expect(sortKeys(map)).toStrictEqual([ [u32(0), u32(4)], [u32(2), u32(5)] ])
        expect(map.get( u32(2) )).toStrictEqual( u32(5) )
        expect(map.get( u32(0) )).toStrictEqual( u32(4) )
        
        map.set( u32(2), u32(7) )
        expect(sortKeys(map)).toStrictEqual([ [u32(0), u32(4)], [u32(2), u32(7)] ])
        expect(map.get( u32(2) )).toStrictEqual( u32(7) )
        expect(map.get( u32(0) )).toStrictEqual( u32(4) )
        
        expect(map.delete( u32(2) )).toBe(true)
        expect(sortKeys(map)).toStrictEqual([ [u32(0), u32(4)] ])
        expect(map.get( u32(2) )).toBeUndefined()
        expect(map.get( u32(0) )).toStrictEqual( u32(4) )

        //expect(map.getDelete( u32(0) )).toStrictEqual( u32(4) )
        //expect(sortKeys(map)).toStrictEqual([])
        //expect(map.get( u32(0) )).toBeUndefined()
        //expect(map.delete( u32(0) )).toBe(false)

        map.ref.close()
    })

    it('iteration', () => {
        const ref = createMap({
            type: MapType.HASH,
            keySize: 4,
            valueSize: 4,
            maxEntries: 5,
        })
        const map = new RawMap(ref)

        map.set( u32(0), u32(4) )
        map.set( u32(2), u32(8) )
        map.set( u32(3), u32(7) )
        
        expect(sortKeys(map)).toStrictEqual([ [u32(0), u32(4)], [u32(2), u32(8)], [u32(3), u32(7)] ])
        expect(sortKeys(map.entries())).toStrictEqual([ [u32(0), u32(4)], [u32(2), u32(8)], [u32(3), u32(7)] ])
        expect([...map.keys()].sort()).toStrictEqual([ u32(0), u32(2), u32(3) ])
        expect([...map.values()].sort()).toStrictEqual([ u32(4), u32(7), u32(8) ])

        //expect(sortKeys(map.consumeEntries())).toStrictEqual([ [u32(0), u32(4)], [u32(2), u32(8)], [u32(3), u32(7)] ])
        map.clear()
        expect(sortKeys(map)).toStrictEqual([])

        map.ref.close()
    })

    // FIXME: move getDelete / consumeEntries to a test with STACK

})
