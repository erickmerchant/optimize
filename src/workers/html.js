const { parentPort, workerData } = require('worker_threads')
const path = require('path')
const JSDOM = require('jsdom').JSDOM
const htmlnano = require('htmlnano')
const streamPromise = require('stream-to-promise')
const fs = require('fs')
const createReadStream = fs.createReadStream
const createWriteStream = fs.createWriteStream
const args = workerData

parentPort.on('message', async ({ file, selectors }) => {
  const used = []

  const content = await streamPromise(createReadStream(file, 'utf-8'))

  const dom = new JSDOM(String(content))

  for (const el of [...dom.window.document.querySelectorAll('link[rel=stylesheet]')]) {
    let href = el.getAttribute('href')

    href = path.join(href.startsWith('/') ? args.source : path.dirname(file), href)

    for (const selector of selectors) {
      if (dom.window.document.querySelector(selector) != null) {
        used.push(selector)
      }
    }
  }

  const minified = await htmlnano.process(content, { minifySvg: false })

  const minifiedHTMLStream = createWriteStream(file)

  minifiedHTMLStream.end(minified.html)

  parentPort.postMessage({ file, used })

  await streamPromise(minifiedHTMLStream)
})
