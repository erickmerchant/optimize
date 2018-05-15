#!/usr/bin/env node

const command = require('sergeant')
const optimize = require('./index')
const promisify = require('util').promisify
const writeFile = promisify(require('fs').writeFile)

command('optimize', optimize({writeFile}))(process.argv.slice(2))
