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

There's prebuilds for x86, x64, arm32v7 and arm64v8, so you don't need anything in those cases.

For other archs, libbpf and its dependencies are included so you only need a compiler:

~~~ bash
sudo apt install build-essential
~~~

Then, install this module:

~~~ bash
npm install bpf
~~~

libbpf is kernel agnostic, but not all of the exposed features may be supported by the running kernel, even if they are present in the API and typings. This extends to everything (functions, flags, map types, ...). For some notable cases, we make a mention in the docs, but for a full reference of features and their required kernel versions, go [here](https://github.com/iovisor/bcc/blob/master/docs/kernel-versions.md). If a feature isn't supported by your kernel and you try to use it, you'll likely get an `EINVAL` error.

## Examples

### Raw map operations

~~~ javascript
const bpf = require('bpf')

// Create a HASH map, with 4-byte keys and values
const ref = bpf.createMap({
  type: bpf.MapType.HASH,
  keySize: 4, valueSize: 4,
  maxEntries: 10
})

// Wrap it in `RawMap` to operate with it
const map = new bpf.RawMap(ref)

// Add some entries
const key1 = Buffer.of(0,0,0,1), key2 = Buffer.of(0,0,9,2)
map.set(key1, Buffer.from('abcd'))
map.set(key2, Buffer.from('w00t'))

// Print entries (warning: HASH has no order)
for (const [k, v] of map)
  console.log('entry', k.toString('hex'), '=', v.toString('ascii'))
// entry 00000902 = w00t
// entry 00000001 = abcd

map.get(key2) // -> <Buffer 77 30 30 74>
map.delete(key2) // -> true
map.get(key2) // -> undefined
~~~

### Using conversions

~~~ javascript
// We'll have NUL-terminated strings as keys, and uint32 values
const ref = bpf.createMap({
  type: bpf.MapType.HASH,
  keySize: 16, valueSize: 4,
  maxEntries: 7
})
// bpf already provides a conversion for uint32, for convenience
// So we only need to write one for the keys
const stringConversion = {
  parse: (buf) => {
    const size = buf.indexOf(0)
    return buf.slice(0, size === -1 ? buf.length : size).toString()
  },
  format: (buf, x) => {
    buf.fill(0)
    buf.write(x)
  }
}
const map = new bpf.ConvMap(ref, stringConversion, bpf.u32type)

map.set('a cat', 1)
map.set('foo', 3458)
map.set('test', 5)

[...map] // -> [ ['foo', 3458], ['test', 5], ['a cat', 1] ]
~~~

### Array maps

~~~ javascript
const doubleConversion = {
  parse: (buf) => buf.readDoubleLE(),
  format: (buf, x) => buf.writeDoubleLE(x),
}

const ref = bpf.createMap({
  type: bpf.MapType.ARRAY,
  keySize: 4, // always 4
  valueSize: 8,
  maxEntries: 5 // array length
})
const array = new bpf.ConvArrayMap(ref, doubleConversion)

// Or equivalently...
const array2 = bpf.createArrayMap(5, 8, doubleConversion)

// Values are initialized to zero
[...array] // -> [ 0, 0, 0, 0, 0 ]

array.set(3, 106.5)
[...array] // -> [ 0, 0, 0, 106.5, 0 ]
~~~

### Using your own FD

~~~ javascript
const fd = getMapFDFromSomewhereElse()

// By default it duplicates the FD, leaving the original FD unaffected
const ref = bpf.createMapRef(fd)
ref.fd === fd  // -> false

// Use the `transfer` option if you want bpf to take its ownership
const ref2 = bpf.createMapRef(fd, { transfer: true })
ref2.fd === fd  // -> true

const map = new RawMap(ref)
// ...
~~~

### Map-in-map

~~~ javascript
// our values will be ARRAY maps
const innerParams = {
  type: bpf.MapType.ARRAY,
  keySize: 4, valueSize: 4,
  maxEntries: 5
}
const createInnerMap = () =>
  new bpf.ConvArrayMap(bpf.createMap(innerParams), bpf.u32type)

// create an ARRAY_OF_MAPS, passing the inner parameters
const ref = bpf.createMap({
  type: bpf.MapType.ARRAY_OF_MAPS,
  keySize: 4, valueSize: 4,
  maxEntries: 7,
  innerMap: innerParams
})
const map = new bpf.ConvMap(ref, bpf.u32type, bpf.u32type)

// the map is initially empty
[...map] // -> []

// to set an entry, pass the FD of a suitable map
const value1 = createInnerMap()
map.set(2, value1.ref.fd)

// when getting, the *ID* will be returned instead
map.get(2) === value1.ref.id  // -> true
~~~



[`createMap`]: https://bpf.alba.sh/docs/modules.html#createMap
[`IMap`]: https://bpf.alba.sh/docs/interfaces/IMap.html
[`RawMap`]: https://bpf.alba.sh/docs/classes/RawMap.html
[`ConvMap`]: https://bpf.alba.sh/docs/classes/ConvMap.html
[`TypeConversion`]: https://bpf.alba.sh/docs/interfaces/TypeConversion.html
[`IArrayMap`]: https://bpf.alba.sh/docs/interfaces/IArrayMap.html
