import { constants } from 'os'
import { native, FD, asUint32Array, checkU32 } from '../util'
import { checkStatus, BPFError } from '../exception'
import { MapType, MapFlags } from '../constants'
const { EFAULT, EINVAL } = constants.errno

// FIXME: we are excluding BTF related parameters for now

/**
 * Parameters to create an eBPF map.
 * 
 * After the map is created, the parameters may be different
 * because of rounding, truncating or type-dependent behaviour.
 */
export interface MapDef {
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

    /** Map name (might get truncated if longer than [[OBJ_NAME_LEN]]) (since Linux 4.15) */
    name?: string
    /** NUMA node on which to store the map (since Linux 4.15) */
    numaNode?: number
    /**
     * For map-in-map types: parameters for the inner map,
     * or FD of an existing map to clone parameters from.
     * The existing map's lifetime isn't affected in any way.
     */
    innerMap?: MapDef | MapRef | number
    /** For offloading, ifindex of network device to create the map on (since Linux 4.16) */
    ifindex?: number
}

/**
 * Information reported about an eBPF map.
 * 
 * After the map is created, the parameters may be different
 * because of rounding, truncating or type-dependent behaviour.
 * 
 * Optional parameters are present if the running kernel version
 * supports them.
 */
export interface MapInfo {
    /**
     * Map type. This decides the available operations and
     * their semantics.
     */
    type: MapType
    /** Map ID (since Linux 4.13) */
    id?: number
    /** Size of every key, in bytes */
    keySize: number
    /** Size of every value, in bytes */
    valueSize: number
    /** Maximum amount of entries: the meaning of this is type-dependent */
    maxEntries: number
    /** Flags specified on map creation, see [[MapFlags]] */
    flags: number

    // Optional

    /** Map name (might get truncated if longer than [[OBJ_NAME_LEN]]) (since Linux 4.15) */
    name?: string
    /** For offloading, ifindex of network device the map was created on (reported since Linux 4.16) */
    ifindex?: number

    netnsDev?: bigint
    netnsIno?: bigint
}

/**
 * Object holdling a file descriptor (plus parameters) for an
 * eBPF map. The object must own the file descriptor, meaning
 * that it won't get closed while this object is alive.
 * 
 * If you got a file descriptor from someplace else, you can
 * use [[createMapRef]] to obtain a [[MapRef]] pointing to the
 * same map.
 * 
 * ### Implementing a custom `MapRef`
 * 
 * You can also choose to implement your own `MapRef`s,
 * but you must make sure to report the parameters correctly
 * (otherwise, it can lead to **buffer overflow**) and make
 * sure the object holds a reference to whatever is keeping
 * the file descriptor from being closed. You may optionally
 * implement [[close]] if you completely own the FD.
 */
export interface MapRef extends MapInfo {
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
    /**
     * Write the user data into the passed `Buffer`
     * (which must *not* be assumed to be initialized)
     */
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
export function createMap(desc: MapDef): MapRef {
    let innerRef: MapRef | undefined
    try {
        // prevent people from accidentally passing -1 or similar
        checkU32(desc.keySize)
        checkU32(desc.valueSize)
        checkU32(desc.maxEntries)

        desc = { flags: 0, ...desc }
        if (desc.numaNode !== undefined)
            desc.flags! |= MapFlags.NUMA_NODE

        if (desc.innerMap !== undefined && typeof desc.innerMap !== 'number') {
            let fd: number | undefined
            try {
                ; ({ fd } = desc.innerMap as MapRef)
            } catch (e) {}
            if (fd === undefined) {
                innerRef = createMap(desc.innerMap)
                fd = innerRef.fd
            }
            desc.innerMap = fd
        }

        const status: number = native.createMap(desc)
        checkStatus('bpf_create_map_xattr', status)
        return createMapRef(status, { transfer: true, parameters: desc })
    } finally {
        innerRef && innerRef.close!()
    }
}

/**
 * Given an existing file descriptor pointing to an eBPF map,
 * obtain its information and return a [[MapRef]] instance
 * pointing to that map (but creating a duplicate descriptor).
 * 
 * **Note:** If `parameters` is passed, it will be used as
 * a fallback to build the `MapRef` for kernels older than 4.13.
 * Make sure it's correct. If not passed, the call will fail
 * for older kernels.
 * 
 * If `transfer` is `true`, the passed FD itself is used
 * (taking ownership of it) instead of creating a new FD first.
 * Do this only if the FD isn't being used anywhere else.
 * 
 * If the file descriptor is invalid, the function throws
 * without taking ownership. Note that there is no way to
 * check whether the FD actually points to an eBPF map,
 * the caller is responsible to check first.
 * 
 * @param fd file descriptor
 * @param options options
 * @returns [[MapRef]] instance
 */
export function createMapRef(fd: number, options?: {
    parameters?: MapDef,
    transfer?: boolean
}): MapRef {
    if (!(options && options.transfer)) {
        fd = native.dup(fd)
        checkStatus('dup', fd)
    }
    const ref = new native.FDRef(fd)

    const [ status, info ] = native.getMapInfo(fd)
    if (status === -EINVAL && options?.parameters) {
        // Fall back to building MapRef manually using MapDef as info
        const desc = options?.parameters
        ref.type = desc.type
        ref.keySize = desc.keySize
        ref.valueSize = desc.valueSize
        ref.maxEntries = desc.maxEntries
        ref.flags = desc.flags || 0
    } else {
        checkStatus('bpf_obj_get_info_by_fd', status)
        Object.assign(ref, info)    
    }
    Object.freeze(ref) // prevent changes to the info
    return ref
}

/**
 * Get a [[MapRef]] to the eBPF map with specified ID.
 * 
 * Since Linux 4.13.
 * 
 * @param id Map ID
 * @returns [[MapRef]] instance
 */
export function openMap(id: number): MapRef {
    const status = native.mapGetFdById(id)
    checkStatus('bpf_map_get_fd_by_id', status)
    return createMapRef(status, { transfer: true })
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
