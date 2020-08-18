# bpf

Node.js bindings to libbpf. BPF is a Virtual Machine (and associated bytecode definition) embedded in the Linux kernel. This module allows you to:

 - Assemble & compile BPF programs

 - Use the kernel's `ebpf` interface:
   - Load programs into the kernel
   - Attach them to events
   - Create & manipulate eBPF maps
   - Other: perf events, check feature availability, pin objects to BPFFS, query program bytecode, BTF data, etc.

## Status

Not enough functionality for standalone use yet.

There's an API to create ([`createMap`][]) and manipulate ([`IMap`][]) eBPF maps.  
Apart from the generic `IMap`, there's a few other interfaces for specific semantics, such as [`IArrayMap`][] for `ARRAY` maps.

The interfaces have raw versions (which operate with binary `Buffer`s directly), or high-level versions which use a [conversion][`TypeConversion`] supplied by the user.

## Usage

libbpf and its dependencies are included, so you only need a compiler:

~~~ bash
sudo apt install build-essential
~~~

Then, install this module:

~~~ bash
npm install bpf
~~~

libbpf is kernel agnostic, but not all of the exposed features may be supported by the running kernel, even if they are present in the API and typings. This extends to everything (functions, flags, map types, ...). For some notable cases, we make a mention in the docs, but for a full reference of features and their required kernel versions, go [here](https://github.com/iovisor/bcc/blob/master/docs/kernel-versions.md). If a feature isn't supported by your kernel and you try to use it, you'll likely get an `EINVAL` error.



[`createMap`]: https://bpf.alba.sh/docs/globals.html#createmap
[`IMap`]: https://bpf.alba.sh/docs/interfaces/imap.html
[`IArrayMap`]: https://bpf.alba.sh/docs/interfaces/iarraymap.html
[`TypeConversion`]: https://bpf.alba.sh/docs/interfaces/typeconversion.html
