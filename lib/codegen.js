const sourceMapGenerator = require('inline-source-map')

function quoteKeyName(name) {
  if (!/^[a-z_$][a-z\d_$]*$/i.test(name)) {
    return `'${name}'`
  }

  return name
}

const customHandlers = {
  JSXElement: function JSXElement(generator, node, map) {
    node.openingElement.numChildren = node.children.length
    let result = generator.toString(node.openingElement, map).code
    const subnodes = []

    if (node.closingElement && node.children.length > 0) {
      const s = node.openingElement.end
      const e = node.closingElement.start
      const N = node.children.length

      if (generator.arrayChildren) {
        result += `, [`
      } else {
        result += `, `
      }

      if (N > 0)
        result += generator.source.slice(s, node.children[0].start)

      let lastNonEmptyIndex = 0
      const childStrings = node.children.map((child, i) => {
        const subnode = generator.toString(child, map)
        const str = subnode.code
        subnodes.push(subnode)
        if (str.trim().length > 0)
          lastNonEmptyIndex = i

        return str
      })

      for (let i = 0; i < N; i++) {
        const child = node.children[i]
        let childString = childStrings[i]

        if (childString.trim().length > 0) {
          if (i < lastNonEmptyIndex) {
            childString += ', ' + generator.source.slice(
                child.end, node.children[i + 1].start)
          }

          result += childString
        } else {
          const isEmptyExpression = child.type === 'JSXExpressionContainer' &&
              child.expression.type === 'JSXEmptyExpression'
          if (isEmptyExpression) {
            result += generator.source.slice(
                child.expression.start, child.expression.end)
          } else {
            // this adds the whitespace that for some reason gets turned into
            // JSXText nodes
            result += childString
          }
        }
      }

      if (N > 0)
        result += generator.source.slice(node.children[N - 1].end, e)

      if (generator.arrayChildren) {
        result += `])`
      } else {
        result += `)`
      }
    } else {
      result += ')'
    }

    return {
      code: result,
      subnodes
    }
  },
  JSXOpeningElement: function JSXOpeningElement(generator, node, map) {
    const header = (() => {
      const tagName = generator.toString(node.name, map).code
      const isJSXIdentifier = node.name.type === 'JSXIdentifier'
      const knownTag = tagName[0] !== tagName[0].toUpperCase() &&
        isJSXIdentifier

      if (knownTag) {
        return {
          str: `${generator.factory}('${tagName}'`,
          needsComma: true
        }
      } else if (generator.passUnknownTagsToFactory) {
        if (generator.unknownTagsAsString) {
          return {
            str: `${generator.factory}('${tagName}'`,
            needsComma: true
          }
        } else {
          return {
            str: `${generator.factory}(${tagName}`,
            needsComma: true
          }
        }
      } else {
        return {
          str: `${generator.unknownTagPattern.replace('{tag}', tagName)}(`,
          needsComma: false
        }
      }
    })()

    const attributeStrings = []
    let attributeAccumulator = []
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i]
      if (attr.type === 'JSXSpreadAttribute') {
        if (i === 0) {
          attributeStrings.push(`{}`)
        }

        if (attributeAccumulator.length > 0) {
          attributeStrings.push(`{${attributeAccumulator.join(', ')}}`)
        }

        attributeStrings.push(generator.toString(attr, map).code)
        attributeAccumulator = []
      } else {
        attributeAccumulator.push(generator.toString(attr, map).code)
      }
    }

    if (attributeStrings.length > 0) {
      if (attributeAccumulator.length > 0)
        attributeStrings.push(`{${attributeAccumulator.join(', ')}}`)
      return header.str + (header.needsComma ? ', ' : '') +
        `${generator.spread}(${attributeStrings.join(', ')})`
    } else if (attributeAccumulator.length > 0) {
      return header.str + (header.needsComma ? ', ' : '') +
        `{${attributeAccumulator.join(', ')}}`
    } else if (node.numChildren > 0) {
      return header.str + (header.needsComma ? ', ' : '') +
        `null`
    } else {
      return header.str
    }
  },
  JSXClosingElement: function JSXClosingElement(generator, node, map) {
    return { code: '' }
  },
  JSXFragment: function JSXFragment(generator, node, map) {
    node.openingFragment.numChildren = node.children.length
    let result = `${generator.factory}(` +
                 generator.toString(node.openingFragment, map).code

    if (node.closingFragment && node.children.length > 0) {
      const s = node.openingFragment.end
      const e = node.closingFragment.start
      const N = node.children.length

      result += `, [`
      if (N > 0)
        result += generator.source.slice(s, node.children[0].start)

      for (let i = 0; i < N; i++) {
        const child = node.children[i]

        let childString = generator.toString(child, map).code
        if (childString.trim().length > 0) {
          if (i < N - 1) {
            childString += ', ' + generator.source.slice(
                child.end, node.children[i + 1].start)
          }

          result += childString
        } else {
          const isEmptyExpression = child.type === 'JSXExpressionContainer' &&
              child.expression.type === 'JSXEmptyExpression'
          if (isEmptyExpression) {
            result += generator.source.slice(
                child.expression.start, child.expression.end)
          } else {
            // this adds the whitespace that for some reason gets turned into
            // JSXText nodes
            result += childString
          }
        }
      }

      if (N > 0)
        result += generator.source.slice(node.children[N - 1].end, e)
      result += `])`
    } else {
      result += ')'
    }

    return result
  },
  JSXOpeningFragment: function JSXOpeningFragment(generator, node, map) {
    const attributeStrings = []
    let attributeAccumulator = []
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i]
      if (attr.type === 'JSXSpreadAttribute') {
        if (i === 0) {
          attributeStrings.push(`{}`)
        }

        if (attributeAccumulator.length > 0) {
          attributeStrings.push(`{${attributeAccumulator.join(', ')}}`)
        }

        attributeStrings.push(generator.toString(attr, map).code)
        attributeAccumulator = []
      } else {
        attributeAccumulator.push(generator.toString(attr, map).code)
      }
    }

    if (attributeStrings.length > 0) {
      if (attributeAccumulator.length > 0)
        attributeStrings.push(`{${attributeAccumulator.join(', ')}}`)
      return `null, ${generator.spread}(${attributeStrings.join(', ')})`
    } else if (attributeAccumulator.length > 0) {
      return `null, {${attributeAccumulator.join(', ')}}`
    } else if (node.numChildren > 0) {
      return `null, null`
    } else {
      return `null`
    }
  },
  JSXClosingFragment: function JSXClosingFragment(generator, node, map) {
    return ''
  },
  JSXText: function JSXText(generator, node, map) {
    const lines = node.value.split(/\r\n?|\n|\u2028|\u2029/)
    const ws = ` \f\n\r\t\v\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff`

    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (i === 0) {
        if (trimmed.length !== 0) lines[i] = JSON.stringify(line)
      } else {

        lines[i] = line.replace(
          new RegExp(`^([${ws}]*)([^${ws}]+.*)$`),
          `$1${JSON.stringify('$2')}`)
      }
    })

    let hasFollowingNonEmpty = false
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim()
      if (trimmed.length > 0) {
        if (hasFollowingNonEmpty) {
          lines[i] += ` + ' ' +`
        } else {
          hasFollowingNonEmpty = true
        }
      }
    }

    return lines.join(`\n`)
  },
  JSXIdentifier: function JSXIdentifier(generator, node, map) {
    return node.name
  },
  JSXMemberExpression: function JSXMemberExpression(generator, node, map) {
    return `${generator.toString(node.object, map).code}.` +
           `${generator.toString(node.property, map).code}`
  },
  JSXAttribute: function JSXAttribute(generator, node, map) {
    return `${quoteKeyName(generator.toString(node.name, map).code)}: ${generator.toString(node.value, map).code}`
  },
  JSXSpreadAttribute: function JSXSpreadAttribute(generator, node, map) {
    return `${generator.toString(node.argument, map).code}`
  },
  JSXNamespacedName: function JSXNamespacedName(generator, node, map) {
    return `${generator.toString(node.namespace, map).code}:` +
           `${generator.toString(node.name, map).code}`
  },
  JSXExpressionContainer: function JSXExpressionContainer(generator, node, map) {
    return generator.toString(node.expression, map).code
  },
  JSXEmptyExpression: function JSXEmptyExpression(generator, node, map) {
    return ''
  }
}

