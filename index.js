const chalk = require('chalk')
const path = require('path')
const postcss = require('postcss')
const stripPseudos = require('strip-pseudos')
const cssnano = require('cssnano')
const streamPromise = require('stream-to-promise')
const fs = require('fs')
const promisify = require('util').promisify
const glob = promisify(require('glob'))
const createReadStream = fs.createReadStream
const createWriteStream = fs.createWriteStream
const { Worker } = require('worker_threads')

module.exports = async (args) => {
  const workers = []
  const selectors = []
  const asts = {}
  const prevMaps = {}
  let used = []

  const cssFiles = await glob(path.join(args.source, '**/*.css'), { nodir: true })

  for (const file of cssFiles) {
    const css = await streamPromise(createReadStream(file, 'utf-8'))

    let [, sourceMappingURL] = String(css).match(/\/\*#\s+sourceMappingURL=\s*(.*?)\s*\*\//)

    if (!sourceMappingURL.startsWith('data:')) {
      sourceMappingURL = path.join(sourceMappingURL.startsWith('/') ? args.source : path.dirname(file), sourceMappingURL)

      const prev = JSON.parse(await streamPromise(createReadStream(sourceMappingURL, 'utf-8')))

      prevMaps[file] = prev
    }

    asts[file] = postcss.parse(css)

    asts[file].walkRules((rule) => {
      if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return

      for (let selector of rule.selectors.map((selector) => selector.trim())) {
        selector = stripPseudos(selector)

        if (selector) {
          selectors.push(selector)
        }
      }
    })
  }

  const htmlFiles = await glob(path.join(args.source, '**/*.html'), { nodir: true })

  let awaiting = htmlFiles.length

  await new Promise((resolve, reject) => {
    while (workers.length < args.workers) {
      const worker = new Worker(path.join(__dirname, 'src/workers/html.js'), {
        workerData: args
      })

      workers.push(worker)

      worker.on('message', ({ file, used }) => {
        console.log(`${chalk.gray('[optimize]')} saved ${file}`)

        used = used.concat(used)

        if (!--awaiting) {
          resolve()

          for (let worker of workers) {
            worker.terminate()
          }
        }
      })
      worker.on('error', reject)
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`))
        }
      })
    }

    htmlFiles.forEach((file, i) => {
      const worker = workers[i % workers.length]

      worker.postMessage({ file, selectors })
    })
  })

  const plugins = [
    postcss.plugin('optimize', (opts) => (root) => {
      root.walkRules((rule) => {
        if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return

        const selector = rule.selectors
          .map((selector) => selector.trim())
          .filter((selector) => {
            selector = stripPseudos(selector)

            return !selector || used.includes(selector)
          })
          .join(', ')

        if (selector === '') {
          rule.remove()
        } else {
          rule.selector = selector
        }
      })
    }),
    cssnano({ autoprefixer: false })
  ]

  return Promise.all(cssFiles.map(async (file) => {
    const map = {
      inline: false
    }

    if (prevMaps[file]) {
      map.prev = prevMaps[file]
    }

    const output = await postcss(plugins).process(asts[file], {
      from: '/' + path.relative(args.source, file),
      to: '/' + path.relative(args.source, file),
      map
    })

    const cssStream = createWriteStream(file)

    cssStream.end(String(output.css))

    const mapStream = createWriteStream(file + '.map')

    mapStream.end(String(output.map))

    return Promise.all([
      streamPromise(cssStream).then(() => {
        console.log(`${chalk.gray('[optimize]')} saved ${file}`)
      }),
      streamPromise(mapStream).then(() => {
        console.log(`${chalk.gray('[optimize]')} saved ${file + '.map'}`)
      })
    ])
  }))
}
