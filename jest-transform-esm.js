/**
 * Minimal Jest transform that strips ES module `export` keywords
 * so that game-logic.js can use `export` for the browser while
 * still being importable via CommonJS `require()` in tests.
 */
module.exports = {
  process(src) {
    return { code: src.replace(/^export /gm, '') };
  },
};
