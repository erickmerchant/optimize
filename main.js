#!/usr/bin/env node
'use strict'

const command = require('sergeant')
const path = require('path')
// const chalk = require('chalk')
const cheerio = require('cheerio')
const thenify = require('thenify')
const readFile = thenify(require('fs').readFile)
const writeFile = thenify(require('fs').writeFile)
const postcss = require('postcss')
const uncss = require('uncss').postcssPlugin
const glob = thenify(require('glob'))

command('optimize', function ({option, parameter}) {
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

  return function (args) {
    const source = path.join(process.cwd(), args.source, '**/*.html')

    return glob(source)
    .then(function (files) {
      if (args.each) {
        return Promise.all(files.map(function (file) {
          return unstyle([file], `/${path.relative(args.source, file)}.css.map`)
          .then(function (output) {
            let map = JSON.parse(output.map)

            map.sources = map.sources.map((source) => path.relative(process.cwd(), source))

            return Promise.all([
              args.inline ? restyle(file, output) : Promise.resolve(true),
              writeFile(path.join(process.cwd(), `${path.relative(args.source, file)}.css`), String(output.css)),
              writeFile(path.join(process.cwd(), `${path.relative(args.source, file)}.css.map`), JSON.stringify(map))
            ])
          })
        }))
      }

      return unstyle(files, `/${path.relative(args.source, args.css)}.map`)
      .then(function (output) {
        let map = JSON.parse(output.map)

        map.sources = map.sources.map((source) => path.relative(process.cwd(), source))

        return Promise.all([
          Promise.all(files.map(function (file) {
            return args.inline ? restyle(file, output) : Promise.resolve(true)
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
      .then(function ([css, map]) {
        const plugins = [
          uncss({
            html: files
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

    function restyle (file, output) {
      const css = String(output.css)

      const href = path.relative(args.source, args.css)

      return readFile(file, 'utf-8')
      .then(function (html) {
        let $ = cheerio.load(html)

        let link = $('link[href$="' + href + '"]')

        if (link.length !== 1) {
          throw new Error('no link found')
        }

        link.replaceWith('<style type="text/css">' + css + '</style>')

        return writeFile(file, $.html())
      })
    }
  }
})(process.argv.slice(2))
