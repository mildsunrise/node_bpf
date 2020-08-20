import { native, checkU32 } from '../util'
import { checkStatus } from '../exception'
import { MapRef, TypeConversion, TypeConversionWrap, fixCount, checkAllProcessed } from './common'
const { ENOENT } = native

/**
 * Generic interface to manipulate an eBPF map of any type. API-compatible
 * with JavaScript `Map`.
 * 
 * In an eBPF map, keys and values are binary strings of a fixed length,
 * defined at map creation (see [[MapDesc]]). [[RawMap]] returns these
 * directly as `Buffer` with no conversion, and [[ConvMap]] performs
 * the conversion specified at construction time.
 * 
 * ### Operation semantics
 * 
 * The exact semantics of the operations (whether they're atomic or not,
 * supported flags, etc.) depend on the chosen map type.
 * 
 * If your kernel doesn't implement a map operation, it will generally
 * throw `EINVAL`. If it's implemented, but the map type doesn't
 * have it, it will generally throw `ENOTSUPP`.
 * 
 * ### Convenience methods
 * 
 * Some methods, such as [[clear]], are implemented using one or more
 * map operations. These are marked as convenience methods in their
 * documentation.
 * 
 * Notably, **iterating methods** such as [[entries]], [[consumeEntries]],
 * [[values]] and also [[clear]] are all convenience methods, implemented
 * using a combination of [[keys]] and another operation.
 * 
 * ### Batched operations
 * 
 * These are special map operations that process many entries.
 * [[setBatch]] and [[deleteBatch]] are mostly equivalent to a
 * repeated [[set]] or [[delete]] on each of the entries.
 * [[getBatch]] iterates through the entries of the map
 * and is mostly equivalent to [[entries]].
 * 
 * The difference is that all this is performed in the kernel
 * through a single syscall, so they perform better than normal
 * operations or iterating methods (especially when syscall overhead
 * is a problem).
 * 
 * However they're much more recent and, like other operations,
 * may not be available on your map type or kernel version.
 */
export interface IMap<K, V> {
    // Base operations

    /**
     * Fetch the value for a single key.
     * 
     * @param key Entry key
     * @param flags Operation flags (since Linux 5.1), see [[MapLookupFlags]]
     * @returns Entry value, or `undefined` if no such entry exists
     * @category Operations
     */
    get(key: K, flags?: number): V | undefined

    /**
     * Atomically deletes an entry and returns its former value,
     * or `undefined` if no entry was found. This operation is
     * generally implemented only for stack / queue types.
     * 
     * Since Linux 4.20. Most map types probably won't implement
     * this operation.
     * 
     * @param key Entry key
     * @category Operations
     */
    getDelete(key: K): V | undefined

    /**
     * Add or override a single map entry.
     * 
     * @param key Entry key
     * @param value Entry value
     * @param flags Operation flags (since Linux 3.19), see [[MapUpdateFlags]]
     * @category Operations
     */
    set(key: K, value: V, flags?: number): this

    /**
     * Delete a single map entry.
     * 
     * Returns `true` if an entry was found
     * and deleted, `false` otherwise.
     * 
     * @param key Entry key
     * @category Operations
     */
    delete(key: K): boolean


    // Batched operations

    /**
     * Iterate through the map entries.
     * 
     * This works like [[entries]] but the iteration is performed
     * in the kernel, returning many items at once. The
     * interator yields each batch produced by the kernel, until
     * an error is found or there are no more entries.
     * 
     * `batchSize` specifies the requested size, but batches may
     * be smaller. If the kernel returns a partial batch together
     * with an error, the partial batch will be yielded before
     * throwing the error. If the map is empty, nothing is yielded.
     * 
     * Since Linux 5.6.
     * 
     * @param batchSize Amount of entries to request per batch,
     * must be non-zero
     * @param flags Operation flags, see [[MapLookupFlags]]
     * @category Batched operations
     */
    getBatch(batchSize: number, flags?: number): IterableIterator<[K, V][]>

    /**
     * TODO: implement this
     * 
     * Since Linux 5.6. Map types may implement this operation
     * without implementing [[getDelete]], or viceversa.
     * 
     * @param key Entry keys
     * @category Batched operations
     */
    // getDeleteBatch(keys: K[]): (V | undefined)[]

    /**
     * Perform [[set]] operation on the passed entries.
     * 
     * Since Linux 5.6.
     * 
     * Note that if an error is thrown, part of the entries
     * could already have been processed. The thrown error
     * includes a `count` field that, if not undefined,
     * corresponds to the amount of processed entries.
     * 
     * @param entries Entries to set
     * @param flags Operation flags, see [[MapUpdateFlags]]
     * @category Batched operations
     */
    setBatch(entries: [K, V][], flags?: number): this

