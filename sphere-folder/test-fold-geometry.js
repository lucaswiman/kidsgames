#!/usr/bin/env node
'use strict';

const assert = require('assert');

/**
 * Individual unit tests should be defined as functions whose names
 * begin with "test".  runTests() will automatically discover and
 * execute them.
 */

/**
 * Example test – deliberately failing to demonstrate output.
 */
function testAddition() {
    // Deliberately failing test
    assert.strictEqual(2 + 2, 5, 'Expected 2 + 2 to equal 5');
}

/**
 * Executes every exported function whose name starts with "test".
 * Exits the Node.js process with status 0 if all pass, or 1 if any fail.
 */
function runTests() {
    let failures = 0;

    for (const [name, fn] of Object.entries(module.exports)) {
        if (name.startsWith('test') && typeof fn === 'function') {
            try {
                fn();
                console.log(`✓ ${name} passed`);
            } catch (err) {
                failures += 1;
                console.error(`✗ ${name} failed – ${err.message}`);
            }
        }
    }

    if (failures === 0) {
        console.log('All tests passed!');
        process.exit(0);
    } else {
        console.error(`${failures} test${failures > 1 ? 's' : ''} failed.`);
        process.exit(1);
    }
}

module.exports = {
    testAddition,
    runTests,
};

/* When this file is executed directly (`node test-fold-geometry.js`)
   automatically run the tests. */
if (require.main === module) {
    runTests();
}
