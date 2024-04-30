/**
 * Parse and print the `bun.lockb` file in yarn lockfile v1 format.
 * ```js
 * // in Node.js
 * parse(fs.readFileSync('bun.lockb')) //=> "# yarn lockfile v1\n..."
 * // in Browser
 * parse(await file.arrayBuffer())
 * ```
 */
export function parse(buf: Uint8Array | ArrayBuffer): string {
  let pos = 0
  let view = buf instanceof ArrayBuffer ? new DataView(buf) : new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  const header_bytes = new TextEncoder().encode('#!/usr/bin/env bun\nbun-lockfile-format-v0\n')

  const u32 = (): number => {
    if (pos + 4 > view.byteLength) throw new TypeError('too short')
    return view.getUint32((pos += 4) - 4, true)
  }

  const u64 = (): number => {
    if (pos + 8 > view.byteLength) throw new TypeError("too short")
    const a = view.getUint32((pos += 4) - 4, true)
    const b = view.getUint32((pos += 4) - 4, true)
    return a + b * (2**32)
  }

  const to_u32 = (a: Uint8Array): Uint32Array => {
    if ((a.byteOffset % 4) === 0) {
      return new Uint32Array(a.buffer, a.byteOffset, a.byteLength / 4)
    } else {
      const view = new DataView(a.buffer, a.byteOffset, a.byteLength)
      return Uint32Array.from({ length: a.byteLength / 4 }, (_, i) => view.getUint32(i * 4, true))
    }
  }

  const read = (n: number): Uint8Array => {
    if (pos + n > view.byteLength) throw new TypeError("too short")
    return new Uint8Array(view.buffer, view.byteOffset + (pos += n) - n, n)
  }

  const eq = (a: Uint8Array, b: Uint8Array): boolean => {
    if (a.byteLength !== b.byteLength) return false
    for (let i = a.byteLength - 1; i >= 0; i--) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  const assert = (truthy: unknown, message = 'assert failed') => {
    if (truthy) return
    throw new TypeError(message)
  }

  const header_buf = read(header_bytes.byteLength)
  assert(eq(header_buf, header_bytes), 'invalid lockfile')

  const format = u32()
  assert(format === 2, 'outdated lockfile version')

  const meta_hash = read(32)

  const end = u64()
  assert(end <= view.byteLength, 'lockfile is missing data')

  const list_len = u64()
  assert(list_len < 2**32, 'lockfile validation failed: list is impossibly long')

  const input_alignment = u64()
  assert(input_alignment === 8)

  const field_count = u64()
  assert(field_count === 8)

  const begin_at = u64()
  const end_at = u64()
  assert(begin_at <= end && end_at <= end && begin_at <= end_at, 'lockfile validation failed: invalid package list range')

  pos = begin_at
  const packages = Object.entries({
    name: 8,
    name_hash: 8,
    resolution: 64,
    dependencies: 8,
    resolutions: 8,
    meta: 88,
    bin: 20,
    scripts: 48,
  }).reduce((list, [field, len]) => {
      const data = read(len * list_len)
      list.forEach((a, i) => { a[field] = data.subarray(i * len, i * len + len) })
      return list
    }, Array.from({ length: list_len }, () => ({} as any)))

  pos = end_at
  const buffers = [
    'trees',
    'hoisted_dependencies',
    'resolutions', // u32[]
    'dependencies', // name(8) + name_hash(8) + behavior(1) + tag(1) + literal(8) = 26[]
    'extern_strings',
    'string_bytes',
  ].reduce((a, key) => {
      const start = u64()
      const end = u64()
      pos = start
      a[key] = read(end - start)
      pos = end
      return a
    }, {} as any)

  const decoder = new TextDecoder()
  const str = (a: Uint8Array): string => {
    if ((a[7] & 0x80) === 0) {
      let i = a.indexOf(0)
      if (i >= 0) a = a.subarray(0, i)
      return decoder.decode(a)
    } else {
      let [off, len] = to_u32(a)
      len &= ~0x80000000
      return decoder.decode(buffers.string_bytes.subarray(off, off + len))
    }
  }

  const requested_versions: Uint8Array[][] = new Array(list_len)
  requested_versions[0] = []
  for (let i = 1; i < list_len; i++) {
    let resolutions = to_u32(buffers.resolutions.subarray())
    let dependencies = buffers.dependencies.subarray()

    let k = -1
    let all_requested_versions: Uint8Array[] = []
    while ((k = resolutions.indexOf(i)) >= 0) {
      all_requested_versions.push(dependencies.subarray(k * 26, k * 26 + 26))
      dependencies = dependencies.subarray(k * 26 + 26)
      resolutions = resolutions.subarray(k + 1)
    }

    requested_versions[i] = all_requested_versions
  }

  const hex = (a: number) => (0x100 + a).toString(16).slice(1)
  const fmt_hash = (a: Uint8Array): string => {
    if (a.byteLength < 32) throw new TypeError('meta_hash too short')
    let hash = ''
    for (let i = 0; i < 32; i++) {
      let c = hex(a[i])
      if (i < 8) c = c.toUpperCase()
      hash += c
      if (i < 31 && (i + 1) % 8 === 0) hash += '-'
    }
    return hash
  }

  const enum ResolutionTag {
    uninitialized = 0, root = 1, npm = 2, folder = 4,
    local_tarball = 8,
    github = 16, gitlab = 24,
    git = 32,
    symlink = 64,
    workspace = 72,
    remote_tarball = 80,
    single_file_module = 100,
  }

  const fmt_resolution = (a: Uint8Array): string => {
    if (a.byteLength < 64) throw new TypeError('resolution too short')
    const tag = a[0]
    const view = new DataView(a.buffer, a.byteOffset, a.byteLength)
    let pos = 8
    if (tag === ResolutionTag.npm) { // url(string) + version
      pos += 8
      const major = view.getUint32((pos += 4) - 4, true)
      const minor = view.getUint32((pos += 4) - 4, true)
      const patch = view.getUint32((pos += 4) - 4, true)
      pos += 4
      const version_tag = new Uint8Array(view.buffer, view.byteOffset + pos, 32)
      const pre = str(version_tag.subarray(0, 8))
      const build = str(version_tag.subarray(16, 24))
      let v = `${major}.${minor}.${patch}`
      if (pre) v += '-' + pre
      if (build) v += '+' + build
      return v
    }
    // TODO: support other resolutions
    return ""
  }

  const fmt_url = (a: Uint8Array): string => {
    if (a.byteLength < 64) throw new TypeError('resolution too short')
    const tag = a[0]
    const view = new DataView(a.buffer, a.byteOffset, a.byteLength)
    if (tag === ResolutionTag.npm) { // url(string) + version
      return str(new Uint8Array(view.buffer, view.byteOffset + 8, 8))
    }
    // TODO: support other resolutions
    return ""
  }

  const slice = (data: Uint8Array, a: Uint8Array, item: number): Uint8Array[] => {
    const [off, length] = to_u32(a)
    return Array.from({ length }, (_, i) => data.subarray(
      item * off + item * i,
      item * off + item * i + item,
    ))
  }

  const base64 = (a: Uint8Array): string => {
    let ret: string
    if (a.length < 65535) {
      ret = globalThis.btoa(String.fromCodePoint.apply(String, a as any))
    } else {
      ret = ''
      for (let value of a) {
        ret += String.fromCodePoint(value)
      }
      ret = globalThis.btoa(ret)
    }
    return ret
  }

  const fmt_integrity = (a: Uint8Array): string => {
    if (a.byteLength < 65) throw new TypeError('integrity too short')
    const tag = a[0] // [0, sha1, sha256, sha384, sha512]
    a = a.subarray(1)
    let out: string
    if (tag === 1) out = 'sha1-'
    else if (tag === 2) out = 'sha256-'
    else if (tag === 3) out = 'sha384-'
    else if (tag === 4) out = 'sha512-'
    else return ''
    out += base64(a)
    return out
  }

  const quote = (s: string): string => {
    if (s.startsWith('true') || s.startsWith('false') ||
        /[:\s\n\\",\[\]]/g.test(s) || /^[0-9]/g.test(s) || !/^[a-zA-Z]/g.test(s))
      return JSON.stringify(s)
    else
      return s
  }

  const fmt_specs = (name: string, specs: string[], version: string): string => {
    specs = Array.from(new Set(specs.map(e => e || `^${version}`)))
    let out = '', comma = false
    for (const spec of specs) {
      const item = name + '@' + spec
      if (comma) out += ', '
      out += quote(item)
      comma = true
    }
    return out + ':'
  }

  let out = [
    '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.',
    '# yarn lockfile v1',
    '# bun ./bun.lockb --hash: ' + fmt_hash(meta_hash),
    '',
  ]

  for (let i = 1; i < list_len; i++) {
    const a = packages[i]
    const name = str(a.name)
    const resolution = a.resolution
    const meta = a.meta
    const dependencies = slice(buffers.dependencies, a.dependencies, 26)
    const dependency_versions = requested_versions[i]
    const version = fmt_resolution(resolution)
    const versions = dependency_versions.map((b) => str(b.subarray(18, 18 + 8)))
    const url = fmt_url(resolution)
    const integrity = fmt_integrity(meta.subarray(20, 85))

    out.push('')
    out.push(fmt_specs(name, versions, version))
    out.push(`  version ${JSON.stringify(version)}`)
    out.push(`  resolved ${JSON.stringify(url)}`)
    if (integrity) {
      out.push(`  integrity ${integrity}`)
    }
    if (dependencies.length > 0) {
      const enum Behavior {
        _ = 0,
        normal = 0b10,
        optional = 0b100,
        dev = 0b1000,
        peer = 0b10000,
        workspace = 0b100000,
      }
      let behavior = Behavior._
      for (let dependency of dependencies) {
        let dep_behavior = dependency[16]
        if (behavior !== dep_behavior) {
          if ((dep_behavior & Behavior.optional) > 0) {
            out.push("  optionalDependencies:")
          } else if ((dep_behavior & Behavior.normal) > 0) {
            out.push("  dependencies:")
          } else if ((dep_behavior & Behavior.dev) > 0) {
            out.push("  devDependencies:")
          } else continue
          behavior = dep_behavior
        }
        let dep_name = str(dependency.subarray(0, 8))
        let literal = str(dependency.subarray(18, 18 + 8))
        out.push(`    ${quote(dep_name)} "${literal}"`)
      }
    }
  }

  out.push('')
  return out.join('\n')
}
