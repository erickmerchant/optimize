const assert = require('assert')
const path = require('path')
const postcss = require('postcss')
const JSDOM = require('jsdom').JSDOM
const stripPseudos = require('strip-pseudos')
const thenify = require('thenify')
const glob = thenify(require('glob'))
const readFile = thenify(require('fs').readFile)

module.exports = function (deps) {
  assert.equal(typeof deps.writeFile, 'function')

  return function ({option, parameter}) {
    parameter('source', {
      description: 'the directory that contains html',
      required: true
    })

    return function (args) {
      const source = path.join(process.cwd(), args.source, '**/*.html')

      return glob(source)
        .then(function (files) {
          return Promise.all(files.map(function (file) {
            return readFile(file, 'utf-8')
              .then(function (content) {
                const dom = new JSDOM(content)
                const hrefs = [...dom.window.document.querySelectorAll('link[rel=stylesheet]')].map((el) => path.join(args.source, el.getAttribute('href')))

                return Promise.resolve({
                  dom,
                  hrefs
                })
              })
          }))
        })
        .then(function (files) {
          return Promise.all(files.reduce((hrefs, file) => hrefs.concat(file.hrefs.filter((href, index) => file.hrefs.indexOf(href) === index)), []).map(function (href) {
            return Promise.all([
              readFile(href, 'utf-8'),
              readFile(href + '.map', 'utf-8')
            ])
              .then(function ([css, map]) {
                const plugins = [
                  postcss.plugin('optimize', function (opts) {
                    return function (root, result) {
                      root.walkRules(function (rule) {
                        if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return

                        const selector = rule.selectors
                          .map((selector) => selector.trim())
                          .filter(function (selector) {
                            return files.reduce(function (isUsed, file) {
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
                    }
                  })
                ]

                const prev = JSON.parse(map)

                prev.sources = prev.sources.map((source) => path.relative(process.cwd(), source))

                return Promise.resolve(postcss(plugins).process(css, {
                  from: '/' + path.relative(args.source, href),
                  to: '/' + path.relative(args.source, href),
                  map: {
                    prev,
                    annotation: `/${path.relative(args.source, href)}.map`
                  }
                }))
              })
              .then(function (output) {
                return Promise.all([
                  deps.writeFile(path.join(process.cwd(), `${href}`), String(output.css)),
                  deps.writeFile(path.join(process.cwd(), `${href}.map`), String(output.map))
                ])
              })
          }))
        })
    }
  }
}
