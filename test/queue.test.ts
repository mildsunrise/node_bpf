import { createMap, ConvQueueMap, u32type, MapType, RawQueueMap, MapRef } from '../lib'
import { conditionalTest, kernelAtLeast, isRoot } from './util'

; (kernelAtLeast('4.20') && isRoot ? describe : describe.skip)('RawQueueMap tests', () => {

    it('throws for invalid types', () => {
        let ref: MapRef

        ref = createMap({
            type: MapType.HASH,
            maxEntries: 5,
            keySize: 4,
            valueSize: 4,
        })
        expect(() => new RawQueueMap(ref)).toThrow()

        ref = createMap({
            type: MapType.QUEUE,
            maxEntries: 5,
            keySize: 0,
            valueSize: 4,
        })
        new RawQueueMap(ref) // shouldn't throw

        ref = createMap({
            type: MapType.STACK,
            maxEntries: 5,
            keySize: 0,
            valueSize: 4,
        })
        new RawQueueMap(ref) // shouldn't throw
    })

    it('throws for invalid length buffers', () => {
        const ref = createMap({
            type: MapType.QUEUE,
            keySize: 0,
            valueSize: 4,
            maxEntries: 5,
        })
        const queue = new RawQueueMap(ref)

        expect(() => queue.push(Buffer.alloc(5))).toThrow()
        queue.push(Buffer.alloc(4)) // should not throw

        expect(() => queue.peek(0, Buffer.alloc(5))).toThrow()
        const out = Buffer.alloc(4)
        expect(queue.peek(0, out)).toBe(out)

        expect(() => queue.pop(Buffer.alloc(5))).toThrow()
        expect(queue.pop(out)).toBe(out)
    })

})

; (kernelAtLeast('4.20') && isRoot ? describe : describe.skip)('ConvQueueMap tests', () => {

    it('basic operations', () => {
        const ref = createMap({
            type: MapType.QUEUE,
            keySize: 0,
            valueSize: 4,
            maxEntries: 5,
        })
        const queue = new ConvQueueMap(ref, u32type)

        expect(queue.empty()).toBe(true)
        expect(queue.peek()).toBeUndefined()
        expect(queue.pop()).toBeUndefined()

        // set() is used to push a value to the queue
        queue.push(2341)
        queue.push(235)
        queue.push(84)
        expect(queue.peek()).toBe(2341)
        expect(queue.empty()).toBe(false)

        expect(queue.pop()).toBe(2341)
        expect(queue.pop()).toBe(235)
        expect(queue.pop()).toBe(84)

        expect(queue.pop()).toBeUndefined()
        expect(queue.empty()).toBe(true)

        queue.push(2341).push(235).push(84)
        expect([...queue]).toStrictEqual([ 2341, 235, 84 ])

        queue.push(2341).push(235).push(84)
        expect([...queue.consumeValues(2)]).toStrictEqual([ 2341, 235 ])
        expect([...queue.consumeValues(2)]).toStrictEqual([ 84 ])

        queue.ref.close()
    })

    conditionalTest(kernelAtLeast('5.2') && isRoot, 'freezing', () => {
        const ref = createMap({
            type: MapType.QUEUE,
            keySize: 0,
            valueSize: 4,
            maxEntries: 5,
        })
        const queue = new ConvQueueMap(ref, u32type)
        queue.push(4).push(8).push(7)
        queue.freeze()
        expect(() => queue.push(5)).toThrow()
        expect(() => queue.pop()).toThrow()
        expect(queue.peek()).toBe(4)
    })

})
