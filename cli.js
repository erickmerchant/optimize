#!/usr/bin/env node

const command = require('sergeant')
const optimize = require('./index')
const promisify = require('util').promisify
const writeFile = promisify(require('fs').writeFile)

command('optimize', ({parameter}) => {
  parameter('source', {
    description: 'the directory that contains html',
    required: true
  })

  return (args) => optimize({writeFile})(args)
})(process.argv.slice(2))
