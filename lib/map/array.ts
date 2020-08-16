import { native, asUint8Array, checkU32 } from '../util'
import { checkStatus } from '../exception'
import { MapRef, TypeConversion, TypeConversionWrap, createMap } from './common'
import { MapType } from '../enums'

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
	 * @param flags Operation flags
	 */
	get(key: number, flags?: number): V

	/**
	 * Set the value at a certain index. Throws on invalid
	 * indexes.
	 * 
	 * @param key Array index
	 * @param value Nwe value
	 * @param flags Operation flags
	 */
	set(key: number, value: V, flags?: number): this


	// Batched operations

	/**
	 * Fetches a batch of array indexes. Throws if any of the
	 * indexes is invalid.
	 *
	 * @param keys Array indexes to fetch (not necessarily unique
	 * or sorted)
	 * @returns Array values corresponding to each index of `keys`
	 */
	getBatch(keys: number[]): V[]

	/**
	 * Sets a batch of array indexes to some values. Throws if
	 * any of the indexes is invalid.
	 * 
	 * @param entries Array entries to set (indexes are not
	 * necessarily unique or sorted).
	 * 
	 * FIXME: what happens if indexes are not unique?
	 */
	setBatch(entries: [number, V][]): this


	// Other operations

	/**
	 * Freezes the map, making it non-modifiable from userspace.
	 * The map stays writeable from BPF side.
	 */
	freeze(): void


	// Convenience functions

	/**
	 * Fetches all values of the array in one go using [[getBatch]].
	 */
	getAll(): V[]

	/**
	 * Sets all values of the array in one go using [[setBatch]].
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

	getBatch(keys: number[], out?: Buffer): Buffer[] {
		keys.forEach(x => this._checkIndex(x))
		const keyBuf = asUint8Array(Uint32Array.from(keys))
		out = this._getBuf(this.ref.valueSize * keys.length, out)
		throw Error('not implemented yet') // TODO
	}

	setBatch(entries: [number, Buffer][]): this {
		const keysBuf = asUint8Array(
			Uint32Array.from(entries, x => this._checkIndex(x[0])) )
		const valuesBuf = Buffer.concat(entries.map(x => x[1]))
		throw Error('not implemented yet') // TODO
		return this
	}


	// Other operations

	freeze(): void {
		const status = native.mapFreeze(this.ref.fd)
		checkStatus('bpf_map_freeze', status)
	}


	// Convenience functions

	getAll(): Buffer[] {
		throw Error('not implemented yet') // TODO
	}

	setAll(values: Buffer[]): this {
		if (values.length !== this.length)
			throw new Error(`Expected ${this.length} values, got ${values.length}`)
		throw Error('not implemented yet') // TODO
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

	getBatch(keys: number[]): V[] {
		return this.map.getBatch(keys).map(v => this.valueConv.parse(v))
	}

	setBatch(entries: [number, V][]): this {
		this.map.setBatch( entries.map(([k, v]) => [k, this.valueConv.format(v)]) )
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
