#!/usr/bin/env node

const command = require('sergeant')
const optimize = require('./index')
const os = require('os')

command('optimize', ({ parameter, option }) => {
  parameter('source', {
    description: 'the directory that contains html',
    required: true
  })

  option('workers', {
    description: 'how many workers to use',
    type (val = os.cpus().length) {
      return Number(val)
    }
  })

  return optimize
})(process.argv.slice(2))
