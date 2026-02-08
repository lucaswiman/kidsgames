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
    const f = [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
    f.angle = angle;
    return f;
  };

  // Four 90° folds surrounding the base square 0≤x≤1, 0≤y≤1
  const folds = [
    makeFold(1, 0, 1, 1, 90), // Right
    makeFold(0, 0, 0, 1, 90), // Left
    makeFold(0, 1, 1, 1, 90), // Front
    makeFold(0, 0, 1, 0, 90), // Back
  ];

  // Helper – ensure vertices share the same coordinate (within tolerance)
  const assertConst = (verts, coord, expected) => {
    verts.forEach(v => {
      assert.ok(
        Math.abs(v[coord] - expected) < tol,
        `${coord} expected ≈ ${expected}, got ${v[coord]}`
      );
    });
  };

  // Right face should end vertical with x ≈ 1
  const rightOrig = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(2, 0, 0),
    new THREE.Vector3(2, 1, 0),
    new THREE.Vector3(1, 1, 0),
  ];
  const right = GeometryUtils.applyFoldTransforms(rightOrig, { adjacentFolds: [folds[0]] }, 0);
  assertConst(right, 'x', 1);

  // Left face should end vertical with x ≈ 0
  const leftOrig = [
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-1, 1, 0),
  ];
  const left = GeometryUtils.applyFoldTransforms(leftOrig, { adjacentFolds: [folds[1]] }, 0);
  assertConst(left, 'x', 0);

  // Front face should end vertical with y ≈ 1
  const frontOrig = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 1, 0),
    new THREE.Vector3(1, 2, 0),
    new THREE.Vector3(0, 2, 0),
  ];
  const front = GeometryUtils.applyFoldTransforms(frontOrig, { adjacentFolds: [folds[2]] }, 0);
  assertConst(front, 'y', 1);

  // Back face should end vertical with y ≈ 0
  const backOrig = [
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(1, -1, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
  ];
  const back = GeometryUtils.applyFoldTransforms(backOrig, { adjacentFolds: [folds[3]] }, 0);
  assertConst(back, 'y', 0);

  // Base remains in the z = 0 plane
  const base = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(1, 1, 0),
    new THREE.Vector3(0, 1, 0),
  ];
  assertConst(base, 'z', 0);
}

/**
 * Fold the plus-shaped cube net (made of six 10×10 squares) in one go and
 * verify that all eight cube vertices appear in the folded result.
 */
function testCubeNetFolding() {
  const tol = 1e-6;

  // Outline of the plus-shaped net (clockwise)
  const points = [
    { x: -10, y: 10 },
    { x: 0, y: 10 },
    { x: 0, y: 20 },
    { x: 10, y: 20 },
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 30, y: 10 },
    { x: 30, y: 0 },
    { x: 20, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: -10 },
    { x: 0, y: -10 },
    { x: 0, y: 0 },
    { x: -10, y: 10 }, // close
  ];

  const makeFold = (x1, y1, x2, y2, angle) => {
    const f = [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
    f.angle = angle;
    return f;
  };

  // 90° creases between neighbouring squares
  const folds = [
    makeFold(0, 0, 0, 10, 90), // Left hinge
    makeFold(0, 10, 10, 10, 90), // Top hinge
    makeFold(10, 0, 10, 10, 90), // Right hinge
    makeFold(0, 0, 10, 0, 90), // Bottom hinge
    makeFold(20, 0, 20, 10, 90), // Far-right hinge
  ];

  // Perform folding
  const vertexMap = GeometryUtils.foldNet(points, folds);

  // Expected cube corners (units match the 10-unit squares)
  const expected = [
    [0, 0, 0],
    [0, 0, 10],
    [0, 10, 0],
    [10, 0, 0],
    [0, 10, 10],
    [10, 0, 10],
    [10, 10, 0],
    [10, 10, 10],
  ];

  const approxEq = (v, tgt) =>
    Math.abs(v.x - tgt[0]) < tol && Math.abs(v.y - tgt[1]) < tol && Math.abs(v.z - tgt[2]) < tol;

  const foldedVerts = Array.from(vertexMap.values());
  console.log('\n--- Cube Net Folding Debug ---');
  console.log('Outline points:', points);
  console.log(
    'Folds:',
    folds.map(f => ({ p1: f[0], p2: f[1], angle: f.angle }))
  );
  console.log(
    'Folded vertices (x,y,z):',
    foldedVerts.map(v => [v.x.toFixed(3), v.y.toFixed(3), v.z.toFixed(3)])
  );
  console.log(
    'Expected vertices (x,y,z):',
    expected.map(c => c.map(n => n.toFixed(3)))
  );
  console.log('--------------------------------\n');

  expected.forEach(coord => {
    const ok = foldedVerts.some(v => approxEq(v, coord));
    assert.ok(ok, `Missing expected vertex (${coord.join(', ')})`);
  });
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
  testCubeNetFolding,
  runTests,
};

/* When this file is executed directly (`node test-fold-geometry.js`)
   automatically run the tests. */
if (require.main === module) {
  runTests();
}
