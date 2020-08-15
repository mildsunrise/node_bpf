import { native } from '../util'
import { checkStatus } from '../exception'
import { MapType, MapFlags } from '../enums'

/**
 * Parameters to create an eBPF map.
 */
export interface MapDesc {
	type: MapType
	keySize: number
	valueSize: number
	maxEntries: number
	/** Flags specified on map creation, see [[MapFlags]] */
    flags?: number
    
    // Optional
    name?: string
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
    readonly fd: number

    /**
     * Closes the FD early. Instances don't necessarily support
     * this operation (and will throw in that case), but all
     * instances returned by this module do.
     * 
     * If supported, calling it a second time does nothing.
     */
    close(): void
}

export interface TypeConversion<X> {
	parse(x: Buffer): X
	format(x: X): Buffer
}

export class OptionalTypeConversion<X> {
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
 * Create a new eBPF map. It is recommended to use [[close]]
 * if you're no longer going to need it at some point.
 * 
 * @param desc Map parameters
 * @returns [[MapRef]] instance
 */
export function createMap(desc: MapDesc): MapRef {
    desc = { flags: 0, ...desc }
    if (desc.numaNode)
        desc.flags! |= MapFlags.NUMA_NODE

    const status: number = native.createMap(desc)
    checkStatus('bpf_create_map_xattr', status)
    const ref = new native.FDRef(status)
    return Object.freeze(Object.assign(ref, desc))
}
