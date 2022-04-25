const acornWalk = require('acorn-walk')
const visitor = require('./visitor.js')

const sourceMapGenerator = require('inline-source-map')

function quoteKeyName(name) {
  if (!/^[a-z_$][a-z\d_$]*$/i.test(name)) {
    return `'${name}'`
  }

  return name
}

const flattenToString = (generator, attributes, map, preString) => {
  let codeSoFar = preString
  let code = ''
  const subnodes = []
  
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i]
    if (attr.code) {
      subnodes.push({
        code: '',
        sourceLocation: attr.node.loc.start,
        preString: codeSoFar,
        source: attr.node.loc.source
      })
      
      codeSoFar += `${attr.code}`
      code += `${attr.code}`
      
      subnodes.push({
        code: '',
        sourceLocation: attr.node.loc.end,
        preString: codeSoFar,
        source: attr.node.loc.source
      })

      if (i + 1 < attributes.length) {
        codeSoFar += ','
        code += ','
      }
    } else if (attr.attr) {
      const subattr = generator.toString(attr.attr, map, codeSoFar)
      
      subnodes.push(subattr)
      subnodes.push({
        code: '',
        sourceLocation: attr.node.loc.start,
        preString: codeSoFar,
        source: attr.node.loc.source
      })
      
      codeSoFar += `${subattr.code}`
      code += `${subattr.code}`
      
      subnodes.push({
        code: '',
        sourceLocation: attr.node.loc.end,
        preString: codeSoFar,
        source: attr.node.loc.source
      })
      
      if (i + 1 < attributes.length) {
        codeSoFar += ','
        code += ','
      }
    } else if (attr.attributes) {
      codeSoFar += `{`
      code += `{`
      const subattrs = flattenToString(generator, attr.attributes, map, codeSoFar)
      
      if (attr.parent) {
        attr.parent.subnodes = subattrs.subnodes
      } else {
        subnodes.push(...subattrs.subnodes)
      }
      
      subnodes.push({
        code: '',
        sourceLocation: attr.node.loc.start,
        preString: codeSoFar,
        source: attr.node.loc.source
      })

      codeSoFar += `${subattrs.code}`
      code += `${subattrs.code}`
      
      subnodes.push({
        code: '',
        sourceLocation: attr.node.loc.start,
        preString: codeSoFar,
        source: attr.node.loc.source
      })
      
      codeSoFar += `}`
      code += `}`
      
      subnodes.push({
        code: '',
        sourceLocation: attr.node.loc.end,
        preString: codeSoFar,
        source: attr.node.loc.source
      })
      
      if (i + 1 < attributes.length) {
        codeSoFar += ','
        code += ','
      }
    }
  }
  
  return {
    code, subnodes
  }
}

