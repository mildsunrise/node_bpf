/**
 * Exports BPF uapi enums.
 * 
 * Keep synchronized with `deps/libbpf/include/uapi/linux/bpf.h`.
 * For practicity, we omit the UNSPEC = 0 key from each enum.
 */
/** */

/**
 * Maximum length of object names, in bytes, including NUL terminator.
 * Longer names will be truncated.
 */
export const OBJ_NAME_LEN = 16

export enum ProgramType {
    SOCKET_FILTER = 1,
    KPROBE,
    SCHED_CLS,
    SCHED_ACT,
    TRACEPOINT,
    XDP,
    PERF_EVENT,
    CGROUP_SKB,
    CGROUP_SOCK,
    LWT_IN,
    LWT_OUT,
    LWT_XMIT,
    SOCK_OPS,
    SK_SKB,
    CGROUP_DEVICE,
    SK_MSG,
    RAW_TRACEPOINT,
    CGROUP_SOCK_ADDR,
    LWT_SEG6LOCAL,
    LIRC_MODE2,
    SK_REUSEPORT,
    FLOW_DISSECTOR,
    CGROUP_SYSCTL,
    RAW_TRACEPOINT_WRITABLE,
    CGROUP_SOCKOPT,
    TRACING,
    STRUCT_OPS,
    EXT,
    LSM,
}

export enum AttachType {
    CGROUP_INET_INGRESS,
    CGROUP_INET_EGRESS,
    CGROUP_INET_SOCK_CREATE,
    CGROUP_SOCK_OPS,
    SK_SKB_STREAM_PARSER,
    SK_SKB_STREAM_VERDICT,
    CGROUP_DEVICE,
    SK_MSG_VERDICT,
    CGROUP_INET4_BIND,
    CGROUP_INET6_BIND,
    CGROUP_INET4_CONNECT,
    CGROUP_INET6_CONNECT,
    CGROUP_INET4_POST_BIND,
    CGROUP_INET6_POST_BIND,
    CGROUP_UDP4_SENDMSG,
    CGROUP_UDP6_SENDMSG,
    LIRC_MODE2,
    FLOW_DISSECTOR,
    CGROUP_SYSCTL,
    CGROUP_UDP4_RECVMSG,
    CGROUP_UDP6_RECVMSG,
    CGROUP_GETSOCKOPT,
    CGROUP_SETSOCKOPT,
    TRACE_RAW_TP,
    TRACE_FENTRY,
    TRACE_FEXIT,
    MODIFY_RETURN,
    LSM_MAC,
    TRACE_ITER,
    CGROUP_INET4_GETPEERNAME,
    CGROUP_INET6_GETPEERNAME,
    CGROUP_INET4_GETSOCKNAME,
    CGROUP_INET6_GETSOCKNAME,
    XDP_DEVMAP,
}