    /**
     * Perform [[delete]] operation on the passed entries.
     * 
     * Since Linux 5.6.
     * 
     * Unlike in [[delete]], an entry isn't found,
     * `ENOENT` will be thrown and no more entries will
     * be processed.
     * 
     * Note that if an error is thrown, part of the entries
     * could already have been processed. The thrown error
     * includes a `count` field that, if not undefined,
     * corresponds to the amount of processed entries.
     * 
     * @param keys Entry keys to delete
     * @category Batched operations
     */
    deleteBatch(keys: K[]): void


    // Other operations

    /**
     * Non-atomically iterates through the map's keys, starting
     * by the key immediately following the passed one. If no
     * key isn't passed or it doesn't exist, iteration starts by
     * the first key in the map.
     * 
     * **Note:** Not passing a key is only supported
     * on kernels 4.12 and above.
     * 
     * Because this calls `BPF_MAP_GET_NEXT_KEY` repeatedly,
     * if the map's keys are deleted while it's being iterated
     * (by this or another program), iteration could restart to
     * the beginning. However, this method fetches the next key
     * *before* yielding the current one, making it safe to delete
     * the current key (and any past ones).
     * 
     * Keep in mind that the order of keys depends on the
     * type of map, and isn't necessarily guaranteed to be
     * consistent.
     * 
     * @param start Start key (if passed and found, iteration
     * will yield keys *after* this one, i.e. it's not included
     * in the result)
     * @category Operations
     */
    keys(start?: K): Generator<K, undefined>
    // (we use Generator because IterableIterator doesn't let us
    // specify return type, and it's useful to have it)

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
     * Convenience function. Tests if the map has an entry.
     * 
     * @param key Entry key
     * @category Convenience
     */
    has(key: K): boolean

    /**
     * Convenience function. Non-atomically iterates through the map's entries.
     * Gets the next key *before* yielding the current one, making it
     * suitable for deleting entries while iterating.
     * 
     * **Note:** For kernels older than 4.12, a start key must be passed.
     * See [[keys]].
     * 
     * This is a wrapper around [[keys]] and [[get]].
     * 
     * @category Convenience
     */
    entries(start?: K): IterableIterator<[K, V]>

    /**
     * Convenience function. Non-atomically iterates through the map's values.
     * 
     * **Note:** For kernels older than 4.12, a start key must be passed.
     * See [[keys]].
     * 
     * This is a wrapper around [[keys]] and [[get]].
     * 
     * @category Convenience
     */
    values(start?: K): IterableIterator<V>

    /**
     * Convenience function. Non-atomically iterates through the map's entries,
     * deleting them while iterating.
     * 
     * This is a wrapper around [[keys]] and [[getDelete]].
     * 
     * @category Convenience
     */
    consumeEntries(start?: K): IterableIterator<[K, V]>

    /**
     * Convenience function. Non-atomically iterates over the map's entries,
     * deleting them.
     * 
     * **Note:** For kernels older than 4.12, a start key must be passed.
     * See [[keys]].
     * 
     * This is a wrapper around [[keys]] and [[delete]].
     * 
     * @category Convenience
     */
    clear(start?: K): void

    /**
     * Convenience function. Alias of [[entries]].
     * 
     * @category Convenience
     */
    [Symbol.iterator](): IterableIterator<[K, V]>
}

/**
 * Raw version of the [[IMap]] interface where keys and values
 * are returned directly as `Buffer`s.
 */
export class RawMap implements IMap<Buffer, Buffer> {
    readonly ref: MapRef

