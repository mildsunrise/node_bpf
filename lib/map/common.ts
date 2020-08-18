import { native, FD, asUint32Array, checkU32 } from '../util'
import { checkStatus } from '../exception'
import { MapType, MapFlags } from '../enums'
const { EFAULT } = native

/**
 * Parameters to create an eBPF map.
 * 
 * After the map is created, the parameters may be different
 * because of rounding, truncating or type-dependent behaviour.
 */
export interface MapDesc {
    /**
     * Map type. This decides the available operations and
     * their semantics. Keep in mind that not all of the types
     * may be supported by your kernel.
     */
    type: MapType
    /** Size of every key, in bytes */
    keySize: number
    /** Size of every value, in bytes */
    valueSize: number
    /** Maximum amount of entries: the meaning of this is type-dependent */
	maxEntries: number
	/** Flags specified on map creation, see [[MapFlags]] */
    flags?: number
    
    // Optional

    /** Map name (might get truncated if longer than allowed) (since Linux 4.15) */
    name?: string
    /** NUMA node on which to store the map (since Linux 4.15) */
    numaNode?: number
}

/**
 * Object holdling a file descriptor (plus parameters) for an
 * eBPF map. The object must own the file descriptor, meaning
 * that it won't get closed while this object is alive.
 * 
 * If you got a file descriptor from someplace else, make sure
 * to set the parameters correctly (otherwise, it can lead to
 * **buffer overflow**) and make sure this object holds a
 * reference to whatever is keeping the file descriptor alive.
 */
export interface MapRef extends MapDesc {
    /**
     * Readonly property holding the FD owned by this object.
     * Don't store this value elsewhere, query it
     * from here every time to make sure it's valid.
     * 
     * Throws if `close()` was successfully called.
     */
    readonly fd: FD

    /**
     * Closes the FD early. Instances don't necessarily support
     * this operation (and will throw in that case), but all
     * instances returned by this module do.
     * 
     * If supported, calling it a second time does nothing.
     */
    close(): void
}

/**
 * This interface implements a conversion between `Buffer`
 * and a user-defined representation. See [[u32type]] for
 * an example.
 */
export interface TypeConversion<X> {
    /** Parse a `Buffer` into user data */
    parse(buf: Buffer): X
    /** Write the user data into the passed `Buffer` */
	format(buf: Buffer, x: X): void
}

export class TypeConversionWrap<X> {
    readonly type: TypeConversion<X>
    readonly size: number

    constructor(type: TypeConversion<X>, size: number) {
        this.type = type
        this.size = size
    }

    parse(buf: Buffer): X {
        return this.type.parse(buf)
    }

    parseMaybe(buf: Buffer | undefined): X | undefined {
        return buf === undefined ? undefined : this.parse(buf)
    }

    format(x: X, out: Buffer = Buffer.alloc(this.size)): Buffer {
        this.type.format(out, x)
        return out
    }

    formatMaybe(x: X | undefined): Buffer | undefined {
        return x === undefined ? undefined : this.format(x)
    }
}

/** [[TypeConversion]] for a single `uint32`, for convenience */
export const u32type: TypeConversion<number> = {
    parse: (buf) => asUint32Array(buf, 1)[0],
    format: (buf, x) => asUint32Array(buf, 1)[0] = x,
}

/**
 * Create a new eBPF map. It is recommended to use [[close]]
 * if you're no longer going to need it at some point.
 * 
 * @param desc Map parameters
 * @returns [[MapRef]] instance, holding a reference
 * to the newly created map, and its actual parameters
 */
export function createMap(desc: MapDesc): MapRef {
    // prevent people from 
    checkU32(desc.keySize)
    checkU32(desc.valueSize)
    checkU32(desc.maxEntries)

    desc = { flags: 0, ...desc }
    if (desc.numaNode !== undefined)
        desc.flags! |= MapFlags.NUMA_NODE

    const status: number = native.createMap(desc)
    checkStatus('bpf_create_map_xattr', status)
    const ref = new native.FDRef(status)
    return Object.freeze(Object.assign(ref, desc))
}

// Utils for map interfaces

export function fixCount(count: number | undefined, batchSize: number, status: number) {
	if (status < 0 && count === batchSize) {
		// it's impossible to have an error if all entries were processed,
		// that must mean count wasn't updated
		count = (status === -EFAULT) ? undefined : 0
	}
	return count
}

export function checkAllProcessed(count: number | undefined, batchSize: number) {
	if (count !== batchSize) {
		// it's impossible to have no error if some entries weren't processed
		throw Error(`Assertion failed: ${count} of ${batchSize} entries processed`)
	}
}
