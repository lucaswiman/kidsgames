# Code Style Guide

This document outlines the code style and development practices for the Bertymon Game project.

## Formatting

We use **Prettier** for automatic code formatting. All code should be formatted according to the `.prettierrc.json` configuration:

- **Indentation**: 2 spaces (no tabs)
- **Line Length**: 100 characters max
- **Quotes**: Single quotes (`'`) for strings
- **Semicolons**: Always included
- **Trailing Commas**: ES5 style (objects and arrays, but not function parameters)
- **Arrow Functions**: Omit parentheses for single parameters when possible

### Formatting Code

Format all modified files before committing:

```bash
npx prettier --write <file>
```

Or format the entire codebase:

```bash
npx prettier --write .
```

## Linting

We use **ESLint** for code quality checks. The configuration in `.eslintrc.json` enforces:

### Key Rules

- **`no-unused-vars`**: Unused variables are errors (except those prefixed with `_`)
- **`no-console`**: Console statements trigger warnings (acceptable for logging, but avoid in production code)
- **`prefer-const`**: Use `const` by default, only use `let` when reassignment is needed
- **`eqeqeq`**: Always use strict equality (`===`, `!==`) instead of loose equality
- **`curly`**: All control structures must use braces, even single-statement blocks

### Linting Code

Check for lint issues:

```bash
npx eslint <file>
```

Automatically fix fixable issues:

```bash
npx eslint --fix <file>
```

Lint all JavaScript files:

```bash
npx eslint .
```

## Pre-commit Hooks

We use **pre-commit** to automatically run checks before committing code. The `.pre-commit-config.yaml` file defines hooks that:

1. Remove trailing whitespace
2. Fix end-of-file newlines
3. Validate YAML and JSON files
4. Prevent accidental commits of large files (>500KB)
5. Detect private keys
6. Format code with Prettier
7. Lint with ESLint

### Setup

Install the pre-commit framework:

```bash
pip install pre-commit
```

Install the git hooks:

```bash
pre-commit install
```

### Manual Pre-commit Check

Run all checks manually without committing:

```bash
pre-commit run --all-files
```

## Testing

Run tests with Jest:

```bash
npm test
```

Watch mode for development:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

## Best Practices

1. **Use const by default**: Only use `let` when you need to reassign, never use `var`
2. **Meaningful names**: Choose clear variable and function names
3. **Error handling**: Handle errors explicitly, don't rely on silent failures
4. **Comments**: Add comments for non-obvious logic, not for obvious code
5. **Functions**: Keep functions focused on a single responsibility
6. **Testing**: Write tests for game logic and complex functions

## Git Workflow

1. Make changes to your code
2. Pre-commit hooks automatically run Prettier and ESLint on staged files
3. If hooks make changes, review them and re-stage
4. Commit your changes
5. Push to your branch

If a pre-commit hook fails, fix the issues it reports and re-stage your changes.