export enum MapType {
    /** [Hash](https://github.com/torvalds/linux/commit/0f8e4bd8a1fc8c4185f1630061d0a1f2d197a475) (since Linux 3.19) */
    HASH = 1,
    /** [Array](https://github.com/torvalds/linux/commit/28fbcfa08d8ed7c5a50d41a0433aad222835e8e3) (since Linux 3.19) */
    ARRAY,
    /** [Tail call](https://github.com/torvalds/linux/commit/04fd61ab36ec065e194ab5e74ae34a5240d992bb) (since Linux 4.2) */
    PROG_ARRAY,
    /** [Perf events](https://github.com/torvalds/linux/commit/ea317b267e9d03a8241893aa176fba7661d07579) (since Linux 4.3) */
    PERF_EVENT_ARRAY,
    /** [Per-CPU hash](https://github.com/torvalds/linux/commit/824bd0ce6c7c43a9e1e210abf124958e54d88342) (since Linux 4.6) */
    PERCPU_HASH,
    /** [Per-CPU array](https://github.com/torvalds/linux/commit/a10423b87a7eae75da79ce80a8d9475047a674ee) (since Linux 4.6) */
    PERCPU_ARRAY,
    /** [Stack trace](https://github.com/torvalds/linux/commit/d5a3b1f691865be576c2bffa708549b8cdccda19) (since Linux 4.6) */
    STACK_TRACE,
    /** [cgroup array](https://github.com/torvalds/linux/commit/4ed8ec521ed57c4e207ad464ca0388776de74d4b) (since Linux 4.8) */
    CGROUP_ARRAY,
    /** [LRU hash](https://github.com/torvalds/linux/commit/3a08c2fd763450a927d1130de078d6f9e74944fb) (since Linux 4.10) */
    LRU_HASH,
    /** [LRU per-CPU hash](https://github.com/torvalds/linux/commit/961578b63474d13ad0e2f615fcc2901c5197dda6) (since Linux 4.10) */
    LRU_PERCPU_HASH,
    /** [LPM trie (longest-prefix match)](https://github.com/torvalds/linux/commit/b95a5c4db09bc7c253636cb84dc9b12c577fd5a0) (since Linux 4.11) */
    LPM_TRIE,
    /** [Array of maps](https://github.com/torvalds/linux/commit/56f668dfe00dcf086734f1c42ea999398fad6572) (since Linux 4.12) */
    ARRAY_OF_MAPS,
    /** [Hash of maps](https://github.com/torvalds/linux/commit/bcc6b1b7ebf857a9fe56202e2be3361131588c15) (since Linux 4.12) */
    HASH_OF_MAPS,
    /** [Netdevice references](https://github.com/torvalds/linux/commit/546ac1ffb70d25b56c1126940e5ec639c4dd7413) (since Linux 4.14) */
    DEVMAP,
    /** [Socket references (array)](https://github.com/torvalds/linux/commit/174a79ff9515f400b9a6115643dafd62a635b7e6) (since Linux 4.14) */
    SOCKMAP,
    /** [CPU references](https://github.com/torvalds/linux/commit/6710e1126934d8b4372b4d2f9ae1646cd3f151bf) (since Linux 4.15) */
    CPUMAP,
    /** [AF_XDP socket (XSK) references](https://github.com/torvalds/linux/commit/fbfc504a24f53f7ebe128ab55cb5dba634f4ece8) (since Linux 4.18) */
    XSKMAP,
    /** [Socket references (hashmap)](https://github.com/torvalds/linux/commit/81110384441a59cff47430f20f049e69b98c17f4) (since Linux 4.18) */
    SOCKHASH,
    /** [cgroup storage](https://github.com/torvalds/linux/commit/de9cbbaadba5adf88a19e46df61f7054000838f6) (since Linux 4.19) */
    CGROUP_STORAGE,
    /** [reuseport sockarray](https://github.com/torvalds/linux/commit/5dc4c4b7d4e8115e7cde96a030f98cb3ab2e458c) (since Linux 4.19) */
    REUSEPORT_SOCKARRAY,
    /** [precpu cgroup storage](https://github.com/torvalds/linux/commit/b741f1630346defcbc8cc60f1a2bdae8b3b0036f) (since Linux 4.20) */
    PERCPU_CGROUP_STORAGE,
    /** [queue](https://github.com/torvalds/linux/commit/f1a2e44a3aeccb3ff18d3ccc0b0203e70b95bd92) (since Linux 4.20) */
    QUEUE,
    /** [stack](https://github.com/torvalds/linux/commit/f1a2e44a3aeccb3ff18d3ccc0b0203e70b95bd92) (since Linux 4.20) */
    STACK,
    /** [socket local storage](https://github.com/torvalds/linux/commit/6ac99e8f23d4b10258406ca0dd7bffca5f31da9d) (since Linux 5.2) */
    SK_STORAGE,
    /** [Netdevice references (hashmap)](https://github.com/torvalds/linux/commit/6f9d451ab1a33728adb72d7ff66a7b374d665176) (since Linux 5.4) */
    DEVMAP_HASH,
    /** [struct ops](https://github.com/torvalds/linux/commit/85d33df357b634649ddbe0a20fd2d0fc5732c3cb) (since Linux 5.6) */
    STRUCT_OPS,
    /** [ring buffer](https://github.com/torvalds/linux/commit/457f44363a8894135c85b7a9afd2bd8196db24ab) (since Linux 5.8) */
    RINGBUF,
}

export enum MapFlags {
    /**
     * Don't preallocate map memory (since Linux 4.6;
     * memory wasn't preallocated before)
     */
    NO_PREALLOC = (1 << 0),
    /**
     * Instead of having one common LRU list in the
     * BPF_MAP_TYPE_LRU_[PERCPU_]HASH map, use a percpu LRU list
     * which can scale and perform better.
     * Note, the LRU nodes (including free nodes) cannot be moved
     * across different LRU lists.
     */
    NO_COMMON_LRU = (1 << 1),
    /** Specify NUMA node during map creation (since Linux 4.15). */
    NUMA_NODE = (1 << 2),

    /** Flags for accessing BPF object from syscall side (since Linux 4.15). */
    RDONLY = (1 << 3),
    /** Flags for accessing BPF object from syscall side (since Linux 4.15). */
    WRONLY = (1 << 4),

    /** Flag for stack_map, store build_id+offset instead of pointer. */
    STACK_BUILD_ID = (1 << 5),

    /** Zero-initialize hash function seed (since Linux 5.0). This should only be used for testing. */
    ZERO_SEED = (1 << 6),

    /** Flags for accessing BPF object from program side (since Linux 5.2). */
    RDONLY_PROG = (1 << 7),
    /** Flags for accessing BPF object from program side (since Linux 5.2). */
    WRONLY_PROG = (1 << 8),

    /** Clone map from listener for newly accepted socket */
    CLONE = (1 << 9),

    /** Enable memory-mapping BPF map (since Linux 5.5) */
    MMAPABLE = (1 << 10),
}

/** Flags for `set` operation on a map */
export enum MapUpdateFlags {
    /** create new element or update existing */
    ANY = 0,
    /** create new element if it didn't exist */
    NOEXIST = 1,
    /** update existing element */
    EXIST = 2,
    /** spin_lock-ed operation (since Linux 5.1) */
    F_LOCK = 4,
}

/** Flags for `get` operation on a map */
export enum MapLookupFlags {
    /** spin_lock-ed operation (since Linux 5.1) */
    F_LOCK = 4,
}
