{
    "targets": [
        {
            "target_name": "libbpf",
            "type": "static_library",
            "sources": [
                "libbpf/src/bpf.c",
                "libbpf/src/btf.c",
                "libbpf/src/libbpf.c",
                "libbpf/src/libbpf_errno.c",
                "libbpf/src/netlink.c",
                "libbpf/src/nlattr.c",
                "libbpf/src/str_error.c",
                "libbpf/src/libbpf_probes.c",
                "libbpf/src/bpf_prog_linfo.c",
                "libbpf/src/xsk.c",
                "libbpf/src/btf_dump.c",
                "libbpf/src/hashmap.c",
                "libbpf/src/ringbuf.c",
            ],
            "include_dirs": [
                "libbpf/src",
                "libbpf/include",
                "libbpf/include/uapi",
            ],
            # should get zlib.h from Node headers
            "dependencies": [ "elfutils.gyp:libelf" ],
            "cflags": [ "-fvisibility=hidden", "-Wno-sign-compare", "-Wno-missing-field-initializers" ],
            "direct_dependent_settings": {
                "include_dirs": [
                    "libbpf/src",
                    "libbpf/include/uapi",
                ],
            },
        },
    ]
}
