import { constants } from 'os'
import { native } from '../util'
import { checkStatus } from '../exception'
import { MapRef, TypeConversion, TypeConversionWrap, fixCount, checkAllProcessed, MapDefOptional, createMap } from './common'
import { MapType } from '../constants'
const { ENOENT } = constants.errno

// FIXME: why do invalid operations on queue / stack throw EINVAL instead of ENOTSUPP?

/**
 * Specialized version of [[IMap]] for queue types, currently `QUEUE`
 * and `STACK`.
 * 
 * [[RawQueueMap]] returns queue values directly as `Buffer` with no
 * conversion, and [[ConvQueueMap]] performs the conversion specified
 * at construction time.
 */
export interface IQueueMap<V> {
    // Base operations

    /**
     * Get the next value without removing it from the queue.
     * 
     * @param flags Operation flags (since Linux 5.1), see [[MapLookupFlags]]
     * @returns Entry value, or `undefined` if the queue is empty
     * @category Operations
     */
    peek(flags?: number): V | undefined

    /**
     * Consume the next value from the queue.
     * 
     * @returns Entry value, or `undefined` if the queue is empty
     * @category Operations
     */
    pop(): V | undefined

    /**
     * Add a new value to the queue.
     * 
     * @param value Entry value
     * @param flags Operation flags, see [[MapUpdateFlags]]
     * @category Operations
     */
    push(value: V, flags?: number): this


    // Other operations

    /**
     * Freezes the map, making it non-modifiable from userspace.
     * The map stays writeable from BPF side.
     * 
     * Since Linux 5.2.
     * 
     * @category Operations
     */
    freeze(): void


    // Convenience functions

    /**
     * Convenience function. Tests if the queue is empty.
     * 
     * @category Convenience
     */
    empty(): boolean

    /**
     * Convenience function. Consumes values repeatedly until
     * the queue is empty.
     * 
     * In cases where another program is pushing things to the
     * queue concurrently, it is recommended to place a limit
     * to avoid loop starvation.
     * 
     * @param limit Maximum amount of values to consume
     * @category Convenience
     */
    consumeValues(limit?: number): IterableIterator<V>

    /**
     * Convenience function. Alias of [[consumeValues]].
     * 
     * @category Convenience
     */
    [Symbol.iterator](): IterableIterator<V>
}

const empty = Buffer.alloc(0)

/**
 * Raw version of the [[IQueueMap]] interface where values
 * are returned directly as `Buffer`s.
 */
export class RawQueueMap implements IQueueMap<Buffer> {
    readonly ref: MapRef

    /**
     * Construct a new instance operating on the given map.
     * 
     * The map must be of `QUEUE` or `STACK` type.
     *
     * @param ref Reference to the map. See [[MapRef]] if
     * you want to implement your own instances.
     */
    constructor(ref: MapRef) {
        if (ref.type !== MapType.QUEUE && ref.type !== MapType.STACK)
            throw new Error(`Expected queue or stack map, got type ${MapType[ref.type] || ref.type}`)
        if (ref.keySize !== 0)
            throw new Error(`Assertion failed: keySize must be 0`)
        this.ref = ref
    }

    private _checkBuf(size: number, x: Buffer) {
        if (x.length !== size)
            throw Error(`Passed ${x.length} byte buffer, expected ${size}`)
        return x
    }
    private _getBuf(size: number, x?: Buffer) {
        if (x === undefined)
            return Buffer.alloc(size)
        return this._checkBuf(size, x)
    }
    private _vBuf(x: Buffer) {
        return this._checkBuf(this.ref.valueSize, x)
    }
    private _vOrBuf(x?: Buffer) {
        return this._getBuf(this.ref.valueSize, x)
    }


    // Base operations

    peek(flags: number = 0, out?: Buffer): Buffer | undefined {
        out = this._vOrBuf(out)
        const status = native.mapLookupElem(this.ref.fd, empty, out, flags)
        if (status == -ENOENT)
            return undefined
        checkStatus('bpf_map_lookup_elem_flags', status)
        return out
    }

