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

There's a generic API to create ([`createMap`][]) and manipulate ([`IMap`][]) eBPF maps of any type, including map-in-map support, but only some map types are currently tested. There's no BTF support for now.

It has a [raw version][`RawMap`] (which operates with binary `Buffer`s directly), and a [high-level version][`ConvMap`] which uses a conversion supplied by the user.

Apart from the generic API, there's a few other sub-APIs for specific map types, such as [`IArrayMap`][] for `ARRAY` maps. These also have raw and high-level versions.

## Usage

There's prebuilds for x86 and x64, so you don't need anything in those cases.

For other cases, libbpf and its dependencies are included so you only need a compiler:

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
[`RawMap`]: https://bpf.alba.sh/docs/classes/rawmap.html
[`ConvMap`]: https://bpf.alba.sh/docs/classes/convmap.html
[`TypeConversion`]: https://bpf.alba.sh/docs/interfaces/typeconversion.html
[`IArrayMap`]: https://bpf.alba.sh/docs/interfaces/iarraymap.html
