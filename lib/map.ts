import { native, FD } from './util'
import { MapType } from './enums'
import { checkStatus } from './exception'
const { ENOENT } = native

export interface MapDesc {
	type: MapType
	keySize: number
	valueSize: number
	maxEntries: number
	/** Flags specified on map creation, see [[MapFlags]] */
	flags: number
}

export interface TypeConversion<X> {
	parse(x: Buffer): X
	format(x: X): Buffer
}

class OptionalTypeConversion<X> {
	private readonly type: TypeConversion<X>
	constructor(type: TypeConversion<X>) {
		this.type = type
	}

	parse(x: Buffer): X
	parse(x: Buffer | undefined): X | undefined
	parse(x: Buffer | undefined): X | undefined {
		return x === undefined ? undefined : this.type.parse(x)
	}

	format(x: X): Buffer
	format(x: X | undefined): Buffer | undefined
	format(x: X | undefined): Buffer | undefined {
			return x === undefined ? undefined : this.type.format(x)
	}
}

/**
 * Generic interface to manipulate an eBPF map. API-compatible
 * with JavaScript `Map`.
 * 
 * In an eBPF map, keys and values are binary strings of a fixed length,
 * defined at map creation (see [[MapDesc]]). This interface converts
 * keys and values to 'parsed' representations using the
 * given [[TypeConversion]].
 *
 * Some operations are never atomic: iteration, in particular, doesn't
 * offer a consistent view of the map. Even 'atomic' operations
 * may not be atomic, depending on the underlying map implementation
 * (see [[MapType]]).
 * 
 * Some methods, such as [[clear]], are convenience functions
 * and are implemented using one or more operations. [[clear]] in
 * particular is non-atomic. Refer to each method documentation for
 * details.
 */
export interface IMap<K, V> {
	// Base operations

	get(key: K, flags?: number): V | undefined

	/**
	 * Atomically deletes an entry and returns its former value.
	 * 
	 * @param key Entry key
	 */
	getDelete(key: K): V | undefined

	set(key: K, value: V, flags?: number): this

	delete(key: K): boolean


	// Batched operations

	getBatch(keys: K[]): (V | undefined)[]

	/**
	 * Atomically deletes a set of entries and returns their former values.
	 * 
	 * @param key Entry keys
	 */
	getDeleteBatch(keys: K[]): (V | undefined)[]

	setBatch(entries: [K, V][]): this

	deleteBatch(keys: K[]): K[]


	// Other operations

	/**
	 * Returns key immediately following the passed one,
	 * or (if the key doesn't exist or isn't passed) the
	 * first key.
	 * 
	 * **Note:** Not passing a key is only supported
	 * on kernels 4.12 and above.
	 * 
	 * @param key Current key
	 * @returns Next key, or undefined if no such key exists.
	 */
	getNextKey(key?: K): K | undefined

	/**
	 * Freezes the map, making it non-modifiable from userspace.
	 * The map stays writeable from BPF side.
	 */
	freeze(): void


	// Convenience functions

	/**
	 * Convenience function. Tests if the map has an entry.
	 * 
	 * @param key Entry key
	 */
	has(key: K): boolean

	/**
	 * Convenience function. Non-atomically iterates through the map's keys.
	 * Gets the next key *before* yielding the current one, making it
	 * suitable for deleting entries while iterating.
	 * 
	 * **Note:** For kernels older than 4.12, a start key must be passed.
	 * See [[getNextKey]].
	 * 
	 * This is a wrapper around [[getNextKey]].
	 */
	keys(start?: K): IterableIterator<K>

	/**
	 * Convenience function. Non-atomically iterates through the map's entries.
	 * Gets the next key *before* yielding the current one, making it
	 * suitable for deleting entries while iterating.
	 * 
	 * **Note:** For kernels older than 4.12, a start key must be passed.
	 * See [[getNextKey]].
	 * 
	 * This is a wrapper around [[getNextKey]] and [[get]].
	 */
	entries(start?: K): IterableIterator<[K, V]>

	/**
	 * Convenience function. Non-atomically iterates through the map's values.
	 * 
	 * **Note:** For kernels older than 4.12, a start key must be passed.
	 * See [[getNextKey]].
	 * 
	 * This is a wrapper around [[getNextKey]] and [[get]].
	 */
	values(start?: K): IterableIterator<V>

	/**
	 * Convenience function. Non-atomically iterates through the map's entries,
	 * deleting them while iterating.
	 * 
	 * **Note:** For kernels older than 4.12, a start key must be passed.
	 * See [[getNextKey]].
	 * 
	 * This is a wrapper around [[getNextKey]] and [[getDelete]].
	 */
	consumeEntries(start?: K): IterableIterator<[K, V]>

