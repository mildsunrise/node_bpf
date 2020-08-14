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
export { MapDesc, TypeConversion } from './map/common'
export { IMap, RawMap } from './map/map'