    /**
     * Construct a new instance operating on the given map.
     * 
     * @param ref Reference to the map. See [[MapRef]] if
     * you want to implement your own instances.
     */
    constructor(ref: MapRef) {
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
    private _kBuf(x: Buffer) {
        return this._checkBuf(this.ref.keySize, x)
    }
    private _vBuf(x: Buffer) {
        return this._checkBuf(this.ref.valueSize, x)
    }
    private _kOrBuf(x?: Buffer) {
        return this._getBuf(this.ref.keySize, x)
    }
    private _vOrBuf(x?: Buffer) {
        return this._getBuf(this.ref.valueSize, x)
    }


    // Base operations

    get(key: Buffer, flags: number = 0, out?: Buffer): Buffer | undefined {
        this._kBuf(key)
        out = this._vOrBuf(out)
        const status = native.mapLookupElem(this.ref.fd, key, out, flags)
        if (status == -ENOENT)
            return undefined
        checkStatus('bpf_map_lookup_elem_flags', status)
        return out
    }

    getDelete(key: Buffer, out?: Buffer): Buffer | undefined {
        this._kBuf(key)
        out = this._vOrBuf(out)
        const status = native.mapLookupAndDeleteElem(this.ref.fd, key, out)
        if (status == -ENOENT)
            return undefined
        checkStatus('bpf_map_lookup_and_delete_elem', status)
        return out
    }

    set(key: Buffer, value: Buffer, flags: number = 0): this {
        this._kBuf(key)
        this._vBuf(value)
        const status = native.mapUpdateElem(this.ref.fd, key, value, flags)
        checkStatus('bpf_map_update_elem', status)
        return this
    }

    delete(key: Buffer): boolean {
        this._kBuf(key)
        const status = native.mapDeleteElem(this.ref.fd, key)
        if (status == -ENOENT)
            return false
        checkStatus('bpf_map_delete_elem', status)
        return true
    }


    // Batched operations

    *getBatch(batchSize: number, flags: number = 0): IterableIterator<[Buffer, Buffer][]> {
        if (checkU32(batchSize) === 0)
            throw Error('Invalid batch size')
        const keysOut = Buffer.alloc(batchSize * this.ref.keySize)
        const valuesOut = Buffer.alloc(batchSize * this.ref.valueSize)
        const opts = { elemFlags: flags }

        let batchIn: Buffer | undefined
        let batchOut: Buffer | undefined
        while (true) {
            if (batchOut === undefined)
                batchOut = Buffer.alloc(this.ref.keySize)
            let [ status, count ] = native.mapLookupBatch(this.ref.fd,
                batchIn, batchOut, keysOut, valuesOut, batchSize, opts)
            ; [ batchIn, batchOut ] = [ batchOut, batchIn ]

            // there's an exception for ENOENT, apparently
            // https://github.com/torvalds/linux/blob/06a4ec1d9dc652e17ee3ac2ceb6c7cf6c2b75cdd/kernel/bpf/hashtab.c#L1530
            if (status !== -ENOENT)
                count = fixCount(count, batchSize, status)

            if (count > 0) {
                const entries: [Buffer, Buffer][] = []
                const copySlice = (i: number, buf: Buffer, size: number) => {
                    const offset = i * size
                    return Buffer.from(buf.slice(offset, offset + size))
                }
                for (let i = 0; i < count; i++)
                    entries.push([ copySlice(i, keysOut, this.ref.keySize),
                        copySlice(i, valuesOut, this.ref.valueSize) ])
                yield entries
            }
            if (status === -ENOENT)
                return
            checkStatus('bpf_map_lookup_batch', status)
        }
    }

    /* getDeleteBatch(keys: Buffer[], out?: Buffer): (Buffer | undefined)[] {
        throw Error('not implemented yet') // TODO
    } */

    setBatch(entries: [Buffer, Buffer][], flags: number = 0): this {
        const keysBuf = Buffer.concat(entries.map(x => this._kBuf(x[0])))
        const valuesBuf = Buffer.concat(entries.map(x => this._vBuf(x[1])))
        let [ status, count ] = native.mapUpdateBatch(this.ref.fd,
            keysBuf, valuesBuf, entries.length, { elemFlags: flags })
        count = fixCount(count, entries.length, status)
        checkStatus('bpf_map_update_batch', status, count)
        checkAllProcessed(count, entries.length)
        return this
    }

    deleteBatch(keys: Buffer[]): void {
        keys.forEach(key => this._kBuf(key))
        const keysBuf = Buffer.concat(keys)
        let [ status, count ] = native.mapDeleteBatch(this.ref.fd,
            keysBuf, keys.length, {})
        count = fixCount(count, keys.length, status)
        checkStatus('bpf_map_delete_batch', status, count)
        checkAllProcessed(count, keys.length)
    }


    // Other operations

    *keys(start?: Buffer): Generator<Buffer, undefined> {
        let key = this.getNextKey(start)
        while (key !== undefined) {
            const next = this.getNextKey(key)
            yield key
            key = next
        }
        return undefined
    }

    getNextKey(key?: Buffer, out?: Buffer): Buffer | undefined {
        // FIXME: if no key passed, implement fallback like BCC does
        key !== undefined && this._kBuf(key)
        out = this._kOrBuf(out)
        const status = native.mapGetNextKey(this.ref.fd, key, out)
        if (status == -ENOENT)
            return undefined
        checkStatus('bpf_map_get_next_key', status)
        return out
    }

    freeze(): void {
        const status = native.mapFreeze(this.ref.fd)
        checkStatus('bpf_map_freeze', status)
    }


    // Convenience functions

    has(key: Buffer): boolean {
        return this.get(key) !== undefined
    }

    *entries(start?: Buffer): IterableIterator<[Buffer, Buffer]> {
        for (const k of this.keys(start)) {
            const v = this.get(k)
            if (v) // entry could have been deleted by now
                yield [k, v]
        }
    }

    *values(start?: Buffer): IterableIterator<Buffer> {
        for (const [, v] of this.entries(start))
            yield v
    }

    *consumeEntries(start?: Buffer): IterableIterator<[Buffer, Buffer]> {
        for (const k of this.keys(start)) {
            const v = this.getDelete(k)
            if (v) // entry could have been deleted by now
                yield [k, v]
        }
    }

    clear(start?: Buffer): void {
        for (const k of this.keys(start))
            this.delete(k)
    }

    [Symbol.iterator]() {
        return this.entries()
    }
}

/**
 * Implementation of [[IMap]] that converts keys and values
 * to 'parsed' representations using the given [[TypeConversion]].
 */
export class ConvMap<K, V> implements IMap<K, V> {
    private readonly map: RawMap
    private readonly keyConv: TypeConversionWrap<K>
    private readonly valueConv: TypeConversionWrap<V>

