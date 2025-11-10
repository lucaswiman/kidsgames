class CurveFolderApp {
    constructor() {
        this.canvas2d = document.getElementById('canvas2d');
        this.ctx2d = this.canvas2d.getContext('2d');
        this.canvas3d = document.getElementById('canvas3d');
        
        this.points = [];
        this.folds = [];
        this.isClosed = false;
        this.mode = 'draw'; // 'draw', 'fold', 'view'
        
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
                    instructions.textContent = 'Click two points on the curve to define a fold line. Click "Fold Up!" when ready.';
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
        // Find the closest point on the curve
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
                this.folds.push([...this.currentFold]);
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
        
        // Draw fold lines
        this.ctx2d.strokeStyle = '#ffc107';
        this.ctx2d.lineWidth = 3;
        for (const fold of this.folds) {
            if (fold.length === 2) {
                this.ctx2d.beginPath();
                this.ctx2d.moveTo(fold[0].x, fold[0].y);
                this.ctx2d.lineTo(fold[1].x, fold[1].y);
                this.ctx2d.stroke();
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
        
        this.create3DGeometry();
        this.setMode('view');
    }
    
    create3DGeometry() {
        // Clear existing 3D objects
        const objectsToRemove = [];
        this.scene.traverse((child) => {
            if (child.isMesh) {
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
        
        // Create a simple folded representation
        // For demonstration, we'll create segments between fold lines and rotate them
        const segments = this.createSegments();
        
        segments.forEach((segment, index) => {
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const indices = [];
            
            // Convert 2D points to 3D, normalize coordinates
            const scale = 0.01; // Scale down for better 3D viewing
            const centerX = this.canvas2d.width / 2;
            const centerY = this.canvas2d.height / 2;
            
            // Create triangulated mesh from segment points
            for (let i = 0; i < segment.length; i++) {
                const x = (segment[i].x - centerX) * scale;
                const y = -(segment[i].y - centerY) * scale; // Flip Y for 3D
                const z = Math.sin(index * 0.5) * 0.5; // Simple folding effect
                vertices.push(x, y, z);
            }
            
            // Create simple triangulation for the segment
            for (let i = 1; i < segment.length - 1; i++) {
                indices.push(0, i, i + 1);
            }
            
            geometry.setIndex(indices);
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.computeVertexNormals();
            
            const material = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL((index * 0.2) % 1, 0.7, 0.6),
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Apply rotation based on fold
            if (index > 0) {
                mesh.rotation.x = Math.sin(index * 0.3) * 0.5;
                mesh.rotation.z = Math.cos(index * 0.3) * 0.3;
            }
            
            this.scene.add(mesh);
        });
        
        // Add wireframe of original curve
        const curveGeometry = new THREE.BufferGeometry();
        const curveVertices = [];
        const scale = 0.01;
        const centerX = this.canvas2d.width / 2;
        const centerY = this.canvas2d.height / 2;
        
        for (const point of this.points) {
            const x = (point.x - centerX) * scale;
            const y = -(point.y - centerY) * scale;
            curveVertices.push(x, y, 0);
        }
        // Close the curve
        curveVertices.push(curveVertices[0], curveVertices[1], curveVertices[2]);
        
        curveGeometry.setAttribute('position', new THREE.Float32BufferAttribute(curveVertices, 3));
        
        const curveMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const curveLine = new THREE.Line(curveGeometry, curveMaterial);
        this.scene.add(curveLine);
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
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CurveFolderApp();
});
