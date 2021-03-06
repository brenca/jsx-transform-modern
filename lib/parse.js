const acorn = require('acorn')
const acornJSX = require('acorn-jsx')
const acornWalk = require('acorn-walk')

const { Parser } = acorn
const JSXParser = Parser.extend(acornJSX())
const visitor = require('./visitor.js')

module.exports = {
  parse: function (code, opts) {
    const ast = JSXParser.parse(code, Object.assign({
      ecmaVersion: 8,
      sourceType: 'module',
      preserveParens: true,
    }, opts))

    // annotate node with subnodes to help with codegen
    acornWalk.fullAncestor(ast, (node, ancestors) => {
      const parent = ancestors.length > 1 ?
          ancestors[ancestors.length - 2] : null
      if (parent !== null) {
        if (parent.subnodes === undefined) {
          parent.subnodes = []
        }
        parent.subnodes.push(node)
      }
    }, visitor)

    return ast
  }
}
