# :tada: [Bun 1.2 now uses text-based lockfile!](https://bun.sh/blog/release-notes/bun-v1.2.0#:~:text=bun%20install%20now%20uses%20a%20text%2Dbased%20lockfile%3A%20bun.lock)

You can migrate to the new lockfile by `bun install --save-text-lockfile`.

# @hyrious/bun.lockb

Parse and print `bun`'s binary lockfile `bun.lockb`. [Try it online.](https://hyrious.me/tool/bun.lockb)

## Usage

```js
import { parse } from '@hyrious/bun.lockb'

console.log(parse(fs.readFileSync('bun.lockb')))
```

## How it works?

Translate [bun/src/install/lockfile.zig](https://github.com/oven-sh/bun/blob/main/src/install/lockfile.zig) (MIT licensed) to JS.

## What's next?

~~Let's see if `bun` will decide to change its lockfile to text format ([bun#5486](https://github.com/oven-sh/bun/issues/5486)).~~

Bun 1.2 now uses text-based lockfile!

## License

MIT @ [hyrious](https://github.com/hyrious)
