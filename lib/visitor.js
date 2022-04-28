const acornWalk = require('acorn-walk')

const ignore = Function.prototype

module.exports = acornWalk.make({
  JSXElement: (node, state, visit) => {
    visit(node.openingElement, state, node.openingElement.type)
    if (node.closingElement) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        visit(child, state, child.type)
      }
      visit(node.closingElement, state, node.closingElement.type)
    }
  },
  JSXOpeningElement: (node, state, visit) => {
    visit(node.name, state, node.name.type)
    for (let i = 0; i < node.attributes.length; i++) {
      const attribute = node.attributes[i]
      visit(attribute, state, attribute.type)
    }
  },
  JSXClosingElement: ignore,
  JSXFragment: (node, state, visit) => {
    visit(node.openingFragment, state, node.openingFragment.type)
    if (node.closingFragment) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        visit(child, state, child.type)
      }
      visit(node.closingFragment, state, node.closingFragment.type)
    }
  },
  JSXOpeningFragment: (node, state, visit) => {
    for (let i = 0; i < node.attributes.length; i++) {
      const attribute = node.attributes[i]
      visit(attribute, state, attribute.type)
    }
  },
  JSXClosingFragment: ignore,
  JSXText: ignore,
  JSXIdentifier: ignore,
  JSXMemberExpression: (node, state, visit) => {
    visit(node.object, state, node.object.type)
    visit(node.property, state, node.property.type)
  },
  JSXAttribute: (node, state, visit) => {
    visit(node.name, state, node.name.type)

    if (node.value !== null) {
      visit(node.value, state, node.value.type)
    }
  },
  JSXSpreadAttribute: (node, state, visit) => {
    visit(node.argument, state, node.argument.type)
  },
  JSXNamespacedName: (node, state, visit) => {
    visit(node.namespace, state, node.namespace.type)
    visit(node.name, state, node.name.type)
  },
  JSXExpressionContainer: (node, state, visit) => {
    visit(node.expression, state, node.expression.type)
  },
  JSXEmptyExpression: ignore,
  ParenthesizedExpression: (node, state, visit) => {
    visit(node.expression, state, node.expression.type)
  },
  MemberExpression: (node, state, visit) => {
    visit(node.object, state, node.object.type)
    visit(node.property, state, node.property.type)
  }
}, acornWalk.base)
