import * as util from 'util'
const { getSystemErrorName } = util as any

/**
 * libbpf-specific errno codes
 * 
 * Keep synchronized with `deps/libbpf/src/libbpf.h`.
 */
export enum LibbpfErrno {
    /** BPF object format invalid */
    FORMAT = 4000,
    /** Incorrect or no 'version' section */
    KVERSION,
    /** Endian mismatch */
    ENDIAN,
    /** Internal error in libbpf */
    INTERNAL,
    /** Relocation failed */
    RELOC,
    /** Load program failure for unknown reason */
    LOAD,
    /** Kernel verifier blocks program loading */
    VERIFY,
    /** Program too big */
    PROG2BIG,
    /** Incorrect kernel version */
    KVER,
    /** Kernel doesn't support this program type */
    PROGTYPE,
    /** Wrong pid in netlink message */
    WRNGPID,
    /** Invalid netlink sequence */
    INVSEQ,
    /** netlink parsing error */
    NLPARSE,
}

/**
 * mapping of libbpf-specific errno codes to messages
 * 
 * Keep synchronized with `deps/libbpf/src/libbpf.h`.
 */
export const libbpfErrnoMessages: { [errno: number]: string } = {
    [LibbpfErrno.FORMAT]: 'BPF object format invalid',
    [LibbpfErrno.KVERSION]: "Incorrect or no 'version' section",
    [LibbpfErrno.ENDIAN]: 'Endian mismatch',
    [LibbpfErrno.INTERNAL]: 'Internal error in libbpf',
    [LibbpfErrno.RELOC]: 'Relocation failed',
    [LibbpfErrno.LOAD]: 'Load program failure for unknown reason',
    [LibbpfErrno.VERIFY]: 'Kernel verifier blocks program loading',
    [LibbpfErrno.PROG2BIG]: 'Program too big',
    [LibbpfErrno.KVER]: 'Incorrect kernel version',
    [LibbpfErrno.PROGTYPE]: "Kernel doesn't support this program type",
    [LibbpfErrno.WRNGPID]: 'Wrong pid in netlink message',
    [LibbpfErrno.INVSEQ]: 'Invalid netlink sequence',
    [LibbpfErrno.NLPARSE]: 'netlink parsing error',
}

export class BPFError extends Error {
    operation: string
    errno: number | LibbpfErrno
    code?: string

    constructor(errno: number, operation: string) {
        const code = BPFError.getCode(errno)
        const message = Object.hasOwnProperty.call(libbpfErrnoMessages, errno) ? libbpfErrnoMessages[errno] : null
        super(message || code)
        this.name = 'BPFError'

        this.operation = operation
        this.errno = errno
        this.code = code
    }

    static getCode(errno: number): string {
        if (Object.hasOwnProperty.call(LibbpfErrno, errno))
            return LibbpfErrno[errno]
        return getSystemErrorName(-errno)
    }
}

export function checkStatus(operation: string, status: number) {
    if (status < 0)
        throw new BPFError(-status, operation)
}
