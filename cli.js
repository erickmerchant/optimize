#!/usr/bin/env node

const command = require('sergeant')
const optimize = require('./index')
const streamPromise = require('stream-to-promise')
const fs = require('fs')
const createWriteStream = fs.createWriteStream

command('optimize', ({ parameter }) => {
  parameter('source', {
    description: 'the directory that contains html',
    required: true
  })

  return (args) => optimize({
    async writeFile (path, content) {
      await streamPromise(createWriteStream(path, content))
    }
  })(args)
})(process.argv.slice(2))
