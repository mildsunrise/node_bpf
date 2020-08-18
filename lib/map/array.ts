import { native, asUint8Array, checkU32, sliceBuffer } from '../util'
import { checkStatus } from '../exception'
import { MapRef, TypeConversion, TypeConversionWrap, createMap, fixCount, checkAllProcessed } from './common'
import { MapType } from '../enums'
const { ENOENT } = native

/**
 * Specialized version of [[IMap]] for `ARRAY` maps.
 * 
 * [[RawArrayMap]] returns array values directly as `Buffer` with no
 * conversion, and [[ConvArrayMap]] performs the conversion specified
 * at construction time.
 * 
 * Keep in mind that `ARRAY` maps aren't atomic at all.
 * 
 * The [[getAll]] method is specific to this interface and fetches all
 * values of the array in one syscall.
 */
export interface IArrayMap<V> {
	/** Size of the array in items */
	readonly length: number


	// Base operations

	/**
	 * Fetch the value at a certain index. Throws on invalid
	 * indexes.
	 * 
	 * @param key Array index
	 * @param flags Operation flags (since Linux 5.1), see [[MapLookupFlags]]
	 */
	get(key: number, flags?: number): V

	/**
	 * Set the value at a certain index. Throws on invalid
	 * indexes.
	 * 
	 * @param key Array index
	 * @param value Nwe value
	 * @param flags Operation flags (since Linux 3.19), see [[MapUpdateFlags]]
	 */
	set(key: number, value: V, flags?: number): this


	// Batched operations

	/**
	 * Iterate through the array values.
	 * 
	 * This works like [[values]] but the iteration is performed
	 * in the kernel, returning many items at once. The
	 * interator yields each batch produced by the kernel, until
	 * an error is found or there are no more entries.
	 * 
	 * `batchSize` specifies the requested size, but batches may
	 * be smaller. If the kernel returns a partial batch together
	 * with an error, the partial batch will be yielded before
	 * throwing the error. If the map is empty, nothing is yielded.
	 * 
	 * @param batchSize Amount of entries to request per batch,
	 * must be non-zero
	 * @param flags Operation flags, see [[MapLookupFlags]]
	 */
	getBatch(batchSize: number, flags?: number): IterableIterator<V[]>

	/**
	 * Sets a batch of array indexes to some values. Throws if
	 * any of the indexes is invalid.
	 * 
	 * Note that if an error is thrown, part of the entries
	 * could already have been processed. The thrown error
	 * includes a `count` field that, if not undefined,
	 * corresponds to the amount of processed entries.
	 * 
	 * @param entries Array entries to set (indexes are not
	 * necessarily unique or sorted).
	 * @param flags Operation flags, see [[MapUpdateFlags]]
	 */
	setBatch(entries: [number, V][], flags?: number): this


	// Other operations

	/**
	 * Freezes the map, making it non-modifiable from userspace.
	 * The map stays writeable from BPF side.
	 */
	freeze(): void


	// Convenience functions

	/**
	 * Fetches all values of the array using [[getBatch]].
	 */
	getAll(): V[]

	/**
	 * Sets all values of the array using [[setBatch]].
	 * 
	 * Note that if an error is thrown, part of the entries
	 * could already have been processed. The thrown error
	 * includes a `count` field that, if not undefined,
	 * corresponds to the amount of processed entries.
	 * 
	 * @params values New array values (must contain exactly `length`
	 * items)
	 */
	setAll(values: V[]): this

	/**
	 * Iterates through the values of the array.
	 */
	values(): IterableIterator<V>

	/**
	 * Convenience function. Alias of [[values]].
	 */
	[Symbol.iterator](): IterableIterator<V>
}

/**
 * Raw version of the [[IArrayMap]] interface where values
 * are returned directly as `Buffer`s.
 */
export class RawArrayMap implements IArrayMap<Buffer> {
	readonly ref: MapRef
	/** Buffer containing all indexes concatenated, to speed up [[getAll]] and [[setAll]] */
	private _allIndexes: Uint8Array

