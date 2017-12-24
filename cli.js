#!/usr/bin/env node

const command = require('sergeant')
const optimize = require('./index')
const thenify = require('thenify')
const writeFile = thenify(require('fs').writeFile)

command('optimize', optimize({writeFile}))(process.argv.slice(2))
