#!/usr/bin/env node
'use strict';

const assert = require('assert');

try {
    // Deliberately failing test
    assert.strictEqual(2 + 2, 5, 'Expected 2 + 2 to equal 5');
    console.log('All tests passed!');
    process.exit(0);
} catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
}
