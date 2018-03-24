const test = require('tape')
const execa = require('execa')
const thenify = require('thenify')
const readFile = thenify(require('fs').readFile)

const noopDeps = {
  writeFile () {}
}
const noopDefiners = {
  parameter () {},
  option () {}
}

test('index.js - options and parameters', function (t) {
  t.plan(2)

  const parameters = {}
  const options = {}

  require('./index')(noopDeps)({
    parameter (name, args) {
      parameters[name] = args
    },
    option (name, args) {
      options[name] = args
    }
  })

  t.ok(parameters.source)

  t.deepEqual(parameters.source.required, true)
})

test('index.js - optimize', async function (t) {
  t.plan(1)

  const [fixtureHTML, fixtureCode, fixtureMap] = await Promise.all([
    readFile('./fixtures/expected/index.html', 'utf-8'),
    readFile('./fixtures/expected/bundle.css', 'utf-8'),
    readFile('./fixtures/expected/bundle.css.map', 'utf-8')
  ])

  const output = []

  require('./index')({
    writeFile (file, content) {
      output.push([file, content.trim()])

      return Promise.resolve(true)
    }
  })(noopDefiners)({ source: './fixtures/build/' })
    .then(function () {
      t.deepEqual(output, [
        ['fixtures/build/index.html', fixtureHTML.trim()],
        ['fixtures/build/bundle.css', fixtureCode.trim()],
        ['fixtures/build/bundle.css.map', fixtureMap.trim()]
      ])
    })
})

test('cli.js', async function (t) {
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
