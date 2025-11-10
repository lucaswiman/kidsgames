class CurveFolderApp {
    constructor() {
        this.canvas2d = document.getElementById('canvas2d');
        this.ctx2d = this.canvas2d.getContext('2d');
        this.canvas3d = document.getElementById('canvas3d');
        
        this.points = [];
        this.folds = [];
        this.isClosed = false;
        this.mode = 'draw'; // 'draw', 'fold', 'view'
        this.faces = []; // Detected faces between fold lines
        // --- bridge to GeometryUtils --------------------------
        this.closestPointOnSegment = GeometryUtils.closestPointOnSegment.bind(GeometryUtils);
        this.distanceToLineSegment = GeometryUtils.distanceToLineSegment.bind(GeometryUtils);
        this.isPointNearFoldLine   = GeometryUtils.isPointNearFoldLine.bind(GeometryUtils);
        this.createSegments        = GeometryUtils.createSegments.bind(GeometryUtils);
        this.findEnclosedRegions   = GeometryUtils.findEnclosedRegions.bind(GeometryUtils);
        this.applyFoldTransforms   = GeometryUtils.applyFoldTransforms.bind(GeometryUtils);
        // override detectFaces to delegate to geometry utils
        this.detectFaces = () => { this.faces = this.findEnclosedRegions(this.points, this.folds); };
        // -------------------------------------------------------
        
        this.setupEventListeners();
        this.setup3D();
        this.updateInstructions();
        this.draw2D();
    }
    
    setupEventListeners() {
        // Mode buttons
        document.getElementById('drawMode').addEventListener('click', () => this.setMode('draw'));
        document.getElementById('foldMode').addEventListener('click', () => this.setMode('fold'));
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('closeCurve').addEventListener('click', () => this.closeCurve());
        document.getElementById('foldUp').addEventListener('click', () => this.foldUp());
        
        // Canvas click handler
        this.canvas2d.addEventListener('click', (e) => this.handleCanvasClick(e));
    }
    
    setup3D() {
        // Create Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(75, this.canvas3d.width / this.canvas3d.height, 0.1, 1000);
        this.camera.position.set(0, 0, 5);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas3d });
        this.renderer.setSize(this.canvas3d.width, this.canvas3d.height);
        
        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        // Start render loop
        this.animate();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    setMode(newMode) {
        this.mode = newMode;
        const indicator = document.getElementById('modeIndicator');
        
        switch(newMode) {
            case 'draw':
                indicator.textContent = 'Draw Mode';
                indicator.className = 'mode-indicator mode-draw';
                break;
            case 'fold':
                indicator.textContent = 'Fold Mode';
                indicator.className = 'mode-indicator mode-fold';
                break;
            case 'view':
                indicator.textContent = 'View Mode';
                indicator.className = 'mode-indicator mode-view';
                break;
        }
        
        this.updateInstructions();
        this.draw2D();
    }
    
    updateInstructions() {
        const instructions = document.getElementById('instructions');
        
        switch(this.mode) {
            case 'draw':
                if (!this.isClosed) {
                    instructions.textContent = 'Click to add points to create a piecewise-linear curve. Click "Close Curve" when done.';
                } else {
                    instructions.textContent = 'Curve is closed. Switch to Fold Mode to define fold lines.';
                }
                break;
            case 'fold':
                if (!this.isClosed) {
                    instructions.textContent = 'Please close the curve first before defining folds.';
                } else {
                    instructions.textContent = 'Click two points on the curve to define a fold line, or click existing fold lines to set angles. Click "Fold Up!" when ready.';
                }
                break;
            case 'view':
                instructions.textContent = 'View the 3D folded result.';
                break;
        }
    }
    
    handleCanvasClick(e) {
        const rect = this.canvas2d.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.mode === 'draw' && !this.isClosed) {
            this.points.push({ x, y });
            this.draw2D();
        } else if (this.mode === 'fold' && this.isClosed) {
            this.handleFoldClick(x, y);
        }
    }
    
    handleFoldClick(x, y) {
        // First check if clicking on an existing fold line to set angle
        for (let i = 0; i < this.folds.length; i++) {
            const fold = this.folds[i];
            if (fold.length === 2) {
                const distToFold = this.distanceToLineSegment(x, y, fold[0].x, fold[0].y, fold[1].x, fold[1].y);
                if (distToFold < 15) {
                    const angle = prompt(`Set fold angle in degrees (current: ${fold.angle || 0}°):`);
                    if (angle !== null && !isNaN(parseFloat(angle))) {
                        fold.angle = parseFloat(angle);
                        this.draw2D();
                    }
                    return;
                }
            }
        }
        
        // Find the closest point on the curve to add new fold
        let closestPoint = null;
        let minDistance = Infinity;
        let segmentIndex = -1;
        
        for (let i = 0; i < this.points.length; i++) {
            const p1 = this.points[i];
            const p2 = this.points[(i + 1) % this.points.length];
            
            const pointOnSegment = this.closestPointOnSegment(x, y, p1.x, p1.y, p2.x, p2.y);
            const distance = Math.sqrt((x - pointOnSegment.x) ** 2 + (y - pointOnSegment.y) ** 2);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = pointOnSegment;
                segmentIndex = i;
            }
        }
        
        if (closestPoint && minDistance < 20) { // Within 20 pixels
            // Add fold point
            if (!this.currentFold) {
                this.currentFold = [{ ...closestPoint, segmentIndex }];
            } else {
                this.currentFold.push({ ...closestPoint, segmentIndex });
                const newFold = [...this.currentFold];
                newFold.angle = 0; // Default angle
                this.folds.push(newFold);
                this.currentFold = null;
            }
            this.draw2D();
        }
    }
    
    closestPointOnSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return { x: x1, y: y1 };
        
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
        
        return {
            x: x1 + t * dx,
            y: y1 + t * dy
        };
    }
    
    distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const closestPoint = this.closestPointOnSegment(px, py, x1, y1, x2, y2);
        return Math.sqrt((px - closestPoint.x) ** 2 + (py - closestPoint.y) ** 2);
    }
    
    closeCurve() {
        if (this.points.length >= 3) {
            this.isClosed = true;
            this.setMode('fold');
            this.draw2D();
        }
    }
    
    clearAll() {
        this.points = [];
        this.folds = [];
        this.isClosed = false;
        this.currentFold = null;
        this.setMode('draw');
        
        // Clear 3D scene
        while(this.scene.children.length > 0) {
            const child = this.scene.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            this.scene.remove(child);
        }
        
        // Re-add lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        this.draw2D();
    }
    
    draw2D() {
        this.ctx2d.clearRect(0, 0, this.canvas2d.width, this.canvas2d.height);
        
        if (this.points.length === 0) return;
        
        // Draw the curve
        this.ctx2d.strokeStyle = '#007bff';
        this.ctx2d.lineWidth = 2;
        this.ctx2d.beginPath();
        
        this.ctx2d.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            this.ctx2d.lineTo(this.points[i].x, this.points[i].y);
        }
        
        if (this.isClosed) {
            this.ctx2d.closePath();
        }
        
        this.ctx2d.stroke();
        
        // Draw points
        this.ctx2d.fillStyle = '#007bff';
        for (const point of this.points) {
            this.ctx2d.beginPath();
            this.ctx2d.arc(point.x, point.y, 4, 0, 2 * Math.PI);
            this.ctx2d.fill();
        }
        
        // Draw fold lines with angle labels
        this.ctx2d.strokeStyle = '#ffc107';
        this.ctx2d.lineWidth = 3;
        for (const fold of this.folds) {
            if (fold.length === 2) {
                this.ctx2d.beginPath();
                this.ctx2d.moveTo(fold[0].x, fold[0].y);
                this.ctx2d.lineTo(fold[1].x, fold[1].y);
                this.ctx2d.stroke();
                
                // Draw angle label
                const midX = (fold[0].x + fold[1].x) / 2;
                const midY = (fold[0].y + fold[1].y) / 2;
                this.ctx2d.fillStyle = '#000';
                this.ctx2d.font = '12px Arial';
                this.ctx2d.fillText(`${fold.angle || 0}°`, midX + 5, midY - 5);
            }
        }
        
        // Draw current fold in progress
        if (this.currentFold && this.currentFold.length === 1) {
            this.ctx2d.strokeStyle = '#ff6b6b';
            this.ctx2d.lineWidth = 2;
            this.ctx2d.setLineDash([5, 5]);
            this.ctx2d.beginPath();
            this.ctx2d.arc(this.currentFold[0].x, this.currentFold[0].y, 8, 0, 2 * Math.PI);
            this.ctx2d.stroke();
            this.ctx2d.setLineDash([]);
        }
    }
    
    foldUp() {
        if (!this.isClosed || this.folds.length === 0) {
            alert('Please close the curve and define at least one fold line first.');
            return;
        }
        
        this.detectFaces();
        this.create3DGeometry();
        this.setMode('view');
    }
    
    create3DGeometry() {
        // Clear existing 3D objects
        const objectsToRemove = [];
        this.scene.traverse((child) => {
            if (child.isMesh || child.isLine) {
                objectsToRemove.push(child);
            }
        });
        objectsToRemove.forEach(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            this.scene.remove(obj);
        });
        
        // Re-add lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        // Create 3D representation using detected faces and fold angles
        const scale = 0.01;
        const centerX = this.canvas2d.width / 2;
        const centerY = this.canvas2d.height / 2;
        
        this.faces.forEach((face, index) => {
            if (face.points.length < 3) return;
            
            // Create geometry for this face
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const indices = [];
            
            // Convert face points to 3D
            const faceVertices3D = face.points.map(point => {
                return new THREE.Vector3(
                    (point.x - centerX) * scale,
                    -(point.y - centerY) * scale,
                    0
                );
            });
            
            // Apply folding transformations
            const transformedVertices = this.applyFoldTransforms(faceVertices3D, face, index);
            
            // Add vertices to geometry
            transformedVertices.forEach(vertex => {
                vertices.push(vertex.x, vertex.y, vertex.z);
            });
            
            // Triangulate the face (simple fan triangulation)
            for (let i = 1; i < transformedVertices.length - 1; i++) {
                indices.push(0, i, i + 1);
            }
            
            geometry.setIndex(indices);
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.computeVertexNormals();
            
            const material = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL((index * 0.3) % 1, 0.7, 0.6),
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            this.scene.add(mesh);
        });
        
        // Add wireframe edges
        this.addWireframeEdges(scale, centerX, centerY);
    }
    
    createSegments() {
        if (this.folds.length === 0) {
            return [this.points];
        }
        
        // For simplicity, create segments by dividing the curve at fold points
        // This is a basic implementation - a full solution would need more complex geometry
        const segments = [];
        let currentSegment = [];
        
        // Add all points to segments, breaking at fold intersections
        for (let i = 0; i < this.points.length; i++) {
            currentSegment.push(this.points[i]);
            
            // Check if this point is near a fold line
            const nextIndex = (i + 1) % this.points.length;
            const isNearFold = this.folds.some(fold => {
                return this.isPointNearFoldLine(this.points[i], fold) || 
                       this.isPointNearFoldLine(this.points[nextIndex], fold);
            });
            
            if (isNearFold && currentSegment.length > 2) {
                segments.push([...currentSegment]);
                currentSegment = [this.points[i]]; // Start new segment with current point
            }
        }
        
        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }
        
        return segments.length > 0 ? segments : [this.points];
    }
    
    isPointNearFoldLine(point, fold, threshold = 10) {
        if (fold.length !== 2) return false;
        
        const closestPoint = this.closestPointOnSegment(
            point.x, point.y,
            fold[0].x, fold[0].y,
            fold[1].x, fold[1].y
        );
        
        const distance = Math.sqrt(
            (point.x - closestPoint.x) ** 2 + (point.y - closestPoint.y) ** 2
        );
        
        return distance < threshold;
    }
    
    detectFaces() {
        if (this.folds.length === 0) {
            // No folds, entire curve is one face
            this.faces = [{ points: [...this.points], adjacentFolds: [] }];
            return;
        }
        
        // Create a graph of edges (curve segments and fold lines)
        const edges = [];
        const vertices = new Map();
        
        // Add curve edges
        for (let i = 0; i < this.points.length; i++) {
            const p1 = this.points[i];
            const p2 = this.points[(i + 1) % this.points.length];
            edges.push({ p1, p2, type: 'curve' });
            
            const key1 = `${p1.x},${p1.y}`;
            const key2 = `${p2.x},${p2.y}`;
            if (!vertices.has(key1)) vertices.set(key1, p1);
            if (!vertices.has(key2)) vertices.set(key2, p2);
        }
        
        // Add fold edges
        this.folds.forEach(fold => {
            if (fold.length === 2) {
                edges.push({ p1: fold[0], p2: fold[1], type: 'fold', angle: fold.angle });
                
                const key1 = `${fold[0].x},${fold[0].y}`;
                const key2 = `${fold[1].x},${fold[1].y}`;
                if (!vertices.has(key1)) vertices.set(key1, fold[0]);
                if (!vertices.has(key2)) vertices.set(key2, fold[1]);
            }
        });
        
        // Find faces using a simple region detection
        this.faces = this.findEnclosedRegions(edges, vertices);
    }
    
    findEnclosedRegions(edges, vertices) {
        // Simplified face detection - in a real implementation you'd use a proper
        // planar graph face detection algorithm
        const faces = [];
        
        // For now, create faces by dividing the original curve with fold lines
        if (this.folds.length === 0) {
            return [{ points: [...this.points], adjacentFolds: [] }];
        }
        
        // Simple approach: create one face per "segment" between folds
        const segments = this.createSegments();
        segments.forEach((segment, index) => {
            if (segment.length >= 3) {
                const adjacentFolds = this.folds.filter(fold => 
                    segment.some(point => this.isPointNearFoldLine(point, fold, 15))
                );
                faces.push({ points: segment, adjacentFolds });
            }
        });
        
        return faces.length > 0 ? faces : [{ points: [...this.points], adjacentFolds: [] }];
    }
    
    applyFoldTransforms(vertices, face, faceIndex) {
        // Apply rotations based on adjacent fold angles
        let transformedVertices = [...vertices];
        
        // For each adjacent fold, apply a rotation
        face.adjacentFolds.forEach((fold, foldIndex) => {
            if (fold.angle && fold.angle !== 0) {
                const angle = (fold.angle * Math.PI) / 180; // Convert to radians
                
                // Create rotation axis from fold line
                const foldDir = new THREE.Vector3(
                    fold[1].x - fold[0].x,
                    fold[1].y - fold[0].y,
                    0
                ).normalize();
                
                // Apply rotation around fold axis
                const rotationMatrix = new THREE.Matrix4().makeRotationAxis(foldDir, angle);
                
                transformedVertices = transformedVertices.map(vertex => {
                    const rotated = vertex.clone().applyMatrix4(rotationMatrix);
                    // Add some offset based on face index to separate faces
                    rotated.z += faceIndex * 0.1;
                    return rotated;
                });
            }
        });
        
        return transformedVertices;
    }
    
    addWireframeEdges(scale, centerX, centerY) {
        // Add original curve as wireframe
        const curveGeometry = new THREE.BufferGeometry();
        const curveVertices = [];
        
        for (const point of this.points) {
            const x = (point.x - centerX) * scale;
            const y = -(point.y - centerY) * scale;
            curveVertices.push(x, y, 0);
        }
        curveVertices.push(curveVertices[0], curveVertices[1], curveVertices[2]);
        
        curveGeometry.setAttribute('position', new THREE.Float32BufferAttribute(curveVertices, 3));
        const curveMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const curveLine = new THREE.Line(curveGeometry, curveMaterial);
        this.scene.add(curveLine);
        
        // Add fold lines
        this.folds.forEach(fold => {
            if (fold.length === 2) {
                const foldGeometry = new THREE.BufferGeometry();
                const foldVertices = [
                    (fold[0].x - centerX) * scale, -(fold[0].y - centerY) * scale, 0,
                    (fold[1].x - centerX) * scale, -(fold[1].y - centerY) * scale, 0
                ];
                foldGeometry.setAttribute('position', new THREE.Float32BufferAttribute(foldVertices, 3));
                const foldMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
                const foldLine = new THREE.Line(foldGeometry, foldMaterial);
                this.scene.add(foldLine);
            }
        });
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CurveFolderApp();
});
