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
    writeFile (path, content) {
      const stream = createWriteStream(path)

      stream.end(content)

      return streamPromise(stream)
    }
  })(args)
})(process.argv.slice(2))
