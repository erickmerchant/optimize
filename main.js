#!/usr/bin/env node
'use strict'

const command = require('sergeant')
const path = require('path')
const chalk = require('chalk')
const cheerio = require('cheerio')
const thenify = require('thenify')
const readFile = thenify(require('fs').readFile)
const writeFile = thenify(require('fs').writeFile)
const uncss = thenify(require('uncss'))
const glob = thenify(require('glob'))

command('optimize', function ({option, parameter}) {
  parameter('source', {
    description: 'the directory that contains html',
    required: true
  })

  option('css', {
    description: 'name of outputted css file without extension',
    default: 'bundle'
  })

  option('inline', {
    description: 'inline the css',
    type: Boolean,
    default: false
  })

  return function (args) {
    const source = path.join(process.cwd(), args.source)
    const htmlroot = source
    const csspath = source

    return glob(path.join(htmlroot, '**/*.html')).then(function (files) {
      if (args.inline) {
        return files.map(function (file) {
          return unstyle([file]).then(function (css) {
            return restyle(file, '<style type="text/css">' + css + '</style>')
          })
        })
      } else {
        unstyle(files).then(function (css) {
          return writeFile(path.join(source, args.css + '.css'), css).then(function () {
            console.log(chalk.green('\u2714 ') + 'saved optimized ' + path.join(args.source, args.css + '.css'))

            return files.map(function (file) {
              return restyle(file, '<link href="/' + args.css + '.css" rel="stylesheet" type="text/css" />')
            })
          })
        })
      }
    })

    function unstyle (files) {
      return uncss(files, {htmlroot, csspath}).then(function (css) {
        css = css.filter((v) => v != null).join('\n')

        css = css.replace(source, '')

        return css
      })
    }

    function restyle (file, newStyle) {
      return readFile(file, 'utf-8').then(function (html) {
        let $ = cheerio.load(html)

        $('style').replaceWith('')

        $('link[rel=stylesheet]').replaceWith('')

        if ($('head').length) {
          $('head').append(newStyle)
        } else {
          $('body').before(newStyle)
        }

        return writeFile(file, $.html()).then(function () {
          console.log(chalk.green('\u2714 ') + 'saved optimized ' + path.join(args.source, path.relative(args.source, file)))
        })
      })
    }
  }
})(process.argv.slice(2))
