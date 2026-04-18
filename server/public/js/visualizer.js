let animationId = null;
let canvas = null;
let ctx = null;
let analyser = null;

export function initVisualizer(canvasElement, toneAnalyser) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    analyser = toneAnalyser;
    
    // Set initial size
    resize();
    window.addEventListener('resize', resize);
}

function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
}

export function startVisualizer() {
    if (animationId) return;
    draw();
}

export function stopVisualizer() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    // Clear canvas
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function draw() {
    animationId = requestAnimationFrame(draw);
    if (!analyser || !ctx || !canvas) return;

    const values = analyser.getValue();
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;

    ctx.clearRect(0, 0, width, height);

    // Get color from CSS variable
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#10b981';

    ctx.beginPath();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const bufferLength = values.length;
    for (let i = 0; i < bufferLength; i++) {
        // Values are in dB, typically -100 to 0
        const val = (values[i] + 100) / 100; // Normalize to 0-1
        const amplitude = Math.max(0, val) * 60; // Scale for visual impact
        
        const angle = (i / bufferLength) * Math.PI * 2;
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + amplitude);
        const y2 = centerY + Math.sin(angle) * (radius + amplitude);

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // Add a subtle glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = accent;
    ctx.stroke();
    ctx.shadowBlur = 0;
}
