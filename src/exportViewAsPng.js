import * as THREE from 'three';

export function exportViewAsPNG({
  renderer,
  scene,
  camera,
  filename = `export-${Date.now()}.png`,
  includeScaleForOrtho = true
}) {
  renderer.render(scene, camera);

  const sourceCanvas = renderer.domElement;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = sourceCanvas.width;
  exportCanvas.height = sourceCanvas.height;
  const ctx = exportCanvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.drawImage(sourceCanvas, 0, 0);

  if (includeScaleForOrtho && camera && camera.isOrthographicCamera) {
    drawScaleBar(ctx, camera, exportCanvas.width, exportCanvas.height);
  }

  const dataUrl = exportCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function drawScaleBar(ctx, camera, width, height) {
  const worldLength = 5;   // meters
  const worldHeight = 0.2; // meters
  const margin = 20;

  const viewDir = new THREE.Vector3();
  camera.getWorldDirection(viewDir);

  const right = viewDir.clone().cross(camera.up).normalize();
  const up = right.clone().cross(viewDir).normalize();

  const refPoint = camera.position.clone().add(viewDir.clone().multiplyScalar(10));

  const p0 = refPoint.clone();
  const p1 = refPoint.clone().add(right.clone().multiplyScalar(worldLength));
  const p2 = refPoint.clone().add(up.clone().multiplyScalar(worldHeight));

  const s0 = worldToScreen(p0, camera, width, height);
  const s1 = worldToScreen(p1, camera, width, height);
  const s2 = worldToScreen(p2, camera, width, height);

  const pixelLength = Math.abs(s1.x - s0.x);
  const pixelHeight = Math.abs(s2.y - s0.y);
  if (pixelLength < 1 || pixelHeight < 1) return;

  const x = margin;
  const y = height - margin - pixelHeight;
  const partWidth = pixelLength / 5;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';
  ctx.font = '12px "Noto Sans", sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';

  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#000000' : '#f2f2f2';
    ctx.fillRect(x + i * partWidth, y, partWidth, pixelHeight);
  }

  ctx.strokeRect(x, y, pixelLength, pixelHeight);
  ctx.beginPath();
  for (let i = 0; i <= 5; i += 1) {
    const tickX = x + i * partWidth;
    ctx.moveTo(tickX, y);
    ctx.lineTo(tickX, y - 6);
  }
  ctx.stroke();

  ctx.fillStyle = '#000000';
  for (let i = 0; i <= 5; i += 1) {
    const labelX = x + i * partWidth;
    ctx.fillText(String(i), labelX, y - 8);
  }
  ctx.restore();
}

function worldToScreen(point, camera, width, height) {
  const v = point.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * width,
    y: (-v.y * 0.5 + 0.5) * height
  };
}
