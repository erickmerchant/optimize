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

  parameter('css', {
    description: 'the file where your css is',
    required: true
  })

  option('inline', {
    description: 'inline the css',
    type: Boolean,
    default: false
  })

  option('each', {
    description: 'go file by file',
    type: Boolean,
    default: false
  })

  return (args) => {
    const source = path.join(process.cwd(), args.source, '**/*.html')

    return glob(source)
    .then((files) => {
      return Promise.all(files.map((file) => {
        return readFile(file, 'utf-8')
        .then((content) => {
          return {
            path: file,
            dom: new JSDOM(content),
            content
          }
        })
      }))
    })
    .then((files) => {
      if (args.each) {
        return Promise.all(files.map((file) => {
          return unstyle([file], `/${path.relative(args.source, file.path)}.css.map`)
          .then((output) => {
            let map = JSON.parse(output.map)

            map.sources = map.sources.map((source) => path.relative(process.cwd(), source))

            return Promise.all([
              args.inline ? inline(file, output) : Promise.resolve(true),
              writeFile(path.join(process.cwd(), `${path.relative(args.source, file.path)}.css`), String(output.css)),
              writeFile(path.join(process.cwd(), `${path.relative(args.source, file.path)}.css.map`), JSON.stringify(map))
            ])
          })
        }))
      }

      return unstyle(files, `/${path.relative(args.source, args.css)}.map`)
      .then((output) => {
        let map = JSON.parse(output.map)

        map.sources = map.sources.map((source) => path.relative(process.cwd(), source))

        return Promise.all([
          Promise.all(files.map((file) => {
            return args.inline ? inline(file, output) : Promise.resolve(true)
          })),
          writeFile(path.join(process.cwd(), `${args.css}`), String(output.css)),
          writeFile(path.join(process.cwd(), `${args.css}.map`), JSON.stringify(map))
        ])
      })
    })

    function unstyle (files, annotation) {
      return Promise.all([
        readFile(args.css, 'utf-8'),
        readFile(args.css + '.map', 'utf-8')
      ])
      .then(([css, map]) => {
        const plugins = [
          postcss.plugin('optimize', function (opts) {
            return function (root, result) {
              root.walkRules(rule => {
                if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return

                const selector = rule.selectors
                  .map((selector) => selector.trim())
                  .filter((selector) => {
                    return files.reduce((isUsed, file) => {
                      return file.dom.window.document.querySelector(stripPseudos(selector)) != null ? true : isUsed
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

        prev.sources = prev.sources.map((source) => path.join(process.cwd(), source))

        return postcss(plugins).process(css, {
          from: '/' + path.relative(args.source, args.css),
          to: '/' + path.relative(args.source, args.css),
          map: {
            prev,
            inline: false,
            annotation
          }
        })
      })
    }

    function inline (file, output) {
      const dom = new JSDOM(file.content)

      const css = String(output.css)

      const href = path.relative(args.source, args.css)

      let element = dom.window.document.querySelector('link[href$="' + href + '"]')

      if (element == null) {
        throw new Error('no link found')
      }

      const fragment = new JSDOM('<style type="text/css">' + css + '</style>')

      element.parentNode.replaceChild(fragment.window.document.head.childNodes[0], element)

      return writeFile(file.path, dom.serialize())
    }
  }
})(process.argv.slice(2))
