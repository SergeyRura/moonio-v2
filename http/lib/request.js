
class Request {
  constructor (socket, opts) {
    this.url = opts.url
    this.socket = socket

    this._options = opts
    this._headers = null

    this.ondata = noop
    this.onend = noop
  }

  getAllHeaders () {
    if (!this._headers) this._headers = indexHeaders(this._options.headers)
    return this._headers
  }

  getHeader (name) {
    return this.getAllHeaders().get(name.toLowerCase())
  }
}

function noop () {}

function indexHeaders (headers) {
  const map = new Map()
  for (var i = 0; i < headers.length; i += 2) map.set(headers[i].toLowerCase(), headers[i + 1])
  return map
}

module.exports = Request
