const assert = require('assert')
const path = require('path')
const postcss = require('postcss')
const cssnano = require('cssnano')
const JSDOM = require('jsdom').JSDOM
const stripPseudos = require('strip-pseudos')
const htmlnano = require('htmlnano')
const promisify = require('util').promisify
const readFile = promisify(require('fs').readFile)
const glob = promisify(require('glob'))

module.exports = (deps) => {
  assert.strictEqual(typeof deps.writeFile, 'function')

  return async (args) => {
    let files = await glob(path.join(args.source, '**/*.html'), { nodir: true })

    files = await Promise.all(files.map(async (file) => {
      const content = await readFile(file, 'utf-8')

      const minified = await htmlnano.process(content)

      await deps.writeFile(file, minified.html)

      const dom = new JSDOM(content)
      const hrefs = [...dom.window.document.querySelectorAll('link[rel=stylesheet]')].map((el) => {
        const href = el.getAttribute('href')

        return path.join(href.startsWith('/') ? args.source : path.dirname(file), href)
      })

      return {
        dom,
        hrefs
      }
    }))

    return Promise.all(files.reduce((hrefs, file) => hrefs.concat(file.hrefs.filter((href, index) => file.hrefs.indexOf(href) === index)), []).map(async (href) => {
      const [css, map] = await Promise.all([
        readFile(href, 'utf-8'),
        readFile(href + '.map', 'utf-8')
      ])

      const plugins = [
        postcss.plugin('optimize', (opts) => (root, result) => {
          root.walkRules((rule) => {
            if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return

            const selector = rule.selectors
              .map((selector) => selector.trim())
              .filter((selector) => {
                return files.reduce((isUsed, file) => {
                  const stripped = stripPseudos(selector)

                  if (!stripped) return true

                  return file.dom.window.document.querySelector(stripped) != null ? true : isUsed
                }, false)
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

      const prev = JSON.parse(map)

      prev.sources = prev.sources.map((source) => path.relative(process.cwd(), source))

      const output = await postcss(plugins).process(css, {
        from: '/' + path.relative(args.source, href),
        to: '/' + path.relative(args.source, href),
        map: {
          prev,
          annotation: `${path.relative(args.source, href)}.map`
        }
      })

      return Promise.all([
        deps.writeFile(path.join(`${href}`), String(output.css)),
        deps.writeFile(path.join(`${href}.map`), String(output.map))
      ])
    }))
  }
}
