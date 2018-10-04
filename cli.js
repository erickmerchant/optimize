#!/usr/bin/env node

const command = require('sergeant')
const optimize = require('./index')
const fs = require('fs')
const createWriteStream = fs.createWriteStream

command('optimize', ({ parameter }) => {
  parameter('source', {
    description: 'the directory that contains html',
    required: true
  })

  return (args) => optimize({
    out: process.stdout,
    createWriteStream
  })(args)
})(process.argv.slice(2))
