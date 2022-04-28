const acornWalk = require('acorn-walk')

const sourceMapGenerator = require('inline-source-map')

function quoteKeyName(name) {
  if (!/^[a-z_$][a-z\d_$]*$/i.test(name)) {
    return `'${name}'`
  }

  return name
}

const calculateLineAndColumn = (string, line, column) => {
  const length = string.length

  for (let i = 0; i < length; i++) {
    if (string[i] === '\n') {
      line++
      column = 0
    } else {
      column ++
    }
  }

  return { line, column }
}

const createSubnode = (node, sourceLocation, generatedLocation, subnodes = [], code = '') => {
  return {
    code,
    subnodes,
    sourceLocation,
    generatedLocation,
    source: node.loc.source
  }
}

const nullLocation = { start: null, end: null }

const flattenToString = (generator, attributes, map, line, column) => {
  const subnodes = []

  let code = ''
  let l = line
  let c = column

  const addCode = (sourcecode) => {
    const location = calculateLineAndColumn(sourcecode, l, c)
    l = location.line
    c = location.column
    code += sourcecode

    return location
  }

  const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
    const location = addCode(sourcecode)

    subnodes.push(createSubnode(
      node, sourceLocation, location, children, sourcecode))
  }

  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i]
    if (attr.code) {
      addCode(`${attr.code}`)
    } else if (attr.attr) {
      const subattr = generator.toString(attr.attr, map, l, c)
      subnodes.push(subattr)
      addSubnode(attr.node, ``, attr.node.loc.start)
      addSubnode(attr.node, subattr.code, attr.node.loc.start)
      addSubnode(attr.node, ``, attr.node.loc.end)
    } else if (attr.attributes) {
      const subattrs = flattenToString(generator, attr.attributes, map, l, c + 1)
      const subattrCode = `${subattrs.code}`

      addSubnode(attr.node, `{`, attr.node.loc.start)
      if (attr.parent) {
        attr.parent.subnodes = subattrs.subnodes

        addSubnode(attr.parent, subattrCode, attr.parent.loc.start)
      } else {
        subnodes.push(...subattrs.subnodes)
        addSubnode(attr.node, subattrCode, attr.node.loc.start)
      }
      addSubnode(attr.node, `}`, attr.node.loc.end)
    }

    if (i + 1 < attributes.length) {
      addSubnode(attr.node, `,`, attr.node.loc.end)
    }
  }

  return {
    code, subnodes
  }
}

