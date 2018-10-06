const { parentPort, workerData } = require('worker_threads')

const { parse } = require('some-js-parsing-library')
const script = workerData
parentPort.postMessage(parse(script))