const customHandlers = {
  JSXElement: function JSXElement(generator, node, map, preString) {
    node.openingElement.numChildren = node.children.length
    let subnodes = []
    let openingElement = generator.toString(node.openingElement, map, preString)
    subnodes.push(openingElement)
    let result = openingElement.code

    if (node.closingElement && node.children.length > 0) {
      const s = node.openingElement.end
      const e = node.closingElement.start
      const N = node.children.length

      if (generator.arrayChildren) {
        result += `,[`
      } else {
        result += `,`
      }
      
      let isFirst = true
      node.children.forEach((child, i) => {
        const gc = generator.toString(child, map, preString + result)
        subnodes.push(gc)
        
        if (gc.code.trim().length > 0) {
          if (i + 1 === node.children.length) {
            result += gc.code
          } else {
            result += gc.code + ','
          }
        } else {
          const isEmptyExpression = child.type === 'JSXExpressionContainer' &&
              child.expression.type === 'JSXEmptyExpression'
          if (isEmptyExpression) {
            result += generator.source.slice(
                child.expression.start, child.expression.end)
          }
        }
        
        subnodes.push({
          code: '',
          sourceLocation: child.loc.end,
          preString: preString + result,
          source: child.loc.source
        })
        
        isFirst = false
      })

      if (generator.arrayChildren) {
        result += `])`
      } else {
        result += `)`
      }
      
      subnodes.push(generator.toString(node.closingElement, map, preString + result))
    } else {
      result += ')'
    }

    return {
      code: result,
      subnodes,
      preString
    }
  },
  JSXOpeningElement: function JSXOpeningElement(generator, node, map, preString) {
    const fakeMap = sourceMapGenerator({ charset: 'utf-8' })
    const name = generator.toString(node.name, fakeMap, '')
    const subnodes = []
    const header = (() => {
      const tagName = name.code
      const isJSXIdentifier = node.name.type === 'JSXIdentifier'
      const knownTag = tagName[0] !== tagName[0].toUpperCase() &&
        isJSXIdentifier
      let str = ''

      if (knownTag) {
        str += `${generator.factory}`
        subnodes.push({
          code: '',
          sourceLocation: node.loc.start,
          preString: preString + str,
          source: node.loc.source
        })
        
        
        str += `(`
        subnodes.push({
          code: '',
          sourceLocation: node.loc.start,
          preString: preString + str,
          source: node.loc.source
        })
        
        subnodes.push(generator.toString(node.name, map, preString + str))
        
        str += `'${tagName}'`
        subnodes.push({
          code: '',
          sourceLocation: node.name.loc.start,
          preString: preString + str,
          source: node.name.loc.source
        })
      
        return {
          str,
          needsComma: true
        }
      } else if (generator.passUnknownTagsToFactory) {
        if (generator.unknownTagsAsString) {
          str += `${generator.factory}`
          subnodes.push({
            code: '',
            sourceLocation: node.loc.start,
            preString: preString + str,
            source: node.loc.source
          })
          
          str += `(`
          subnodes.push({
            code: '',
            sourceLocation: node.loc.start,
            preString: preString + str,
            source: node.loc.source
          })
          
          subnodes.push(generator.toString(node.name, map, preString + str))
          
          subnodes.push({
            code: '',
            sourceLocation: node.name.loc.start,
            preString: preString + str,
            source: node.name.loc.source
          })
          str += `'${tagName}'`
          subnodes.push({
            code: '',
            sourceLocation: node.name.loc.end,
            preString: preString + str,
            source: node.name.loc.source
          })
          
          return {
            str,
            needsComma: true
          }
        } else {
          let str = ''
          
          str += `${generator.factory}`
          subnodes.push({
            code: '',
            sourceLocation: node.loc.start,
            preString: preString + str,
            source: node.loc.source
          })
          
          str += `(`
          subnodes.push({
            code: '',
            sourceLocation: node.loc.start,
            preString: preString + str,
            source: node.loc.source
          })
          
          subnodes.push(generator.toString(node.name, map, preString + str))
          
          subnodes.push({
            code: '',
            sourceLocation: node.name.loc.start,
            preString: preString + str,
            source: node.name.loc.source
          })
          str += `${tagName}`
          subnodes.push({
            code: '',
            sourceLocation: node.name.loc.end,
            preString: preString + str,
            source: node.name.loc.source
          })
          
          return {
            str,
            needsComma: true
          }
        }
      } else {
        subnodes.push(generator.toString(node.name, map, preString + str))

        subnodes.push({
          code: '',
          sourceLocation: node.name.loc.start,
          preString: preString + str,
          source: node.name.loc.source
        })
        str += `${generator.unknownTagPattern.replace('{tag}',tagName)}`
        subnodes.push({
          code: '',
          sourceLocation: node.name.loc.end,
          preString: preString + str,
          source: node.name.loc.source
        })
        
        str += `(`
        subnodes.push({
          code: '',
          sourceLocation: node.loc.start,
          preString: preString + str,
          source: node.loc.source
        })
        
        return {
          str,
          needsComma: false
        }
      }
    })()

    const attributes = []
    let attributeAccumulator = []
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i]
      if (attr.type === 'JSXSpreadAttribute') {
        if (i === 0) {
          attributes.push({ code: `{}`, node: attr })
        }

        if (attributeAccumulator.length > 0) {
          attributes.push({ 
            parent: attr, 
            node: attr,
            attributes: [...attributeAccumulator] 
          })
        }

        attributes.push({ 
          attr,
          node: attr
        })
        attributeAccumulator = []
      } else {
        attributeAccumulator.push({ 
          attr,
          node: attr
        })
      }
    }

    if (attributes.length > 0) {
      if (attributeAccumulator.length > 0) {
        attributes.push({ 
          attributes: [...attributeAccumulator],
          node: attributeAccumulator[0].node
        })
      }
      
      let code = header.str + (header.needsComma ? ',' : '') +
          `${generator.spread}(`
      subnodes.push({
        code: '',
        sourceLocation: node.name.loc.end,
        preString: preString + header.str,
        source: node.name.loc.source
      })
      const result = flattenToString(generator, attributes, map, preString + code)
      subnodes.push(...result.subnodes)
      code += result.code
      subnodes.push({
        code: '',
        sourceLocation: node.name.loc.end,
        preString: preString + code,
        source: node.name.loc.source
      })
      code += `)`
      
      return { 
        code,
        subnodes,
        preString: preString
      }  
    } else if (attributeAccumulator.length > 0) {
      let code = header.str + (header.needsComma ? ',' : '') + `{`
      subnodes.push({
        code: '',
        sourceLocation: node.name.loc.end,
        preString: preString + header.str,
        source: node.name.loc.source
      })
      const result = flattenToString(generator, attributeAccumulator, map, preString + code)
      subnodes.push(...result.subnodes)
      code += result.code
      subnodes.push({
        code: '',
        sourceLocation: node.name.loc.end,
        preString: preString + code,
        source: node.name.loc.source
      })
      code += `}`
      
      return { 
        code,
        subnodes,
        preString: preString
      }  
    } else if (node.numChildren > 0) {
      subnodes.push({
        code: '',
        sourceLocation: node.name.loc.end,
        preString: preString + header.str,
        source: node.name.loc.source
      })
      
      return { 
        code: header.str + (header.needsComma ? ',' : '') + `null`,
        subnodes,
        preString: preString
      }  
    } else {
      subnodes.push({
        code: '',
        sourceLocation: node.name.loc.end,
        preString: preString + header.str,
        source: node.name.loc.source
      })
      
      return { 
        code: header.str,
        subnodes,
        preString: preString
      }
    }
  },
  JSXClosingElement: function JSXClosingElement(generator, node, map, preString) {
    return { 
      code: '',
      preString
    }
  },
  JSXFragment: function JSXFragment(generator, node, map, preString) {
    node.openingFragment.numChildren = node.children.length
    let subnodes = []
    let openingFragment = generator.toString(node.openingFragment, map, preString)
    subnodes.push(openingFragment)
    let result = `${generator.factory}`
    subnodes.push({
      code: '',
      sourceLocation: node.openingFragment.loc.start,
      preString: preString + result,
      source: node.openingFragment.loc.source
    })
    result += '(' + openingFragment.code

    if (node.closingFragment && node.children.length > 0) {
      const s = node.openingFragment.end
      const e = node.closingFragment.start
      const N = node.children.length

      result += `,[`

      node.children.forEach((child, i) => {
        const gc = generator.toString(child, map, preString + result)
        subnodes.push(gc)
        
        if (gc.code.trim().length > 0) {
          if (i + 1 === node.children.length) {
            result += gc.code
          } else {
            result += gc.code + ','
          }
        } else {
          const isEmptyExpression = child.type === 'JSXExpressionContainer' &&
              child.expression.type === 'JSXEmptyExpression'
          if (isEmptyExpression) {
            result += generator.source.slice(
                child.expression.start, child.expression.end)
          }
        }
      })

      result += `])`
      
      subnodes.push(generator.toString(node.closingFragment, map, preString + result))
    } else {
      result += ')'
    }

    return {
      code: result,
      subnodes,
      preString: preString
    }
  },
  JSXOpeningFragment: function JSXOpeningFragment(generator, node, map, preString) {
    const attributes = []
    const subnodes = []
    let attributeAccumulator = []
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i]
      if (attr.type === 'JSXSpreadAttribute') {
        if (i === 0) {
          attributes.push({ code: `{}`, node: attr })
        }

        if (attributeAccumulator.length > 0) {
          attributes.push({ 
            parent: attr,
            node: attr, 
            attributes: [...attributeAccumulator]
          })
        }

        attributes.push({ 
          attr,
          node: attr
        })
        attributeAccumulator = []
      } else {
        attributeAccumulator.push({ 
          attr,
          node: attr 
        })
      }
    }

    if (attributes.length > 0) {
      if (attributeAccumulator.length > 0) {
        attributes.push({ 
          attributes: [...attributeAccumulator],
          node: attributeAccumulator[0].node 
        })
      }
      
      let code = `null,`
      subnodes.push({
        code: '',
        sourceLocation: node.loc.end,
        preString: preString + code,
        source: node.loc.source
      })
      code += `${generator.spread}`
      subnodes.push({
        code: '',
        sourceLocation: node.loc.end,
        preString: preString + code,
        source: node.loc.source
      })
      code += '('
      subnodes.push({
        code: '',
        sourceLocation: node.loc.end,
        preString: preString + code,
        source: node.loc.source
      })
      const result = flattenToString(generator, attributes, map, preString + code)
      subnodes.push(...result.subnodes)
      code += result.code
      subnodes.push({
        code: '',
        sourceLocation: node.loc.end,
        preString: preString + code,
        source: node.loc.source
      })
      code += `)`
      
      return { 
        code,
        subnodes,
        preString: preString
      }  
    } else if (attributeAccumulator.length > 0) {
      let code = `null,{`
      subnodes.push({
        code: '',
        sourceLocation: node.loc.end,
        preString: preString + code,
        source: node.loc.source
      })
      code += `,{`
      subnodes.push({
        code: '',
        sourceLocation: node.loc.end,
        preString: preString + code,
        source: node.loc.source
      })
      const result = flattenToString(generator, attributeAccumulator, map, preString + code)
      subnodes.push(...result.subnodes)
      code += result.code
      subnodes.push({
        code: '',
        sourceLocation: node.loc.end,
        preString: preString + code,
        source: node.loc.source
      })
      code += `}`
      
      return {
        code,
        subnodes,
        preString: preString
      }
    } else if (node.numChildren > 0) {
      subnodes.push({
        code: '',
        sourceLocation: node.loc.end,
        preString: preString + `null,null`,
        source: node.loc.source
      })
      
      return {
        code: `null,null`,
        subnodes,
        preString: preString
      }
    } else {
      subnodes.push({
        code: '',
        sourceLocation: node.loc.end,
        preString: preString + `null`,
        source: node.loc.source
      })
      
      return {
        code: `null`,
        subnodes,
        preString: preString
      }
    }
  },
  JSXClosingFragment: function JSXClosingFragment(generator, node, map, preString) {
    return { 
      code: '',
      preString
    }
  },
  JSXText: function JSXText(generator, node, map, preString) {
    const fullValue = generator.source.slice(node.start, node.end)
    const lines = fullValue.split(/\r\n?|\n|\u2028|\u2029/)
    const ws = ` \f\n\r\t\v\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff`
    
    const originalLines = [...lines]

    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (i === 0) {
        if (trimmed.length !== 0) lines[i] = JSON.stringify(line)
      } else {
        if (trimmed.length !== 0) {
          lines[i] = line.replace(
            new RegExp(`^([${ws}]*)([^${ws}]+.*)$`),
            `$1${JSON.stringify('$2')}`)
        } else {
          lines[i] = ''
        }
      }
    })

    let hasFollowingNonEmpty = false
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim()
      if (trimmed.length > 0) {
        if (hasFollowingNonEmpty) {
          lines[i] += `+' '+`
        } else {
          hasFollowingNonEmpty = true
        }
      }
    }
    
    let code = ''
    const subnodes = []
    lines.forEach((line, i) => {
      const location = node.loc.start
      
      const trimmed = line.replace(new RegExp(`^([${ws}]*)`), ``)
      if (trimmed.length > 0) {
        const column = line.split(trimmed)[0].length
        subnodes.push({
          code: '',
          sourceLocation: {
            line: location.line + i,
            column: i > 0 ? column : location.column
          },
          preString: preString + code,
          source: node.loc.source
        })
        
        code += trimmed
      }
    })

    return { 
      code,
      subnodes,
      preString: preString
    }
  },
  JSXIdentifier: function JSXIdentifier(generator, node, map, preString) {
    return { 
      code: node.name,
      preString: preString
    }
  },
  JSXMemberExpression: function JSXMemberExpression(generator, node, map, preString) {
    let code = ''
    
    const object = generator.toString(node.object, map, preString + code)
    code += `${object.code}.`
    const property = generator.toString(node.property, map, preString + code)
    code += `${property.code}`
    
    return {
      code,
      subnodes: [object, property],
      preString: preString
    }
  },
  JSXAttribute: function JSXAttribute(generator, node, map, preString) {
    let code = ''
    
    const name = generator.toString(node.name, map, preString + code)
    code += `${quoteKeyName(name.code)}:`
    const value = generator.toString(node.value, map, preString + code)
    code += `${value.code}`
    
    return {
      code,
      subnodes: [name, value],
      preString: preString
    }
  },
  JSXSpreadAttribute: function JSXSpreadAttribute(generator, node, map, preString) {
    let code = ''
    
    const argument = generator.toString(node.argument, map, preString)
    code += `${argument.code}`
    
    return {
      code,
      subnodes: [argument],
      preString: preString
    }
  },
  JSXNamespacedName: function JSXNamespacedName(generator, node, map, preString) {
    let code = ''
    
    const namespace = generator.toString(node.namespace, map, preString + code)
    code += `${namespace.code}:`
    const name = generator.toString(node.name, map, preString + code)
    code += `${name.code}`
    
    return {
      code,
      subnodes: [namespace, name],
      preString: preString
    }
  },
  JSXExpressionContainer: function JSXExpressionContainer(generator, node, map, preString) {
    const expression = generator.toString(node.expression, map, preString)
    return {
      code: expression.code,
      subnodes: [expression],
      preString: preString
    }
  },
  JSXEmptyExpression: function JSXEmptyExpression(generator, node, map, preString) {
    return { 
      code: '',
      preString
    }
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
    
    return {
      code: result.code,
      map: map.inlineMappingUrl()
    }
  }
  
  generateMap (tree, map, line = 1, column = 0) {
    const ol = line 
    const oc = column

    if (tree.preString !== undefined) {
      const splitLines = tree.preString.split('\n')
      line += splitLines.length - 1
      if (splitLines.length === 1) {
        column = column + splitLines[splitLines.length - 1].length
      } else {
        column = splitLines[splitLines.length - 1].length
      }
    }
    
    if (tree.subnodes) {
      for (let i = 0; i < tree.subnodes.length; i++) {
        this.generateMap(tree.subnodes[i], map, ol, oc)
      }
    }
    
    if (tree.sourceLocation !== undefined) {
      map.addMappings(tree.source, [{ 
        original: tree.sourceLocation,
        generated: { line, column }
      }])
    }
  }

  toString (node, map, preString) {
    if (preString === undefined) {
      preString = ''
    }

    if (node === null) {
      return { 
        type: 'null',
        code: 'null',
        preString,
      }
    }

    if (customHandlers[node.type]) {
      return Object.assign({ }, {
        type: node.type,
        sourceLocation: node.loc.start,
        preString,
        source: node.loc.source
      }, customHandlers[node.type](this, node, map, preString))
    }

    if (node.subnodes === undefined) {
      return {
        type: node.type,
        code: this.source.slice(node.start, node.end),
        sourceLocation: node.loc.start,
        preString: preString,
        source: node.loc.source
      }
    } else {
      node.subnodes.sort((a, b) => a.start - b.start)
      const s = node.start
      const e = node.end
      const N = node.subnodes.length
      let stringSoFar = ''

      const subnodes = []
      subnodes.push({
        code: this.source.slice(s, node.subnodes[0].start),
        preString: preString + stringSoFar,
        sourceLocation: node.loc.start,
        source: node.loc.source
      })
      stringSoFar += this.source.slice(s, node.subnodes[0].start)
      
      for (let i = 0; i < N; i++) {
        const child = node.subnodes[i]
        const code = this.toString(child, map, preString + stringSoFar)
        subnodes.push(code)
        stringSoFar += code.code
        if (i < N - 1) {
          subnodes.push({
            code: this.source.slice(child.end, node.subnodes[i + 1].start),
            preString: preString + stringSoFar,
            sourceLocation: child.loc.end,
            source: child.loc.source
          })
          stringSoFar += this.source.slice(child.end, node.subnodes[i + 1].start)
        }
      }
      
      subnodes.push({
        code: this.source.slice(node.subnodes[N - 1].end, e),
        preString: preString + stringSoFar,
        sourceLocation: node.subnodes[N - 1].loc.end,
        source: node.subnodes[N - 1].loc.source
      })
      stringSoFar += this.source.slice(node.subnodes[N - 1].end, e)

      return {
        type: node.type,
        code: subnodes.map(sn => sn.code).join(''),
        subnodes,
        sourceLocation: node.loc.start,
        preString,
        source: node.loc.source
      }
    }
  }
}

module.exports = JSXCodeGenerator
