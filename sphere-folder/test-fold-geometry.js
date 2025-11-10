#!/usr/bin/env node
'use strict';

const assert = require('assert');
const THREE = require('three');
const GeometryUtils = require('./fold-geometry.js');

/**
 * Individual unit tests should be defined as functions whose names
 * begin with "test".  runTests() will automatically discover and
 * execute them.
 */

/**
 * Example test – deliberately failing to demonstrate output.
 */
function testAddition() {
    assert.strictEqual(2 + 2, 4, 'Expected 2 + 2 to equal 4');
}

/**
 * Test that folding the net of a cube produces faces oriented as a cube.
 */
function testCubeFolding() {
    const tol = 1e-6;

    const makeFold = (x1, y1, x2, y2, angle) => {
        const f = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        f.angle = angle;
        return f;
    };

    // Four 90° folds surrounding the base square 0≤x≤1, 0≤y≤1
    const folds = [
        makeFold(1, 0, 1, 1, 90), // Right
        makeFold(0, 0, 0, 1, 90), // Left
        makeFold(0, 1, 1, 1, 90), // Front
        makeFold(0, 0, 1, 0, 90)  // Back
    ];

    // Helper – ensure vertices share the same coordinate (within tolerance)
    const assertConst = (verts, coord, expected) => {
        verts.forEach(v => {
            assert.ok(Math.abs(v[coord] - expected) < tol,
                `${coord} expected ≈ ${expected}, got ${v[coord]}`);
        });
    };

    // Right face should end vertical with x ≈ 1
    const rightOrig = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(2, 0, 0),
        new THREE.Vector3(2, 1, 0),
        new THREE.Vector3(1, 1, 0)
    ];
    const right = GeometryUtils.applyFoldTransforms(rightOrig, { adjacentFolds: [folds[0]] }, 0);
    assertConst(right, 'x', 1);

    // Left face should end vertical with x ≈ 0
    const leftOrig = [
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(-1, 1, 0)
    ];
    const left = GeometryUtils.applyFoldTransforms(leftOrig, { adjacentFolds: [folds[1]] }, 0);
    assertConst(left, 'x', 0);

    // Front face should end vertical with y ≈ 1
    const frontOrig = [
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(1, 1, 0),
        new THREE.Vector3(1, 2, 0),
        new THREE.Vector3(0, 2, 0)
    ];
    const front = GeometryUtils.applyFoldTransforms(frontOrig, { adjacentFolds: [folds[2]] }, 0);
    assertConst(front, 'y', 1);

    // Back face should end vertical with y ≈ 0
    const backOrig = [
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(1, -1, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 0)
    ];
    const back = GeometryUtils.applyFoldTransforms(backOrig, { adjacentFolds: [folds[3]] }, 0);
    assertConst(back, 'y', 0);

    // Base remains in the z = 0 plane
    const base = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(1, 1, 0),
        new THREE.Vector3(0, 1, 0)
    ];
    assertConst(base, 'z', 0);
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
    testCubeFolding,
    runTests,
};

/* When this file is executed directly (`node test-fold-geometry.js`)
   automatically run the tests. */
if (require.main === module) {
    runTests();
}
