const path = require('path')

const buildEslintCommand = (filenames) =>
  `next lint --fix --file ${filenames
    .map((f) => path.relative(process.cwd(), f))
    .join(' --file ')}`

const buildPrettierCommand = (filenames) =>
  `yarn prettier --ignore-path .gitignore --write ${filenames
    .map((f) => path.relative(process.cwd(), f))
    .join(' ')}`

module.exports = {
  '*.js': [buildEslintCommand, buildPrettierCommand],
  '*.ts': [buildEslintCommand, buildPrettierCommand],
  '*.tsx': [buildEslintCommand, buildPrettierCommand],
  '*.md': buildPrettierCommand,
}
