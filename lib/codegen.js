function quoteKeyName(name) {
  if (!/^[a-z_$][a-z\d_$]*$/i.test(name)) {
    return `'${name}'`
  }

  return name
}

const customHandlers = {
  JSXElement: function JSXElement(generator, node) {
    node.openingElement.numChildren = node.children.length
    let result = generator.toString(node.openingElement)

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
        const str = generator.toString(child)
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

    return result
  },
  JSXOpeningElement: function JSXOpeningElement(generator, node) {
    const header = (() => {
      const tagName = generator.toString(node.name)
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

        attributeStrings.push(generator.toString(attr))
        attributeAccumulator = []
      } else {
        attributeAccumulator.push(generator.toString(attr))
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
  JSXClosingElement: function JSXClosingElement(generator, node) {
    return ''
  },
  JSXFragment: function JSXFragment(generator, node) {
    node.openingFragment.numChildren = node.children.length
    let result = `${generator.factory}(` +
                 generator.toString(node.openingFragment)

    if (node.closingFragment && node.children.length > 0) {
      const s = node.openingFragment.end
      const e = node.closingFragment.start
      const N = node.children.length

      result += `, [`
      if (N > 0)
        result += generator.source.slice(s, node.children[0].start)

      for (let i = 0; i < N; i++) {
        const child = node.children[i]

        let childString = generator.toString(child)
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
  JSXOpeningFragment: function JSXOpeningFragment(generator, node) {
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

        attributeStrings.push(generator.toString(attr))
        attributeAccumulator = []
      } else {
        attributeAccumulator.push(generator.toString(attr))
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
  JSXClosingFragment: function JSXClosingFragment(generator, node) {
    return ''
  },
  JSXText: function JSXText(generator, node) {
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
  JSXIdentifier: function JSXIdentifier(generator, node) {
    return node.name
  },
  JSXMemberExpression: function JSXMemberExpression(generator, node) {
    return `${generator.toString(node.object)}.` +
           `${generator.toString(node.property)}`
  },
  JSXAttribute: function JSXAttribute(generator, node) {
    return `${quoteKeyName(generator.toString(node.name))}: ${generator.toString(node.value)}`
  },
  JSXSpreadAttribute: function JSXSpreadAttribute(generator, node) {
    return `${generator.toString(node.argument)}`
  },
  JSXNamespacedName: function JSXNamespacedName(generator, node) {
    return `${generator.toString(node.namespace)}:` +
           `${generator.toString(node.name)}`
  },
  JSXExpressionContainer: function JSXExpressionContainer(generator, node) {
    return generator.toString(node.expression)
  },
  JSXEmptyExpression: function JSXEmptyExpression(generator, node) {
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
    return this.toString(this.ast)
  }

  toString (node) {
    if (customHandlers[node.type]) {
      return customHandlers[node.type](this, node)
    }

    if (node.subnodes === undefined) {
      return this.source.slice(node.start, node.end)
    } else {
      node.subnodes.sort((a, b) => a.start - b.start)
      const s = node.start
      const e = node.end
      const N = node.subnodes.length

      let result = this.source.slice(s, node.subnodes[0].start)
      for (let i = 0; i < N; i++) {
        const child = node.subnodes[i]
        result += this.toString(child)
        if (i < N - 1) {
          result += this.source.slice(child.end, node.subnodes[i + 1].start)
        }
      }
      result += this.source.slice(node.subnodes[N - 1].end, e)

      return result
    }
  }
}

module.exports = JSXCodeGenerator
