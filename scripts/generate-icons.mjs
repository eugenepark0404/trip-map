import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src = join(__dirname, 'icon-source.svg')
const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

await sharp(src).resize(192, 192).png().toFile(join(outDir, 'icon-192.png'))
await sharp(src).resize(512, 512).png().toFile(join(outDir, 'icon-512.png'))

// maskable: pad content into the safe-zone (content inside ~80% center circle)
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#b45f3c' },
})
  .composite([{ input: await sharp(src).resize(400, 400).toBuffer(), left: 56, top: 56 }])
  .png()
  .toFile(join(outDir, 'icon-maskable-512.png'))

await sharp(src).resize(180, 180).png().toFile(join(root, 'public', 'apple-touch-icon.png'))

console.log('icons generated')
