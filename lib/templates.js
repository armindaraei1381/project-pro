/**
 * @file Built-in project templates (CommonJS).
 */

const fs = require('fs');
const path = require('path');

/** Converts a human project name into a safe slug usable by npm/pip. */
function slugify(name) {
  return (
    String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
  ) || 'my-project';
}

/** Catalog of available templates rendered in the New Project dialog. */
const TEMPLATES = [
  {
    id: 'empty',
    name: 'Empty',
    icon: '🗂',
    description: 'An empty folder',
    folders: [],
    files: {}
  },
  {
    id: 'node',
    name: 'Node.js',
    icon: '🟢',
    description: 'package.json + index.js',
    folders: [],
    files: {
      'package.json': (name) => JSON.stringify(
        {
          name: slugify(name),
          version: '1.0.0',
          description: '',
          main: 'index.js',
          scripts: {
            start: 'node index.js',
            test: 'echo "Error: no test specified" && exit 1'
          },
          license: 'MIT'
        },
        null,
        2
      ),
      'index.js': () => "console.log('Hello, world!');\n",
      '.gitignore': () => 'node_modules/\n'
    }
  },
  {
    id: 'python',
    name: 'Python',
    icon: '🐍',
    description: 'main.py + requirements.txt',
    folders: [],
    files: {
      'main.py': () => 'def main():\n    print("Hello, world!")\n\n\nif __name__ == "__main__":\n    main()\n',
      'requirements.txt': () => '',
      '.gitignore': () => '__pycache__/\n*.pyc\n.venv/\nvenv/\n'
    }
  },
  {
    id: 'web',
    name: 'Web',
    icon: '🌐',
    description: 'HTML + CSS + JS starter',
    folders: ['assets'],
    files: {
      'index.html': () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="stylesheet" href="assets/style.css" />
</head>
<body>
  <main>
    <h1>Hello</h1>
    <button id="btn">Click me</button>
  </main>
  <script src="assets/app.js"><\/script>
</body>
</html>
`,
      'assets/style.css': () => `body {
  font-family: system-ui, sans-serif;
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin: 0;
}

button {
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid #888;
  cursor: pointer;
}
`,
      'assets/app.js': () => `const btn = document.getElementById('btn');
btn.addEventListener('click', () => {
  btn.textContent = 'Clicked!';
});
`
    }
  },
  {
    id: 'react',
    name: 'React',
    icon: '⚛️',
    description: 'Single-file React (CDN, no build)',
    folders: [],
    files: {
      // NOTE: closing </script> tags are escaped as <\/script> so the
      // generated HTML stays valid inside JS template literals.
      'index.html': () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>React App</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <style>
    body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    const e = React.createElement;
    function App() {
      const [n, setN] = React.useState(0);
      return e('button', { onClick: () => setN(n + 1) }, 'Clicked ' + n + ' times');
    }
    ReactDOM.createRoot(document.getElementById('root')).render(e(App));
  <\/script>
</body>
</html>
`
    }
  }
];

/** Looks up a template by id (falls back to "empty"). */
function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

/** Writes a template's folders and files to disk. */
function materialize(template, projectPath, projectName) {
  for (const folder of template.folders || []) {
    fs.mkdirSync(path.join(projectPath, folder), { recursive: true });
  }
  for (const entry of Object.entries(template.files || {})) {
    const absolute = path.join(projectPath, entry[0]);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const body = typeof entry[1] === 'function' ? entry[1](projectName) : String(entry[1]);
    fs.writeFileSync(absolute, body);
  }
}

module.exports = { slugify, TEMPLATES, getTemplate, materialize };
