# jsx-transform-modern

> This module is a rewrite of [jsx-transform](https://github.com/alexmingoia/jsx-transform) using [acorn](https://github.com/acornjs/acorn). It aims to be a drop in replacement for the old module, keeping the same API, and taking the tests and documentation from it to ensure compatibility. The rest of this document comes from the original module.

> JSX transpiler. Desugar JSX into JavaScript.

This module aims to be a standard and configurable implementation of JSX
decoupled from [React](https://github.com/facebook/react) for use with
[Mercury](https://github.com/Raynos/mercury) or other modules.

JSX is a JavaScript syntax for composing virtual DOM elements.
See React's [documentation][0] for an explanation.

For linting files containing JSX see
[JSXHint](https://github.com/STRML/JSXHint).

## Installation

```sh
npm install jsx-transform-modern
```

## API
<a name="module_jsx-transform-modern"></a>
## jsx-transform-modern
This module aims to be a standard and configurable implementation of JSX
decoupled from [React](https://github.com/facebook/react) for use with
[Mercury](https://github.com/Raynos/mercury) or other modules.

JSX is a JavaScript syntax for composing virtual DOM elements.
See React's [documentation][0] for an explanation.

For linting files containing JSX see
[JSXHint](https://github.com/STRML/JSXHint).


* [jsx-transform-modern](#module_jsx-transform-modern)
  * [~fromString(str, [options])](#module_jsx-transform-modern..fromString) ⇒ <code>String</code>
  * [~fromFile(path, [options])](#module_jsx-transform-modern..fromFile) ⇒ <code>String</code>
  * [~browserifyTransform([filename], [options])](#module_jsx-transform-modern..browserifyTransform) ⇒ <code>function</code>

<a name="module_jsx-transform-modern..fromString"></a>
### jsx-transform-modern~fromString(str, [options]) ⇒ <code>String</code>
Desugar JSX and return transformed string.

**Kind**: inner method of <code>[jsx-transform-modern](#module_jsx-transform-modern)</code>  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>String</code> |  |
| [options] | <code>Object</code> |  |
| options.factory | <code>String</code> | Factory function name for element creation. |
| [options.spreadFn] | <code>String</code> | Name of function for use with spread attributes (default: Object.assign). |
| [options.unknownTagPattern] | <code>String</code> | uses given pattern for unknown tags where `{tag}` is replaced by the tag name. Useful for rending mercury components as `Component.render()` instead of `Component()`. |
| [options.passUnknownTagsToFactory] | <code>Boolean</code> | Handle unknown tags like known tags, and pass them as an object to `options.factory`. If true, `createElement(Component)` instead of `Component()` (default: false). |
| [options.unknownTagsAsString] | <code>Boolean</code> | Pass unknown tags as string to `options.factory` (default: false). |
| [options.arrayChildren] | <code>Boolean</code> | Pass children as array instead of arguments (default: true). |
| [options.ecmaversion] | <code>Number</code> | ECMAScript version (default: 8). |

**Example**  
```javascript
var jsx = require('jsx-transform-modern');

jsx.fromString('<h1>Hello World</h1>', {
  factory: 'mercury.h'
});
// => 'mercury.h("h1", null, ["Hello World"])'
```
<a name="module_jsx-transform-modern..fromFile"></a>
### jsx-transform-modern~fromFile(path, [options]) ⇒ <code>String</code>
**Kind**: inner method of <code>[jsx-transform-modern](#module_jsx-transform-modern)</code>  

| Param | Type |
| --- | --- |
| path | <code>String</code> |
| [options] | <code>Object</code> |

<a name="module_jsx-transform-modern..browserifyTransform"></a>
### jsx-transform-modern~browserifyTransform([filename], [options]) ⇒ <code>function</code>
Make a browserify transform.

**Kind**: inner method of <code>[jsx-transform-modern](#module_jsx-transform-modern)</code>  
**Returns**: <code>function</code> - browserify transform  

| Param | Type | Description |
| --- | --- | --- |
| [filename] | <code>String</code> |  |
| [options] | <code>Object</code> |  |
| [options.extensions] | <code>String</code> | Array of file extensions to run browserify transform on (default: `['.js', '.jsx', '.es', '.es6']`). |

**Example**  
```javascript
var browserify = require('browserify');
var jsxify = require('jsx-transform-modern').browserifyTransform;

browserify()
  .transform(jsxify, options)
  .bundle()
```

Use `.configure(options)` to return a configured transform:

```javascript
var browserify = require('browserify');
var jsxify = require('jsx-transform-modern').browserifyTransform;

browserify({
  transforms: [jsxify.configure(options)]
}).bundle()
```

Use in `package.json`:

```json
"browserify": {
  "transform": [
    ["jsx-transform-modern/browserify", { "factory": "h" }]
  ]
}
```


## BSD Licensed

[0]: https://facebook.github.io/react/docs/jsx-in-depth.html
