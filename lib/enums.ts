/**
 * Exports BPF uapi enums.
 * 
 * For practicity, we omit the UNSPEC = 0 key from each enum.
 */
/** */

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
	HASH = 1,
	ARRAY,
	PROG_ARRAY,
	PERF_EVENT_ARRAY,
	PERCPU_HASH,
	PERCPU_ARRAY,
	STACK_TRACE,
	CGROUP_ARRAY,
	LRU_HASH,
	LRU_PERCPU_HASH,
	LPM_TRIE,
	ARRAY_OF_MAPS,
	HASH_OF_MAPS,
	DEVMAP,
	SOCKMAP,
	CPUMAP,
	XSKMAP,
	SOCKHASH,
	CGROUP_STORAGE,
	REUSEPORT_SOCKARRAY,
	PERCPU_CGROUP_STORAGE,
	QUEUE,
	STACK,
	SK_STORAGE,
	DEVMAP_HASH,
	STRUCT_OPS,
    RINGBUF,
}

export enum MapFlags {
	NO_PREALLOC = (1 << 0),
	/** Instead of having one common LRU list in the
	 * BPF_MAP_TYPE_LRU_[PERCPU_]HASH map, use a percpu LRU list
	 * which can scale and perform better.
	 * Note, the LRU nodes (including free nodes) cannot be moved
	 * across different LRU lists.
	 */
	NO_COMMON_LRU = (1 << 1),
	/** Specify numa node during map creation */
	NUMA_NODE = (1 << 2),

	/** Flags for accessing BPF object from syscall side. */
	RDONLY = (1 << 3),
	/** Flags for accessing BPF object from syscall side. */
	WRONLY = (1 << 4),

	/** Flag for stack_map, store build_id+offset instead of pointer */
	STACK_BUILD_ID = (1 << 5),

	/** Zero-initialize hash function seed. This should only be used for testing. */
	ZERO_SEED = (1 << 6),

	/** Flags for accessing BPF object from program side. */
	RDONLY_PROG = (1 << 7),
	/** Flags for accessing BPF object from program side. */
	WRONLY_PROG = (1 << 8),

	/** Clone map from listener for newly accepted socket */
	CLONE = (1 << 9),

	/** Enable memory-mapping BPF map */
	MMAPABLE = (1 << 10),
}
