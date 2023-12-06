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
    knownTagsAsString: true,
    unknownTagsAsString: false,
    arrayChildren: true,
    ecmaVersion: 8,
    filename: 'original.jsx',
    sourceMap: true
  }, o)

  if (options.factory === undefined) {
    throw new Error('Missing options.factory function name.')
  }

  const parseOptions = {
    ecmaVersion: options.ecmaVersion
  }

  const node = JSXParser.parse(code, options.filename, parseOptions)
  const codegen = new JSXCodeGenerator(code, node, options)
  
  const result = codegen.generate()
  
  if (options.sourceMap) {
    return `${result.code}\n\n${result.map}\n`
  } else {
    return `${result.code}`
  }
}

function fromFile(p, o = {}) {
  o.filename = path.basename(p)
  return fromString(fs.readFileSync(p, 'utf8'), o)
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
    
    options.filename = path.basename(filename)

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
