const test = require('tape')
const execa = require('execa')
const promisify = require('util').promisify
const readFile = promisify(require('fs').readFile)
const stream = require('stream')
const out = new stream.Writable()

out._write = () => {}

test('index.js - optimize', async (t) => {
  t.plan(1)

  const [fixtureHTML, fixtureCode, fixtureMap] = await Promise.all([
    readFile('./fixtures/expected/index.html', 'utf-8'),
    readFile('./fixtures/expected/bundle.css', 'utf-8'),
    readFile('./fixtures/expected/bundle.css.map', 'utf-8')
  ])

  const output = []

  await require('./index')({
    out,
    createWriteStream (file) {
      const writable = new stream.Writable()

      writable._write = (content) => {
        output.push([file, String(content).trim()])
      }

      return writable
    }
  })({ source: './fixtures/external-map/' })

  t.deepEqual(output, [
    ['fixtures/external-map/index.html', fixtureHTML.trim()],
    ['fixtures/external-map/bundle.css', fixtureCode.trim()],
    ['fixtures/external-map/bundle.css.map', fixtureMap.trim()]
  ])
})

test('index.js - optimize', async (t) => {
  t.plan(1)

  const [fixtureHTML, fixtureCode, fixtureMap] = await Promise.all([
    readFile('./fixtures/expected/index.html', 'utf-8'),
    readFile('./fixtures/expected/bundle.css', 'utf-8'),
    readFile('./fixtures/expected/bundle.css.map', 'utf-8')
  ])

  const output = []

  await require('./index')({
    out,
    createWriteStream (file) {
      const writable = new stream.Writable()

      writable._write = (content) => {
        output.push([file, String(content).trim()])
      }

      return writable
    }
  })({ source: './fixtures/inline-map/' })

  t.deepEqual(output, [
    ['fixtures/inline-map/index.html', fixtureHTML.trim()],
    ['fixtures/inline-map/bundle.css', fixtureCode.trim()],
    ['fixtures/inline-map/bundle.css.map', fixtureMap.trim()]
  ])
})

test('cli.js', async (t) => {
  t.plan(4)

  try {
    await execa('node', ['./cli.js', '-h'])
  } catch (e) {
    t.ok(e)

    t.equal(e.stderr.includes('Usage'), true)

    t.equal(e.stderr.includes('Options'), true)

    t.equal(e.stderr.includes('Parameters'), true)
  }
})
