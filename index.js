const assert = require('assert')
const path = require('path')
const postcss = require('postcss')
const cssnano = require('cssnano')
const JSDOM = require('jsdom').JSDOM
const stripPseudos = require('strip-pseudos')
const htmlnano = require('htmlnano')
const streamPromise = require('stream-to-promise')
const fs = require('fs')
const promisify = require('util').promisify
const glob = promisify(require('glob'))
const createReadStream = fs.createReadStream

module.exports = (deps) => {
  assert.strictEqual(typeof deps.createWriteStream, 'function')

  return async (args) => {
    let files = await glob(path.join(args.source, '**/*.html'), { nodir: true })
    const unused = []
    const hrefs = []

    const minifyPromises = Promise.all(files.map(async (file) => {
      const content = await streamPromise(createReadStream(file, 'utf-8'))

      const minified = await htmlnano.process(content, { minifySvg: false })

      const minifiedHTMLStream = deps.createWriteStream(file)

      minifiedHTMLStream.end(minified.html)

      await streamPromise(minifiedHTMLStream)
    }))

    await Promise.all(files.map(async (file) => {
      const content = await streamPromise(createReadStream(file, 'utf-8'))

      const dom = new JSDOM(content)

      for (const el of [...dom.window.document.querySelectorAll('link[rel=stylesheet]')]) {
        let href = el.getAttribute('href')

        href = path.join(href.startsWith('/') ? args.source : path.dirname(file), href)

        if (!hrefs.includes(href)) {
          hrefs.push(href)
        }

        const css = await streamPromise(createReadStream(href, 'utf-8'))

        postcss.parse(css).walkRules((rule) => {
          if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return

          for (const selector of rule.selectors.map((selector) => selector.trim())) {
            const stripped = stripPseudos(selector)

            if (stripped && !dom.window.document.querySelector(stripped)) {
              unused.push(selector)
            }
          }
        })
      }
    }))

    return Promise.all(hrefs.map(async (href) => {
      const css = await streamPromise(createReadStream(href, 'utf-8'))

      const plugins = [
        postcss.plugin('optimize', (opts) => (root) => {
          root.walkRules((rule) => {
            if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return

            const selector = rule.selectors
              .map((selector) => selector.trim())
              .filter((selector) => {
                return !unused.includes(selector)
              })
              .join(', ')

            if (selector === '') {
              rule.remove()
            } else {
              rule.selector = selector
            }
          })
        }),
        cssnano({ autoprefixer: false })
      ]

      const map = {
        inline: false
      }

      let [, sourceMappingURL] = String(css).match(/\/\*#\s+sourceMappingURL=\s*(.*?)\s*\*\//)

      if (!sourceMappingURL.startsWith('data:')) {
        sourceMappingURL = path.join(sourceMappingURL.startsWith('/') ? args.source : path.dirname(href), sourceMappingURL)

        const prev = JSON.parse(await streamPromise(createReadStream(sourceMappingURL, 'utf-8')))

        map.prev = prev
      }

      const output = await postcss(plugins).process(css, {
        from: '/' + path.relative(args.source, href),
        to: '/' + path.relative(args.source, href),
        map
      })

      const cssStream = deps.createWriteStream(path.join(`${href}`))

      cssStream.end(String(output.css))

      const mapStream = deps.createWriteStream(path.join(`${href}.map`))

      mapStream.end(String(output.map))

      return Promise.all([
        minifyPromises,
        streamPromise(cssStream),
        streamPromise(mapStream)
      ])
    }))
  }
}
