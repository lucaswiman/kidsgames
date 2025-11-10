/**
 * Geometry / graph-theory helper functions for the curve-folding demo.
 * Exposed globally as `GeometryUtils`.
 */

const THREE = (typeof window !== 'undefined' && window.THREE)
    ? window.THREE
    : require('three');

const GeometryUtils = {
    closestPointOnSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return { x: x1, y: y1 };

        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));

        return { x: x1 + t * dx, y: y1 + t * dy };
    },

    distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const c = this.closestPointOnSegment(px, py, x1, y1, x2, y2);
        return Math.sqrt((px - c.x) ** 2 + (py - c.y) ** 2);
    },

    isPointNearFoldLine(point, fold, threshold = 10) {
        if (fold.length !== 2) return false;
        const c = this.closestPointOnSegment(
            point.x, point.y,
            fold[0].x, fold[0].y,
            fold[1].x, fold[1].y
        );
        const d = Math.sqrt((point.x - c.x) ** 2 + (point.y - c.y) ** 2);
        return d < threshold;
    },

    createSegments(points, folds) {
        if (!folds || folds.length === 0) return [points];

        const segments = [];
        let current = [];

        for (let i = 0; i < points.length; i++) {
            current.push(points[i]);
            const nextIdx = (i + 1) % points.length;

            const nearFold = folds.some(f =>
                this.isPointNearFoldLine(points[i], f) ||
                this.isPointNearFoldLine(points[nextIdx], f)
            );

            if (nearFold && current.length > 2) {
                segments.push([...current]);
                current = [points[i]];
            }
        }
        if (current.length) segments.push(current);

        return segments.length ? segments : [points];
    },

    findEnclosedRegions(points, folds) {
        if (!folds || folds.length === 0) {
            return [{ points: [...points], adjacentFolds: [] }];
        }

        const segments = this.createSegments(points, folds);
        const faces = [];

        segments.forEach(seg => {
            if (seg.length >= 3) {
                const adjacentFolds = folds.filter(f =>
                    seg.some(p => this.isPointNearFoldLine(p, f, 15))
                );
                faces.push({ points: seg, adjacentFolds });
            }
        });

        return faces.length ? faces : [{ points: [...points], adjacentFolds: [] }];
    },

    applyFoldTransforms(vertices, face, faceIndex) {
        let out = [...vertices];
        face.adjacentFolds.forEach(f => {
            if (f.angle && f.angle !== 0) {
                const ang = (f.angle * Math.PI) / 180;
                const axis = new THREE.Vector3(
                    f[1].x - f[0].x,
                    f[1].y - f[0].y,
                    0
                ).normalize();

                /* Rotate around the actual fold line (pivot) instead of the
                   world-origin:  T(p)⁻¹ · R(axis,θ) · T(p) */
                const pivot = new THREE.Vector3(f[0].x, f[0].y, 0);
                const T1 = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, 0);
                const R  = new THREE.Matrix4().makeRotationAxis(axis, ang);
                const T2 = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, 0);
                const rotM = new THREE.Matrix4().multiplyMatrices(T2, R).multiply(T1);

                out = out.map(v => {
                    const r = v.clone().applyMatrix4(rotM);
                    r.z += faceIndex * 0.1;   // lift a little to avoid z-fighting
                    return r;
                });
            }
        });
        return out;
    },

    /**
     * Fold an entire 2-D net into 3-D space.
     *
     * points – Array of {x,y} making a closed polygon (the outline).
     * folds  – Array whose items are two-element arrays of {x,y} with an
     *          additional `angle` property (degrees, RH-rule).
     *
     * Returns a Map keyed by "x,y" → THREE.Vector3 after folding.
     */
    foldNet(points, folds, faceIndexOffset = 0) {
        const faces = this.findEnclosedRegions(points, folds);
        const vertexMap = new Map();

        faces.forEach((face, fIdx) => {
            const verts2d = face.points.map(p => new THREE.Vector3(p.x, p.y, 0));
            const folded  = this.applyFoldTransforms(verts2d, face, faceIndexOffset);

            folded.forEach((v, i) => {
                const key = `${face.points[i].x},${face.points[i].y}`;
                if (!vertexMap.has(key)) vertexMap.set(key, v);
            });
        });

        return vertexMap;
    }
};

 // make available to other scripts
if (typeof window !== 'undefined') window.GeometryUtils = GeometryUtils;
if (typeof module !== 'undefined' && module.exports) module.exports = GeometryUtils;
