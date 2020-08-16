import { native, FD, asUint32Array } from '../util'
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
	parse(buf: Buffer): X
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