class JSXCodeGenerator {
  constructor(source, ast, options) {
    this.source = source
    this.ast = ast
    this.options = options
  }

  get factory () {
    return this.options.factory
  }

  get spread () {
    return this.options.spreadFn
  }

  get unknownTagPattern () {
    return this.options.unknownTagPattern
  }

  get passUnknownTagsToFactory () {
    return this.options.passUnknownTagsToFactory
  }

  get unknownTagsAsString () {
    return this.options.unknownTagsAsString
  }

  get arrayChildren () {
    return this.options.arrayChildren
  }

  generate () {
    const map = sourceMapGenerator({ charset: 'utf-8' })
    map.addSourceContent(this.options.filename, this.source)
    
    const result = this.toString(this.ast, map)
    this.generateMap(result, map);
    
    
    // console.log(map.generator._mappings);
    
    return result.code
  }
  
  generateMap (tree, map, line = 1, column = 0) {
    if (tree.sourceLocation !== undefined) {
      console.log( line );
      console.log( tree.code );
      
      map.addMappings(tree.source, [{ 
        original: tree.sourceLocation,
        generated: { line, column }
      }])
    } else {
    }
    
    if (tree.subnodes) {
      for (let i = 0; i < tree.subnodes.length; i++) {
        const end = this.generateMap(tree.subnodes[i], map, line, column);
        line = end.line
        column = end.column
      }
    }
    
    const splitLines = tree.code.split('\n')
    
    const endLine = line + splitLines.length - 1
    const endColumn = (() => {
      if (splitLines.length === 1) {
        return column + splitLines[splitLines.length - 1].length
      } else {
        return splitLines[splitLines.length - 1].length
      }
    })()
    
    return { line: endLine, column: endColumn }
  }

  toString (node, map) {
    if (node === null) {
      return { code: 'null' }
    }

    if (customHandlers[node.type]) {
      return {
        code: customHandlers[node.type](this, node, map),
        sourceLocation: node.loc.start,
        source: node.loc.source
      }
    }

    if (node.subnodes === undefined) {
      const result = this.source.slice(node.start, node.end)

      return {
        code: this.source.slice(node.start, node.end),
        sourceLocation: node.loc.start,
        source: node.loc.source
      }
    } else {
      node.subnodes.sort((a, b) => a.start - b.start)
      const s = node.start
      const e = node.end
      const N = node.subnodes.length

      const subnodes = []
      subnodes.push({
        code: this.source.slice(s, node.subnodes[0].start)
      })
      
      for (let i = 0; i < N; i++) {
        const child = node.subnodes[i]
        subnodes.push(this.toString(child, map, node))
        if (i < N - 1) {
          subnodes.push({
            code: this.source.slice(child.end, node.subnodes[i + 1].start)
          })
        }
      }
      
      subnodes.push({
        code: this.source.slice(node.subnodes[N - 1].end, e)
      })

      return {
        code: subnodes.map(sn => sn.code).join(''),
        subnodes,
        sourceLocation: node.loc.start,
        source: node.loc.source
      }
    }
  }
}

module.exports = JSXCodeGenerator
