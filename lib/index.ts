import { native } from './util'

export const versions: {
    /** libelf version used */
    libelf: string
    /** libbpf version used */
    libbpf: string
    /** supported BTF version */
    btf: number
    /** running kernel release */
    kernel: string
} = native.versions

/** alias of `versions.libbpf` */
export const version: string = versions.libbpf

export { ProgramType, MapType, AttachType, MapFlags } from './enums'
export { LibbpfErrno, BPFError, libbpfErrnoMessages } from './exception'
export { MapDesc, MapRef, createMap, TypeConversion, u32type } from './map/common'
export { IMap, RawMap, ConvMap } from './map/map'
export { IArrayMap, RawArrayMap, ConvArrayMap } from './map/array'
