const httpStatus = require('../http-status')

const SEP = ': '
const EOL = '\r\n'
const HEADER_CHUNKED = Buffer.from('Transfer-Encoding: chunked\r\n')
const HEADER_KEEP_ALIVE = Buffer.from('Connection: keep-alive\r\n')
const CONTENT_LENGTH = /^Content-Length$/i
const CONNECTION = /^Connection$/i

class Response {
  constructor (server, socket, headers) {
    this.server = server
    this.socket = socket
    this.statusCode = 200
    this.headerSent = false

    this._headers = headers
    this._headersLength = 0
    this._keepAlive = true
    this._chunked = true
    this._reuseChunkHeader = server._reuseChunkHeader
    this._reuseChunk = server._reuseChunk
  }

  setHeader (name, value) {
    const header = name + SEP + value + EOL
    this._headers.asciiWrite(header, this._headersLength, header.length)
    this._headersLength += header.length

    if (CONTENT_LENGTH.test(name)) this._chunked = false
    else if (CONNECTION.test(name)) this._keepAlive = false
  }

  _appendHeader (buf) {
    buf.copy(this._headers, this._headersLength)
    this._headersLength += buf.length
  }

  _flushHeaders () {
    this.headerSent = true
    if (this._keepAlive) this._appendHeader(HEADER_KEEP_ALIVE)
    if (this._chunked) this._appendHeader(HEADER_CHUNKED)
    this._headers.asciiWrite(EOL, this._headersLength)
  }

  _writeHeader (buf, n) {
    this._flushHeaders()

    const status = httpStatus[this.statusCode]

    this.socket.writev(
      [status, this._headers, buf],
      [status.length, this._headersLength + 2, n]
    )
  }

  write (buf) {
    this._writeHeader(buf, buf.length)
  }
}

module.exports = Response