	/**
	 * Convenience function. Non-atomically iterates over the map's entries,
	 * deleting them.
	 * 
	 * **Note:** For kernels older than 4.12, a start key must be passed.
	 * See [[getNextKey]].
	 * 
	 * This is a wrapper around [[getNextKey]] and [[delete]].
	 */
	clear(start?: K): void

	/**
	 * Convenience function. Alias of [[entries]].
	 */
	[Symbol.iterator](): IterableIterator<[K, V]>
}

export class RawMap implements IMap<Buffer, Buffer> {
	readonly fd: FD
	readonly desc: MapDesc

	constructor(fd: FD, desc: MapDesc) {
		this.fd = fd
		this.desc = Object.freeze({ ...desc })
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
		return this._checkBuf(this.desc.keySize, x)
	}
	private _vBuf(x: Buffer) {
		return this._checkBuf(this.desc.valueSize, x)
	}
	private _kOrBuf(x?: Buffer) {
		return this._getBuf(this.desc.keySize, x)
	}
	private _vOrBuf(x?: Buffer) {
		return this._getBuf(this.desc.valueSize, x)
	}
	private _sliceKeys(x: Buffer, count: number) {
		if (count * this.desc.keySize > x.length)
			throw Error('Count exceeds array size')
		const ret = []
		for (let i = 0; i < count; i++)
			ret.push(x.subarray(i * this.desc.keySize, (i + 1) * this.desc.keySize))
		return ret
	}


	// Base operations

	get(key: Buffer, flags: number = 0, out?: Buffer): Buffer | undefined {
		this._kBuf(key)
		out = this._vOrBuf(out)
		const status = native.mapLookupElem(this.fd, key, out, flags)
		if (status == -ENOENT)
			return undefined
		checkStatus('bpf_map_lookup_elem_flags', status)
		return out
	}

	getDelete(key: Buffer, out?: Buffer): Buffer | undefined {
		this._kBuf(key)
		out = this._vOrBuf(out)
		const status = native.mapLookupAndDeleteElem(this.fd, key, out)
		if (status == -ENOENT)
			return undefined
		checkStatus('bpf_map_lookup_and_delete_elem', status)
		return out
	}

	set(key: Buffer, value: Buffer, flags: number = 0): this {
		this._kBuf(key)
		this._vBuf(value)
		const status = native.mapUpdateElem(this.fd, key, value, flags)
		checkStatus('bpf_map_update_elem', status)
		return this
	}

	delete(key: Buffer): boolean {
		this._kBuf(key)
		const status = native.mapDeleteElem(this.fd, key)
		if (status == -ENOENT)
			return false
		checkStatus('bpf_map_delete_elem', status)
		return true
	}


	// Batched operations

	getBatch(keys: Buffer[], out?: Buffer[]): (Buffer | undefined)[] {
		throw Error('not implemented yet') // TODO
	}

	getDeleteBatch(keys: Buffer[], out?: Buffer[]): (Buffer | undefined)[] {
		throw Error('not implemented yet') // TODO
	}

	setBatch(entries: [Buffer, Buffer][]): this {
		throw Error('not implemented yet') // TODO
		return this
	}

	deleteBatch(keys: Buffer[]): Buffer[] {
		keys.forEach(key => this._kBuf(key))
		const outKeys = Buffer.concat(keys)
		const [ status, count ] = native.mapUpdateElem(this.fd,
			outKeys, keys.length)
		checkStatus('bpf_map_delete_batch', status)
		return this._sliceKeys(outKeys, count)
	}


	// Other operations

	getNextKey(key?: Buffer, out?: Buffer): Buffer | undefined {
		// FIXME: if no key passed, implement fallback like BCC does
		key !== undefined && this._kBuf(key)
		out = this._kOrBuf(out)
		const status = native.mapGetNextKey(this.fd, key, out)
		if (status == -ENOENT)
			return undefined
		checkStatus('bpf_map_get_next_key', status)
		return out
	}

	freeze(): void {
		const status = native.mapFreeze(this.fd)
		checkStatus('bpf_map_freeze', status)
	}


	// Convenience functions

	has(key: Buffer): boolean {
		return this.get(key) !== undefined
	}

	*keys(start?: Buffer): IterableIterator<Buffer> {
		let key = this.getNextKey(start)
		while (key !== undefined) {
			const next = this.getNextKey(key)
			yield key
			key = next
		}
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

export class ConvMap<K, V> {
	private keyConv: OptionalTypeConversion<K>
	private valueConv: OptionalTypeConversion<V>

	constructor(fd: FD, desc: MapDesc, keyConv: TypeConversion<K>, valueConv: TypeConversion<V>) {
		this.keyConv = new OptionalTypeConversion(keyConv)
		this.valueConv = new OptionalTypeConversion(valueConv)
	}
}