const customHandlers = {
  JSXElement: function JSXElement(generator, node, map, line, column) {
    node.openingElement.numChildren = node.children.length
    let subnodes = []

    let code = ''
    let l = line
    let c = column

    const addCode = (sourcecode) => {
      const location = calculateLineAndColumn(sourcecode, l, c)
      l = location.line
      c = location.column
      code += sourcecode

      return location
    }

    const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
      const location = addCode(sourcecode)

      subnodes.push(createSubnode(
        node, sourceLocation, location, children, sourcecode))
    }

    const openingElement = generator.toString(node.openingElement, map, l, c)
    subnodes.push(openingElement)
    addCode(openingElement.code)

    if (node.closingElement && node.children.length > 0) {
      const s = node.openingElement.end
      const e = node.closingElement.start
      const N = node.children.length

      if (generator.arrayChildren) {
        addCode(`,[`)
      } else {
        addCode(`,`)
      }

      node.children.forEach((child, i) => {
        const gc = generator.toString(child, map, l, c)
        subnodes.push(gc)

        if (gc.code.trim().length > 0) {
          addCode(gc.code)

          if (i + 1 < node.children.length) {
            addSubnode(child, `,`, child.loc.end)
          }
        } else {
          const isEmptyExpression = child.type === 'JSXExpressionContainer' &&
              child.expression.type === 'JSXEmptyExpression'
          if (isEmptyExpression) {
            addCode(generator.source.slice(
                child.expression.start, child.expression.end))
          }
        }

        addSubnode(child, ``, child.loc.end)
      })

      if (generator.arrayChildren) {
        addCode(`])`)
      } else {
        addCode(`)`)
      }

      const closingElement = generator.toString(node.closingElement, map, l, c)
      subnodes.push(closingElement)
      addCode(closingElement.code)
    } else {
      addCode(`)`)
    }

    return {
      code,
      subnodes,
      generatedLocation: { line, column }
    }
  },
  JSXOpeningElement: function JSXOpeningElement(generator, node, map, line, column) {
    const subnodes = []

    let code = ''
    let l = line
    let c = column

    const addCode = (sourcecode) => {
      const location = calculateLineAndColumn(sourcecode, l, c)
      l = location.line
      c = location.column
      code += sourcecode

      return location
    }

    const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
      const location = addCode(sourcecode)

      subnodes.push(createSubnode(
        node, sourceLocation, location, children, sourcecode))
    }

    const header = (() => {
      const fakeMap = sourceMapGenerator({ charset: 'utf-8' })
      const name = generator.toString(node.name, fakeMap)

      const tagName = name.code
      const isJSXIdentifier = node.name.type === 'JSXIdentifier'
      const knownTag = tagName[0] !== tagName[0].toUpperCase() &&
        isJSXIdentifier

      if (knownTag || generator.passUnknownTagsToFactory) {
        addSubnode(node, `${generator.factory}(`, node.loc.start)

        addSubnode(node.name, ``, node.name.loc.start)
        if (generator.unknownTagsAsString) {
          addSubnode(node.name, `'${tagName}'`, node.name.loc.start)
        } else {
          addSubnode(node.name, `${tagName}`, node.name.loc.start)
        }
        addSubnode(node.name, ``, node.name.loc.end)

        return {
          needsComma: true
        }
      } else {
        addSubnode(node.name, ``, node.name.loc.start)
        addSubnode(
          node.name,
          `${generator.unknownTagPattern.replace('{tag}', tagName)}`,
          node.name.loc.start)
        addSubnode(node.name, `(`, null)

        return {
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
          attributes.push({ code: `{}`, node: {
            loc: nullLocation
          }})
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
          node: attr.argument
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

      addSubnode(
        attributes[0].node,
        `${header.needsComma ? ',' : ''}${generator.spread}(`,
        attributes[0].node.loc.start)

      const attrResults = flattenToString(generator, attributes, map, l, c)
      subnodes.push(...attrResults.subnodes)
      addCode(attrResults.code)

      addSubnode(
        attributes[attributes.length - 1].node,
        `)`,
        attributes[attributes.length - 1].node.loc.end)
    } else if (attributeAccumulator.length > 0) {
      addSubnode(
        attributeAccumulator[0].node,
        `${header.needsComma ? ',' : ''}{`,
        attributeAccumulator[0].node.loc.start)

      const attrResults = flattenToString(generator, attributeAccumulator, map, l, c)
      subnodes.push(...attrResults.subnodes)
      addCode(attrResults.code)

      addSubnode(
        attributeAccumulator[attributeAccumulator.length - 1].node,
        `}`,
        attributeAccumulator[attributeAccumulator.length - 1].node.loc.end)
    } else if (node.numChildren > 0) {
      addSubnode(
        node.name,
        `${header.needsComma ? ',' : ''}null`,
        node.name.loc.end)
    }

    return {
      code,
      subnodes,
      generatedLocation: { line, column }
    }
  },
  JSXClosingElement: function JSXClosingElement(generator, node, map, line, column) {
    return {
      code: '',
      generatedLocation: { line, column }
    }
  },
  JSXFragment: function JSXFragment(generator, node, map, line, column) {
    node.openingFragment.numChildren = node.children.length
    let subnodes = []

    let code = ''
    let l = line
    let c = column

    const addCode = (sourcecode) => {
      const location = calculateLineAndColumn(sourcecode, l, c)
      l = location.line
      c = location.column
      code += sourcecode

      return location
    }

    const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
      const location = addCode(sourcecode)

      subnodes.push(createSubnode(
        node, sourceLocation, location, children, sourcecode))
    }

    const openingFragment = generator.toString(node.openingFragment, map, l, c)
    subnodes.push(openingFragment)
    addCode(openingFragment.code)

    if (node.closingFragment && node.children.length > 0) {
      const s = node.openingFragment.end
      const e = node.closingFragment.start
      const N = node.children.length

      if (generator.arrayChildren) {
        addCode(`,[`)
      } else {
        addCode(`,`)
      }

      node.children.forEach((child, i) => {
        const gc = generator.toString(child, map, l, c)
        subnodes.push(gc)

        if (gc.code.trim().length > 0) {
          addCode(gc.code)

          if (i + 1 < node.children.length) {
            addCode(`,`)
          }
        } else {
          const isEmptyExpression = child.type === 'JSXExpressionContainer' &&
              child.expression.type === 'JSXEmptyExpression'
          if (isEmptyExpression) {
            addCode(generator.source.slice(
                child.expression.start, child.expression.end))
          }
        }

        addSubnode(child, '', child.loc.end)
      })

      if (generator.arrayChildren) {
        addCode(`])`)
      } else {
        addCode(`)`)
      }

      const closingFragment = generator.toString(node.closingFragment, map, l, c)
      subnodes.push(closingFragment)
      addCode(closingFragment.code)
    } else {
      addCode(`)`)
    }

    return {
      code,
      subnodes,
      generatedLocation: { line, column }
    }
  },
  JSXOpeningFragment: function JSXOpeningFragment(generator, node, map, line, column) {
    const subnodes = []

    let code = ''
    let l = line
    let c = column

    const addCode = (sourcecode) => {
      const location = calculateLineAndColumn(sourcecode, l, c)
      l = location.line
      c = location.column
      code += sourcecode

      return location
    }

    const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
      const location = addCode(sourcecode)

      subnodes.push(createSubnode(
        node, sourceLocation, location, children, sourcecode))
    }

    const header = (() => {
      addSubnode(node, `${generator.factory}(null`, node.loc.start)

      return {
        needsComma: true
      }
    })()

    const attributes = []
    let attributeAccumulator = []
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i]
      if (attr.type === 'JSXSpreadAttribute') {
        if (i === 0) {
          attributes.push({ code: `{}`, node: {
            loc: nullLocation
          }})
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
          node: attr.argument
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

      addSubnode(
        attributes[0].node,
        `${header.needsComma ? ',' : ''}${generator.spread}(`,
        attributes[0].node.loc.start)

      const attrResults = flattenToString(generator, attributes, map, l, c)
      subnodes.push(...attrResults.subnodes)
      addCode(attrResults.code)

      addSubnode(
        attributes[attributes.length - 1].node,
        `)`,
        attributes[attributes.length - 1].node.loc.end)
    } else if (attributeAccumulator.length > 0) {
      addSubnode(
        attributeAccumulator[0].node,
        `${header.needsComma ? ',' : ''}{`,
        attributeAccumulator[0].node.loc.start)

      const attrResults = flattenToString(generator, attributeAccumulator, map, l, c)
      subnodes.push(...attrResults.subnodes)
      addCode(attrResults.code)

      addSubnode(
        attributeAccumulator[attributeAccumulator.length - 1].node,
        `}`,
        attributeAccumulator[attributeAccumulator.length - 1].node.loc.end)
    } else if (node.numChildren > 0) {
      addCode(`${header.needsComma ? ',' : ''}null`)
    }

    return {
      code,
      subnodes,
      generatedLocation: { line, column }
    }
  },
  JSXClosingFragment: function JSXClosingFragment(generator, node, map, line, column) {
    return {
      code: '',
      generatedLocation: { line, column }
    }
  },
  JSXText: function JSXText(generator, node, map, line, column) {
    const fullValue = generator.source.slice(node.start, node.end)
    const lines = fullValue.split(/\r\n?|\n|\u2028|\u2029/)
    const ws = ` \f\n\r\t\v\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff`

    const originalLines = [...lines]

    lines.forEach((line, i) => {
      const trimmed = line.trim()

      if (trimmed.length !== 0) {
        lines[i] = line.replace(
          new RegExp(`^([${ws}]*)([^${ws}]+.*)$`),
          `$1${JSON.stringify('$2')}`)
      } else {
        lines[i] = ''
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

    const subnodes = []

    let code = ''
    let l = line
    let c = column

    const addCode = (sourcecode) => {
      const location = calculateLineAndColumn(sourcecode, l, c)
      l = location.line
      c = location.column
      code += sourcecode

      return location
    }

    const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
      const location = addCode(sourcecode)

      subnodes.push(createSubnode(
        node, sourceLocation, location, children, sourcecode))
    }

    addSubnode(node, ``, node.loc.start)

    lines.forEach((line, i) => {
      const location = node.loc.start

      const trimmed = line.replace(new RegExp(`^([${ws}]*)`), ``)
      if (trimmed.length > 0) {
        const column = line.split(trimmed)[0].length

        addSubnode(node, ``, {
          line: location.line + i,
          column: i === 0 ? location.column + column : column
        })
        addCode(trimmed)
      }
    })

    return {
      code,
      subnodes,
      generatedLocation: { line, column }
    }
  },
  JSXIdentifier: function JSXIdentifier(generator, node, map, line, column) {
    return {
      code: node.name,
      generatedLocation: { line, column }
    }
  },
  JSXMemberExpression: function JSXMemberExpression(generator, node, map, line, column) {
    const subnodes = []

    let code = ''
    let l = line
    let c = column

    const addCode = (sourcecode) => {
      const location = calculateLineAndColumn(sourcecode, l, c)
      l = location.line
      c = location.column
      code += sourcecode

      return location
    }

    const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
      const location = addCode(sourcecode)

      subnodes.push(createSubnode(
        node, sourceLocation, location, children, sourcecode))
    }

    const object = generator.toString(node.object, map, l, c)
    subnodes.push(object)
    addCode(object.code)

    addSubnode(node.object, `.`, null)

    const property = generator.toString(node.property, map, l, c)
    subnodes.push(property)
    addCode(property.code)

    return {
      code,
      subnodes,
      generatedLocation: { line, column }
    }
  },
  JSXAttribute: function JSXAttribute(generator, node, map, line, column) {
    const fakeMap = sourceMapGenerator({ charset: 'utf-8' })
    const name = generator.toString(node.name, fakeMap)

    const attributeName = quoteKeyName(name.code)

    const subnodes = []

    let code = ''
    let l = line
    let c = column

    const addCode = (sourcecode) => {
      const location = calculateLineAndColumn(sourcecode, l, c)
      l = location.line
      c = location.column
      code += sourcecode

      return location
    }

    const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
      const location = addCode(sourcecode)

      subnodes.push(createSubnode(
        node, sourceLocation, location, children, sourcecode))
    }

    addSubnode(node.name, attributeName, node.name.loc.start)
    addSubnode(node.name, ``, node.name.loc.end)

    addSubnode(node.name, `:`, null)

    const value = generator.toString(node.value, map, l, c)
    subnodes.push(value)
    addCode(value.code)
    addSubnode(node.value, ``, node.value.loc.end)

    return {
      code,
      subnodes,
      generatedLocation: { line, column }
    }
  },
  JSXSpreadAttribute: function JSXSpreadAttribute(generator, node, map, line, column) {
    const subnodes = []

    let code = ''
    let l = line
    let c = column

    const addCode = (sourcecode) => {
      const location = calculateLineAndColumn(sourcecode, l, c)
      l = location.line
      c = location.column
      code += sourcecode

      return location
    }

    const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
      const location = addCode(sourcecode)

      subnodes.push(createSubnode(
        node, sourceLocation, location, children, sourcecode))
    }

    addSubnode(node.argument, ``, node.argument.loc.start)
    const argument = generator.toString(node.argument, map, line, column)
    subnodes.push(argument)
    addCode(argument.code)
    addSubnode(node.argument, ``, node.argument.loc.end)

    return {
      code,
      subnodes,
      generatedLocation: { line, column }
    }
  },
  JSXNamespacedName: function JSXNamespacedName(generator, node, map, line, column) {
    const subnodes = []

    let code = ''
    let l = line
    let c = column

    const addCode = (sourcecode) => {
      const location = calculateLineAndColumn(sourcecode, l, c)
      l = location.line
      c = location.column
      code += sourcecode

      return location
    }

    const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
      const location = addCode(sourcecode)

      subnodes.push(createSubnode(
        node, sourceLocation, location, children, sourcecode))
    }

    const namespace = generator.toString(node.namespace, map, l, c)
    subnodes.push(namespace)
    addCode(namespace.code)
    addSubnode(node.namespace, ``, node.namespace.loc.end)

    addSubnode(node.namespace, `:`, null)

    const name = generator.toString(node.name, map, l, c)
    subnodes.push(name)
    addCode(name.code)
    addSubnode(node.name, ``, node.name.loc.end)

    return {
      code,
      subnodes,
      generatedLocation: { line, column }
    }
  },
  JSXExpressionContainer: function JSXExpressionContainer(generator, node, map, line, column) {
    const subnodes = []

    let code = ''
    let l = line
    let c = column

    const addCode = (sourcecode) => {
      const location = calculateLineAndColumn(sourcecode, l, c)
      l = location.line
      c = location.column
      code += sourcecode

      return location
    }

    const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
      const location = addCode(sourcecode)

      subnodes.push(createSubnode(
        node, sourceLocation, location, children, sourcecode))
    }

    const expression = generator.toString(node.expression, map, l, c)
    subnodes.push(expression)
    addCode(expression.code)
    addSubnode(node.expression, ``, node.expression.loc.end)

    return {
      code,
      subnodes,
      generatedLocation: { line, column }
    }
  },
  JSXEmptyExpression: function JSXEmptyExpression(generator, node, map, line, column) {
    return {
      code: '',
      generatedLocation: { line, column }
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
    if (tree.subnodes) {
      for (let i = 0; i < tree.subnodes.length; i++) {
        this.generateMap(tree.subnodes[i], map, line, column)
      }
    }

    if (tree.sourceLocation !== undefined) {
      map.addMappings(tree.source, [{
        original: tree.sourceLocation,
        generated: tree.generatedLocation
      }])
    }
  }

  toString (node, map, line = 1, column = 0) {
    if (node === null) {
      return {
        type: 'null',
        code: 'null',
        generatedLocation: { line, column },
        sourceLocation: null
      }
    }

    if (customHandlers[node.type]) {
      return Object.assign({ }, {
        type: node.type,
        sourceLocation: node.loc.start,
        source: node.loc.source
      }, customHandlers[node.type](this, node, map, line, column))
    }

    if (node.subnodes === undefined || node.subnodes.length === 0) {
      return {
        type: node.type,
        code: this.source.slice(node.start, node.end),
        sourceLocation: node.loc.start,
        generatedLocation: { line, column },
        source: node.loc.source
      }
    } else {
      node.subnodes.sort((a, b) => a.start - b.start)
      const s = node.start
      const e = node.end
      const N = node.subnodes.length
      const subnodes = []
      let l = line
      let c = column
      let code = ''

      const addCode = (sourcecode) => {
        const location = calculateLineAndColumn(sourcecode, l, c)
        l = location.line
        c = location.column
        code += sourcecode

        return location
      }

      const addSubnode = (node, sourcecode, sourceLocation, children = []) => {
        const location = addCode(sourcecode)

        subnodes.push(createSubnode(
          node, sourceLocation, location, children, sourcecode))
      }

      addSubnode(
        node,
        this.source.slice(s, node.subnodes[0].start),
        node.subnodes[0].loc.start)

      for (let i = 0; i < N; i++) {
        const child = node.subnodes[i]

        const childCode = this.toString(child, map, l, c)
        subnodes.push(childCode)
        addCode(childCode.code)
        addSubnode(child, ``, child.loc.end)

        if (i < N - 1) {
          addSubnode(
            child,
            this.source.slice(child.end, node.subnodes[i + 1].start),
            child.loc.end)
        }
      }

      addSubnode(
        node.subnodes[N - 1],
        this.source.slice(node.subnodes[N - 1].end, e),
        node.subnodes[N - 1].loc.end)

      return {
        type: node.type,
        code,
        subnodes,
        sourceLocation: node.loc.start,
        generatedLocation: { line, column },
        source: node.loc.source
      }
    }
  }
}

module.exports = JSXCodeGenerator