    get ref() {
        return this.map.ref
    }

    /**
     * Construct a new instance operating on the given map.
     * 
     * @param ref Reference to the map. See [[MapRef]] if
     * you want to implement your own instances.
     * @param keyConv Type conversion for keys
     * @param valueConv Type conversion for values
     */
    constructor(ref: MapRef, keyConv: TypeConversion<K>, valueConv: TypeConversion<V>) {
        this.map = new RawMap(ref)
        this.keyConv = new TypeConversionWrap(keyConv, ref.keySize)
        this.valueConv = new TypeConversionWrap(valueConv, ref.valueSize)
    }

    get(key: K, flags?: number): V | undefined {
        return this.valueConv.parseMaybe(
            this.map.get(this.keyConv.format(key), flags))
    }

    getDelete(key: K): V | undefined {
        return this.valueConv.parseMaybe(
            this.map.getDelete(this.keyConv.format(key)))
    }

    set(key: K, value: V, flags?: number): this {
        this.map.set(this.keyConv.format(key), this.valueConv.format(value), flags)
        return this
    }

    delete(key: K): boolean {
        return this.map.delete(this.keyConv.format(key))
    }

    *getBatch(batchSize: number, flags?: number): IterableIterator<[K, V][]> {
        for (const entries of this.map.getBatch(batchSize, flags))
            yield entries.map(
                ([k, v]) => [this.keyConv.parse(k), this.valueConv.parse(v)])
    }

    /* getDeleteBatch(keys: K[]): (V | undefined)[] {
        return this.map.getDeleteBatch(keys.map(k => this.keyConv.format(k)))
            .map(v => this.valueConv.parseMaybe(v))
    } */

    setBatch(entries: [K, V][], flags?: number): this {
        this.map.setBatch(entries.map(
            ([k, v]) => [this.keyConv.format(k), this.valueConv.format(v)]), flags)
        return this
    }

    deleteBatch(keys: K[]): void {
        return this.map.deleteBatch(keys.map(k => this.keyConv.format(k)))
    }

    *keys(start?: K): Generator<K, undefined> {
        for (const k of this.map.keys(this.keyConv.formatMaybe(start)))
            yield this.keyConv.parse(k)
        return undefined
    }

    freeze(): void {
        return this.map.freeze()
    }

    has(key: K): boolean {
        return this.map.has(this.keyConv.format(key))
    }

    *entries(start?: K): IterableIterator<[K, V]> {
        for (const [k, v] of this.map.entries(this.keyConv.formatMaybe(start)))
            yield [this.keyConv.parse(k), this.valueConv.parse(v)]
    }

    *values(start?: K): IterableIterator<V> {
        for (const v of this.map.values(this.keyConv.formatMaybe(start)))
            yield this.valueConv.parse(v)
    }

    *consumeEntries(start?: K): IterableIterator<[K, V]> {
        for (const [k, v] of this.map.consumeEntries(this.keyConv.formatMaybe(start)))
            yield [this.keyConv.parse(k), this.valueConv.parse(v)]
    }

    clear(start?: K): void {
        return this.map.clear(this.keyConv.formatMaybe(start))
    }

    [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.entries()
    }
}
