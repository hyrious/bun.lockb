# @hyrious/bun.lockb

Parse and print `bun`'s binary lockfile `bun.lockb`.

## Usage

```js
import { parse } from '@hyrious/bun.lockb'

console.log(parse(fs.readFileSync('bun.lockb')))
```

## How it works?

Translate [bun/src/install/lockfile.zig](https://github.com/oven-sh/bun/blob/main/src/install/lockfile.zig) (MIT licensed) to JS.

## What's next?

Let's see if `bun` will decide to change its lockfile to text format ([bun#5486](https://github.com/oven-sh/bun/issues/5486)).

## License

MIT @ [hyrious](https://github.com/hyrious)
