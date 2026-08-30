import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

const version = '1.7.12'
const assets = {
  'darwin-arm64': {
    name: 'actionlint_1.7.12_darwin_arm64.tar.gz',
    sha256: 'aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f',
  },
  'darwin-x64': {
    name: 'actionlint_1.7.12_darwin_amd64.tar.gz',
    sha256: '5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644',
  },
  'linux-arm64': {
    name: 'actionlint_1.7.12_linux_arm64.tar.gz',
    sha256: '325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6',
  },
  'linux-x64': {
    name: 'actionlint_1.7.12_linux_amd64.tar.gz',
    sha256: '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8',
  },
}

const asset = assets[`${process.platform}-${process.arch}`]
if (!asset) {
  throw new Error(`actionlint is unsupported on ${process.platform}-${process.arch}`)
}

const directory = mkdtempSync(path.join(tmpdir(), 'mockshop-actionlint-'))
const archive = path.join(directory, asset.name)

try {
  const url = `https://github.com/rhysd/actionlint/releases/download/v${version}/${asset.name}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`actionlint download failed: ${response.status} ${response.statusText}`)
  }

  writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
  const actualSha256 = createHash('sha256')
    .update(readFileSync(archive))
    .digest('hex')
  if (actualSha256 !== asset.sha256) {
    throw new Error(
      `actionlint checksum mismatch: expected ${asset.sha256}, received ${actualSha256}`,
    )
  }

  const extract = spawnSync('tar', ['-xzf', archive, '-C', directory, 'actionlint'], {
    stdio: 'inherit',
  })
  if (extract.error) throw extract.error
  if (extract.status !== 0) {
    throw new Error(`actionlint extraction failed with status ${extract.status ?? 1}`)
  }

  const lint = spawnSync(path.join(directory, 'actionlint'), process.argv.slice(2), {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  if (lint.error) throw lint.error
  process.exitCode = lint.status ?? 1
} finally {
  rmSync(directory, { recursive: true, force: true })
}
