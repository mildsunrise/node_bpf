# bpf

Node.js bindings to libbpf. BPF is a Virtual Machine (and associated bytecode definition) embedded in the Linux kernel. This module allows you to:

 - Assemble & compile BPF programs

 - Use the kernel's `ebpf` interface:
   - Load programs into the kernel
   - Attach them to events
   - Create & manipulate eBPF maps
   - Other: perf events, check feature availability, pin objects to BPFFS, query program bytecode, BTF data, etc.

## Status

Currently, there's only an interface to create and manipulate eBPF maps.

## Usage

libbpf and its dependencies are included, so you only need a compiler:

~~~ bash
sudo apt install build-essential
~~~

Then, install this module:

~~~ bash
npm install bpf
~~~

libbpf is kernel agnostic, but not all of the exposed features may be supported by the running kernel.
