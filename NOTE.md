# `bun.lockb` Format

All `int` are in little endian.

## Header (42 bytes)

```js
"#!/usr/bin/env bun\nbun-lockfile-format-v0\n"
```

## Format Version (4 bytes)

Must be

```
02 00 00 00
```

## Meta Hash (32 bytes)

## Total Buffer Size (8 bytes)

The file size won't be bigger than int32, so only the first 4 bytes are used.

```ts
const end: u64
```

## Packages Length (8 bytes)

Will you install over 2147483647 packages? No.

```ts
const list_len: u64
```

## Alignment (8 bytes)

Always `8`.

```ts
const input_alignment: u64
```

## Field count (8 bytes)

Always `8`.

```ts
const field_count: u64
```

## Packages' offsets (8 + 8)

```ts
const begin_at: u64
const end_at: u64
```

## Packages' content

Bun stores packages (rows) in different fields (cols) separately.
So if the first field is `name` in 8 bytes. There will be `list_len`
of 8-byte `name`s stored here.

```
[name][name]... (x list_len times)
[field2][field2]... (x list_len times)
...
[field8][field8]... (x list_len times)
```

### String

Bun has a special structure for strings. They are at least 8 bytes long.
If a string is longer than 8 bytes, it will be stored in `[offset: u32, len: u32]`.
The difference is whether its last bit is `1` (the last byte &ge; 128).

```js
[data] // meaning
[0,0,0,0,0,0,0,0] // ""
[101,115,98,117,105,108,100,0] // "esbuild"
[0,0,0,0,18,0,0,128] // external string at offset=0, len=18
```
