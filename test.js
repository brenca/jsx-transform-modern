const t = require('./index.js')

console.log(t.fromString(`
  <input disabled value="asd"/>
`, {
  factory: 'React.createElement', 
}))