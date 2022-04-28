const acorn = require('acorn')
const acornJSX = require('acorn-jsx')
const acornWalk = require('acorn-walk')

const { Parser } = acorn
const JSXParser = Parser.extend(acornJSX())
const visitor = require('./visitor.js')

module.exports = {
  parse: function (code, filename, opts) {
    const ast = JSXParser.parse(code, Object.assign({
      ecmaVersion: 8,
      sourceType: 'module',
      preserveParens: true,
      locations: true,
      allowHashBang: true,
      sourceFile: filename,
    }, opts))

    // annotate node with subnodes to help with codegen
    acornWalk.fullAncestor(ast, (node, ancestors) => {
      const source = code.slice(node.start, node.end)
      if (source.trim().length > 0) {
        const whitespaces = source.split(source.trim())

        if (node.type === 'JSXText') {
          node.value = node.value.trim()
        } else {
          node.start += whitespaces[0].length
          node.end -= whitespaces[1].length
        }
      }

      const parent = ancestors.length > 1 ?
          ancestors[ancestors.length - 2] : null
      if (parent !== null) {
        if (parent.subnodes === undefined) {
          parent.subnodes = []
        }
        parent.subnodes.push(node)
      }
    }, visitor(code))

    return ast
  }
}