    pop(out?: Buffer): Buffer | undefined {
        out = this._vOrBuf(out)
        const status = native.mapLookupAndDeleteElem(this.ref.fd, empty, out)
        if (status == -ENOENT)
            return undefined
        checkStatus('bpf_map_lookup_and_delete_elem', status)
        return out
    }

    push(value: Buffer, flags: number = 0): this {
        this._vBuf(value)
        const status = native.mapUpdateElem(this.ref.fd, empty, value, flags)
        checkStatus('bpf_map_update_elem', status)
        return this
    }


    // Other operations

    freeze(): void {
        const status = native.mapFreeze(this.ref.fd)
        checkStatus('bpf_map_freeze', status)
    }


    // Convenience functions

    empty(): boolean {
        return this.peek() === undefined
    }

    *consumeValues(limit?: number): IterableIterator<Buffer> {
        let value: Buffer | undefined
        if (limit === undefined) {
            while ((value = this.pop()) !== undefined)
                yield value
        } else {
            for (let i = 0; i < limit && (value = this.pop()) !== undefined; i++)
                yield value
        }
    }

    [Symbol.iterator]() {
        return this.consumeValues()
    }
}

/**
 * Implementation of [[IQueueMap]] that converts values
 * to 'parsed' representations using the given [[TypeConversion]].
 */
export class ConvQueueMap<V> implements IQueueMap<V> {
    private readonly map: RawQueueMap
    private readonly valueConv: TypeConversionWrap<V>

    get ref() {
        return this.map.ref
    }

    /**
     * Construct a new instance operating on the given map.
     * 
     * The map must be of `QUEUE` or `STACK` type.
     * 
     * @param ref Reference to the map. See [[MapRef]] if
     * you want to implement your own instances.
     * @param valueConv Type conversion for values
     */
    constructor(ref: MapRef, valueConv: TypeConversion<V>) {
        this.map = new RawQueueMap(ref)
        this.valueConv = new TypeConversionWrap(valueConv, ref.valueSize)
    }

    peek(flags?: number): V | undefined {
        return this.valueConv.parseMaybe(this.map.peek(flags))
    }

    pop(): V | undefined {
        return this.valueConv.parseMaybe(this.map.pop())
    }

    push(value: V, flags?: number): this {
        this.map.push(this.valueConv.format(value), flags)
        return this
    }

    freeze(): void {
        return this.map.freeze()
    }

    empty(): boolean {
        return this.map.empty()
    }

    *consumeValues(limit?: number): IterableIterator<V> {
        for (const v of this.map.consumeValues(limit))
            yield this.valueConv.parse(v)
    }

    [Symbol.iterator](): IterableIterator<V> {
        return this.consumeValues()
    }
}

/**
 * Convenience function to create a `QUEUE` map using [[createMap]]
 * and construct a [[ConvQueueMap]] instance.
 * 
 * @param maxEntries Max entries
 * @param valueSize Size of each value, in bytes
 * @param valueConv Type conversion for values
 * @param options Other map options
 * @returns Map instance
 */
export function createQueueMap<V>(
    maxEntries: number,
    valueSize: number,
    valueConv: TypeConversion<V>,
    options?: MapDefOptional
): ConvQueueMap<V> {
    const ref = createMap({
        ...options,
        type: MapType.QUEUE,
        keySize: 0,
        maxEntries,
        valueSize,
    })
    return new ConvQueueMap(ref, valueConv)
}

/**
 * Convenience function to create a `STACK` map using [[createMap]]
 * and construct a [[ConvQueueMap]] instance.
 * 
 * @param maxEntries Max entries
 * @param valueSize Size of each value, in bytes
 * @param valueConv Type conversion for values
 * @param options Other map options
 * @returns Map instance
 */
export function createStackMap<V>(
    maxEntries: number,
    valueSize: number,
    valueConv: TypeConversion<V>,
    options?: MapDefOptional
): ConvQueueMap<V> {
    const ref = createMap({
        ...options,
        type: MapType.STACK,
        keySize: 0,
        maxEntries,
        valueSize,
    })
    return new ConvQueueMap(ref, valueConv)
}