	/**
	 * Construct a new instance operating on the given map.
	 * 
	 * The map must be of `ARRAY` type.
	 * 
	 * @param ref Reference to the map. If you pass a
	 * custom [[MapRef]], make sure the information is
	 * correct. Failure to do so can result in **buffer
	 * overflows**.
	 */
	constructor(ref: MapRef) {
		if (ref.type !== MapType.ARRAY)
			throw new Error(`Expected array map, got type ${MapType[ref.type] || ref.type}`)
		this.ref = ref
		this.length = checkU32(ref.maxEntries)

		this._allIndexes = asUint8Array(new Uint32Array(this.length).map((_, i) => i))
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
	private _checkIndex(x: number) {
		checkU32(x)
		if (x >= this.length)
			throw new RangeError(`Invalid index ${x} for array of length ${this.length}`)
		return x
	}

	readonly length: number


	// Base operations

	get(key: number, flags: number = 0, out?: Buffer): Buffer  {
		const keyBuf = asUint8Array(Uint32Array.of(this._checkIndex(key)))
		out = this._vOrBuf(out)
		const status = native.mapLookupElem(this.ref.fd, keyBuf, out, flags)
		checkStatus('bpf_map_lookup_elem_flags', status)
		return out
	}

	set(key: number, value: Buffer, flags: number = 0): this {
		const keyBuf = asUint8Array(Uint32Array.of(this._checkIndex(key)))
		this._vBuf(value)
		const status = native.mapUpdateElem(this.ref.fd, keyBuf, value, flags)
		checkStatus('bpf_map_update_elem', status)
		return this
	}

	// FIXME: maybe try to mirror TypedArrays a bit more? i.e. set method


	// Batched operations

	*getBatch(batchSize: number, flags: number = 0): IterableIterator<Buffer[]> {
		if (checkU32(batchSize) === 0)
			throw Error('Invalid batch size')
		let idx = 0
		const keysIdx = new Uint32Array(batchSize)
		const keysOut = asUint8Array(keysIdx)
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
				const entries: Buffer[] = []
				const copySlice = (i: number, buf: Buffer, size: number) => {
					const offset = i * size
					return Buffer.from(buf.slice(offset, offset + size))
				}
				for (let i = 0; i < count; i++) {
					if (keysIdx[i] !== (idx++))
						throw Error('Non-sequential indexes')
					entries.push(copySlice(i, valuesOut, this.ref.valueSize))
				}
				yield entries
			}
			if (status === -ENOENT)
				return
			checkStatus('bpf_map_lookup_batch', status)
		}
	}

	setBatch(entries: [number, Buffer][], flags: number = 0): this {
		const keysBuf = asUint8Array(
			Uint32Array.from(entries, x => this._checkIndex(x[0])) )
		const valuesBuf = Buffer.concat(entries.map(x => x[1]))
		let [ status, count ] = native.mapUpdateBatch(this.ref.fd,
			keysBuf, valuesBuf, entries.length, { elemFlags: flags })
		count = fixCount(count, entries.length, status)
		checkStatus('bpf_map_update_batch', status, count)
		checkAllProcessed(count, entries.length)
		return this
	}


	// Other operations

	freeze(): void {
		const status = native.mapFreeze(this.ref.fd)
		checkStatus('bpf_map_freeze', status)
	}


	// Convenience functions

	getAll(): Buffer[] {
		const keysOut = Buffer.alloc(this.length * this.ref.keySize)
		const valuesOut = Buffer.alloc(this.length * this.ref.valueSize)
		const batchOut = Buffer.alloc(this.ref.keySize)
		let [ status, count ] = native.mapLookupBatch(this.ref.fd,
			undefined, batchOut, keysOut, valuesOut, this.length, {})
		if (status !== -ENOENT)
			checkStatus('bpf_map_lookup_batch', status)
		if (count !== this.length)
			throw Error(`Expected ${this.length} elements but received ${count}`)
		if (!keysOut.equals(this._allIndexes))
			throw Error('Non-sequential indexes')
		return sliceBuffer(valuesOut, count, this.ref.valueSize)
	}

	setAll(values: Buffer[]): this {
		if (values.length !== this.length)
			throw new Error(`Expected ${this.length} values, got ${values.length}`)
		const valuesBuf = Buffer.concat(values.map(x => this._vBuf(x)))
		let [ status, count ] = native.mapUpdateBatch(this.ref.fd,
			this._allIndexes, valuesBuf, this.length, {})
		count = fixCount(count, this.length, status)
		checkStatus('bpf_map_update_batch', status, count)
		checkAllProcessed(count, this.length)
		return this
	}

	*values(): IterableIterator<Buffer> {
		for (let i = 0; i < this.length; i++)
			yield this.get(i)
	}

	[Symbol.iterator]() {
		return this.values()
	}
}

/**
 * Implementation of [[IArrayMap]] that converts values
 * to 'parsed' representations using the given [[TypeConversion]].
 */
export class ConvArrayMap<V> implements IArrayMap<V> {
	private readonly map: RawArrayMap
	private readonly valueConv: TypeConversionWrap<V>

	get ref() {
		return this.map.ref
	}

	/**
	 * Construct a new instance operating on the given map.
	 * 
	 * The map must be of `ARRAY` type.
	 * 
	 * @param ref Reference to the map. If you pass a
	 * custom [[MapRef]], make sure the information is
	 * correct. Failure to do so can result in **buffer
	 * overflows**.
	 * @param valueConv Type conversion for array values
	 */
	constructor(ref: MapRef, valueConv: TypeConversion<V>) {
		this.map = new RawArrayMap(ref)
		this.valueConv = new TypeConversionWrap(valueConv, ref.valueSize)
	}

	get length() {
		return this.map.length
	}

	get(key: number, flags?: number): V {
		return this.valueConv.parse(this.map.get(key, flags))
	}

	set(key: number, value: V, flags?: number): this {
		this.map.set(key, this.valueConv.format(value), flags)
		return this
	}

	*getBatch(batchSize: number, flags?: number): IterableIterator<V[]> {
		for (const values of this.map.getBatch(batchSize, flags))
			yield values.map(v => this.valueConv.parse(v))
	}

	setBatch(entries: [number, V][], flags?: number): this {
		this.map.setBatch( entries.map(([k, v]) => [k, this.valueConv.format(v)]), flags )
		return this
	}

	freeze(): void {
		return this.map.freeze()
	}

	getAll(): V[] {
		return this.map.getAll().map(v => this.valueConv.parse(v))
	}

	setAll(values: V[]): this {
		this.map.setAll(values.map(v => this.valueConv.format(v)))
		return this
	}

	*values(): IterableIterator<V> {
		for (const v of this.map.values())
			yield this.valueConv.parse(v)
	}

	[Symbol.iterator](): IterableIterator<V> {
		return this.values()
	}
}

/**
 * Convenience function to create an `ARRAY` map using [[createMap]]
 * and construct a [[ConvArrayMap]] instance.
 * 
 * @param length Array size, in items
 * @param valueSize Size of each value, in bytes (will be
 * rounded up to a multiple of 8)
 * @param valueConv Type conversion for values
 */
export function createArrayMap<V>(
	length: number,
	valueSize: number,
	valueConv: TypeConversion<V>
): ConvArrayMap<V> {
	const ref = createMap({
		type: MapType.ARRAY,
		keySize: 4,
		maxEntries: length,
		valueSize,
	})
	return new ConvArrayMap(ref, valueConv)
}
