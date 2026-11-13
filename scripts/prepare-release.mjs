import { cp, mkdir, readdir, writeFile, realpath } from 'node:fs/promises'
import { resolve, relative, dirname, sep } from 'node:path'
import { verifyPublic } from './check-public.mjs'

if (!process.argv[2]) throw new Error('Pass a new external destination directory; existing repositories are never overwritten')
await verifyPublic()
const destination = resolve(process.argv[2])
const parent = await realpath(dirname(destination))
const rel = relative(await realpath('.'), parent)
if (!rel.startsWith(`..${sep}`) && rel !== '..') throw new Error('Release destination must be outside the authoring/source repository')
try {
  await readdir(destination)
  throw new Error('Destination already exists; choose a new directory')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
await mkdir(destination)
await cp('dist', destination, { recursive: true })
await mkdir(resolve(destination, '.github/workflows'), { recursive: true })
await writeFile(resolve(destination, '.nojekyll'), '')
await writeFile(resolve(destination, '.github/workflows/deploy.yml'), `name: Publish production artifacts
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - name: Stage deployable files only
        run: |
          mkdir /tmp/pages
          cp index.html connection.json lain-*.png /tmp/pages/
          cp -R assets capsules /tmp/pages/
          for page in */index.html; do
            mkdir -p "/tmp/pages/$(dirname "$page")"
            cp "$page" "/tmp/pages/$page"
          done
          touch /tmp/pages/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: /tmp/pages
      - id: deployment
        uses: actions/deploy-pages@v4
`)
console.log('Prepared an external artifacts-only release directory. No repository, remote, commit, push or deployment was changed.')
