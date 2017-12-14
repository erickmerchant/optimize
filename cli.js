#!/usr/bin/env node

const command = require('sergeant')
const optimize = require('./index')

command('optimize', ({option, parameter}) => {
  parameter('source', {
    description: 'the directory that contains html',
    required: true
  })

  return optimize
})(process.argv.slice(2))
