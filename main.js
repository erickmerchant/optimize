#!/usr/bin/env node
'use strict'

const command = require('sergeant')
const path = require('path')
const postcss = require('postcss')
const JSDOM = require('jsdom').JSDOM
const stripPseudos = require('strip-pseudos')
const thenify = require('thenify')
const glob = thenify(require('glob'))
const readFile = thenify(require('fs').readFile)
const writeFile = thenify(require('fs').writeFile)

command('optimize', ({option, parameter}) => {
  parameter('source', {
    description: 'the directory that contains html',
    required: true
  })

  return (args) => {
    const source = path.join(process.cwd(), args.source, '**/*.html')

    return glob(source)
    .then((files) => {
      return Promise.all(files.map((file) => {
        return readFile(file, 'utf-8')
        .then((content) => {
          const dom = new JSDOM(content)
          const hrefs = [...dom.window.document.querySelectorAll('link[rel=stylesheet]')].map((el) => path.join(args.source, el.getAttribute('href')))

          return {
            dom,
            hrefs
          }
        })
      }))
    })
    .then((files) => {
      return files.reduce((hrefs, file) => hrefs.concat(file.hrefs.filter((href, index) => file.hrefs.indexOf(href) === index)), []).map((href) => {
        return Promise.all([
          readFile(href, 'utf-8'),
          readFile(href + '.map', 'utf-8')
        ])
        .then(([css, map]) => {
          const plugins = [
            postcss.plugin('optimize', (opts) => {
              return (root, result) => {
                root.walkRules(rule => {
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
              }
            })
          ]

          const prev = JSON.parse(map)

          prev.sources = prev.sources.map((source) => path.relative(process.cwd(), source))

          return postcss(plugins).process(css, {
            from: '/' + path.relative(args.source, href),
            to: '/' + path.relative(args.source, href),
            map: {
              prev,
              annotation: `/${path.relative(args.source, href)}.map`
            }
          })
        })
        .then((output) => {
          return Promise.all([
            writeFile(path.join(process.cwd(), `${href}`), String(output.css)),
            writeFile(path.join(process.cwd(), `${href}.map`), output.map)
          ])
        })
      })
    })
  }
})(process.argv.slice(2))
