const test = require('tape')
const execa = require('execa')
const promisify = require('util').promisify
const readFile = promisify(require('fs').readFile)

test('index.js - optimize', async (t) => {
  t.plan(1)

  const [fixtureHTML, fixtureCode, fixtureMap] = await Promise.all([
    readFile('./fixtures/expected/index.html', 'utf-8'),
    readFile('./fixtures/expected/bundle.css', 'utf-8'),
    readFile('./fixtures/expected/bundle.css.map', 'utf-8')
  ])

  const output = []

  await require('./index')({
    async writeFile (file, content) {
      output.push([file, content.trim()])

      return true
    }
  })({ source: './fixtures/build/' })

  t.deepEqual(output, [
    ['fixtures/build/index.html', fixtureHTML.trim()],
    ['fixtures/build/bundle.css', fixtureCode.trim()],
    ['fixtures/build/bundle.css.map', fixtureMap.trim()]
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
