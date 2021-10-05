const fs = require('fs')
const path = require('path')
const through = require('through2')

const JSXParser = require('./lib/parse.js')
const JSXCodeGenerator = require('./lib/codegen.js')

function fromString(code, o = {}) {
  const options = Object.assign({
    spreadFn: `Object.assign`,
    unknownTagPattern: `{tag}`,
    passUnknownTagsToFactory: false,
    unknownTagsAsString: false,
    arrayChildren: true
  }, o)

  if (options.factory === undefined) {
    throw new Error('Missing options.factory function name.')
  }

  const codegen = new JSXCodeGenerator(code, JSXParser.parse(code), options)
  return codegen.generate()
}

function fromFile(path, o = {}) {
  return fromString(fs.readFileSync(path, 'utf8'), o)
}

function browserifyTransform(filename, options) {
  return browserifyTransform.configure(options)(filename)
}

browserifyTransform.configure = function (options) {
  if (typeof options.extensions === 'undefined') {
    options.extensions = ['.js', '.jsx', '.es', '.es6']
  }

  return function (filename) {
    if (!~options.extensions.indexOf(path.extname(filename))) {
      return through()
    }

    var data = "";

    return through(function (chunk, enc, next) {
      data += chunk.toString('utf8')
      next()
    }, function (next) {
      try {
        this.push(fromString(data, options))
        next()
      } catch (err) {
        next(err)
      }
    })
  }
}

module.exports = {
  fromString, fromFile, browserifyTransform
}
