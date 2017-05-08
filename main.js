#!/usr/bin/env node
'use strict'

const command = require('sergeant')
const path = require('path')
const chalk = require('chalk')
const cheerio = require('cheerio')
const thenify = require('thenify')
const fsReadFile = thenify(require('fs').readFile)
const fsWriteFile = thenify(require('fs').writeFile)
const uncss = thenify(require('uncss'))
const glob = thenify(require('glob'))

command('optimize', function ({option, parameter}) {
  parameter('source', {
    description: 'the directory that contains html',
    required: true
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

    return glob(htmlroot + '**/*.html').then(function (files) {
      if (args.inline) {
        return files.map(function (file) {
          return uncss([file], {htmlroot, csspath}).then(function (css) {
            return fsReadFile(file, 'utf-8').then(function (html) {
              return fsWriteFile(file, restyle(html, '<style type="text/css">' + css + '</style>')).then(function () {
                console.log(chalk.green('\u2714 ') + 'saved optimized ' + path.join(args.source, path.relative(args.source, file)))
              })
            })
          })
        })
      } else {
        uncss(files, {htmlroot, csspath}).then(function (css) {
          return fsWriteFile(path.join(source, 'app.css'), css).then(function () {
            console.log(chalk.green('\u2714 ') + 'saved optimized ' + path.join(args.source, 'app.css'))

            return files.map(function (file) {
              return fsReadFile(file, 'utf-8').then(function (html) {
                return fsWriteFile(file, restyle(html, '<link href="/app.css" rel="stylesheet" type="text/css" />'))
              })
            })
          })
        })
      }
    })
  }
})(process.argv.slice(2))

function restyle (html, newStyle) {
  let $ = cheerio.load(html)

  $('style').replaceWith('')

  $('link[rel=stylesheet]').replaceWith('')

  if ($('head').length) {
    $('head').append(newStyle)
  } else {
    $('body').before(newStyle)
  }

  return $.html()
}
