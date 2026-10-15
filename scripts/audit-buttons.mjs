// Buton denetimi: gerçekten hiçbir işlevi olmayan <button> etiketlerini bulur.
// <Link> veya <a> içinde kalan butonlar çalışır sayılır (tıklanınca yönlendirir).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'src')

const problems = []
const okLinks = []

// Bir <button> etiketinin <Link> veya <a> içinde olup olmadığını kontrol eder
function isWrappedByLink(src, index) {
  const before = src.slice(0, index)
  const lastOpen = Math.max(before.lastIndexOf('<Link'), before.lastIndexOf('<a '), before.lastIndexOf('<a\n'))
  if (lastOpen < 0) return false
  const afterOpen = before.slice(lastOpen)
  const lastCloseLink = afterOpen.lastIndexOf('</Link>')
  const lastCloseA = afterOpen.lastIndexOf('</a>')
  return Math.max(lastCloseLink, lastCloseA) < 0
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (fs.statSync(p).isDirectory()) { walk(p); continue }
    if (!f.endsWith('.jsx')) continue

    const src = fs.readFileSync(p, 'utf8')
    const rel = path.relative(root, p).replace(/\\/g, '/')

    const re = /<button\b([^>]*)>/g
    let m
    while ((m = re.exec(src))) {
      const attrs = m[1]
      const line = src.slice(0, m.index).split(/\r?\n/).length
      const hasOwnAction = /onClick/.test(attrs) || /type\s*=\s*["']submit["']/.test(attrs)
      if (hasOwnAction) continue
      if (isWrappedByLink(src, m.index)) { okLinks.push(`${rel}:${line}`); continue }
      problems.push(`${rel}:${line}: <button${attrs.slice(0, 80)}>`)
    }

    // Boş onClick'ler
    const re2 = /onClick=\{\(\)\s*=>\s*\{\s*\}\}/g
    while ((m = re2.exec(src))) {
      problems.push(`${rel}:${src.slice(0, m.index).split(/\r?\n/).length}: boş onClick`)
    }
    // Ölü bağlantılar
    const re3 = /(href|to)\s*=\s*(["'])#\2/g
    while ((m = re3.exec(src))) {
      problems.push(`${rel}:${src.slice(0, m.index).split(/\r?\n/).length}: ölü bağlantı ${m[0]}`)
    }
  }
}

walk(srcDir)

console.log(`Kontrol edilen bağlantılı buton: ${okLinks.length}`)
if (!problems.length) {
  console.log('SONUÇ: Sorun yok — tum butonlar ve baglantilar islevli.')
} else {
  console.log(`\nSONUÇ: ${problems.length} sorun:`)
  problems.forEach((x) => console.log('  ' + x))
}
