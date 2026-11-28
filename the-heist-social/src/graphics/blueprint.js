import { ROOMS, WALL_SEGMENTS, DOORS, FURNITURE, JEWELS, CCTV_CAMERAS, SECRET_PASSAGES, DIAMOND_HIDING_SPOTS, EMERGENCY_BUTTON, TASKS } from '../data/villaLayout.js';

// A top-down plan derived from the same geometry and state as the 3D villa.
export function drawBlueprint(canvas, state, me, detailed = false) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const scale = Math.min((w - (detailed ? 58 : 16)) / 70, (h - (detailed ? 58 : 16)) / 56);
  const toScreen = (x, z) => [w / 2 + x * scale, h / 2 + z * scale];
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#091827'; ctx.fillRect(0, 0, w, h);

  if (detailed) {
    ctx.strokeStyle = 'rgba(125,211,252,0.06)'; ctx.lineWidth = 1;
    for (let x = w / 2 % (scale * 5); x < w; x += scale * 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = h / 2 % (scale * 5); y < h; y += scale * 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  const floorColors = { parquet_dark: '#745034', parquet_warm: '#8a623f', parquet_herringbone: '#90643f', marble_checker: '#686e70', marble_white: '#93938b', slate_tech: '#365467', travertine: '#8c8c77', grass: '#315640' };
  for (const room of ROOMS) {
    const [x, y] = toScreen(room.bounds.minX, room.bounds.minZ);
    const width = (room.bounds.maxX - room.bounds.minX) * scale;
    const height = (room.bounds.maxZ - room.bounds.minZ) * scale;
    ctx.fillStyle = detailed ? (floorColors[room.floorType] || '#315640') : (room.indoor ? '#31435a' : '#254a36');
    ctx.fillRect(x, y, width, height);
    if (detailed && room.indoor) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
      ctx.strokeStyle = 'rgba(255,245,214,0.12)'; ctx.lineWidth = 1;
      const step = (room.floorType.startsWith('parquet') ? 1.2 : 2) * scale;
      for (let line = y; line < y + height; line += step) {
        ctx.beginPath(); ctx.moveTo(x, line); ctx.lineTo(x + width, line); ctx.stroke();
      }
      if (!room.floorType.startsWith('parquet')) {
        for (let line = x; line < x + width; line += step) {
          ctx.beginPath(); ctx.moveTo(line, y); ctx.lineTo(line, y + height); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  if (detailed) {
    // Rugs beneath furniture; all shapes reflect actual object positions and sizes.
    for (const f of [...FURNITURE.filter(f => f.type === 'rug'), ...FURNITURE.filter(f => f.type !== 'rug')]) {
      const [x, y] = toScreen(f.x, f.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-(f.rot || 0));
      const fw = f.w * scale, fh = f.d * scale;
      ctx.fillStyle = f.type === 'rug' ? (f.color || '#765652') : f.type === 'swimming_pool' ? '#258da7' : f.type === 'hedge' ? '#28633c' : '#513d30';
      ctx.strokeStyle = f.type === 'rug' ? '#e7c985' : 'rgba(244,224,183,0.65)';
      ctx.lineWidth = f.type === 'rug' ? 1.3 : 1;
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh); ctx.strokeRect(-fw / 2, -fh / 2, fw, fh);
      if (f.type === 'king_bed') {
        ctx.fillStyle = '#ece0c8'; ctx.fillRect(-fw * .4, -fh * .4, fw * .8, fh * .2);
      } else if (f.type === 'swimming_pool') {
        ctx.strokeStyle = 'rgba(190,245,255,0.6)';
        for (let line = -fh / 2 + 8; line < fh / 2; line += 10) { ctx.beginPath(); ctx.moveTo(-fw / 2 + 3, line); ctx.lineTo(fw / 2 - 3, line); ctx.stroke(); }
      }
      ctx.restore();
    }
    // Directional field of view, illustrative rather than a detection guarantee.
    for (const camera of CCTV_CAMERAS) {
      const [x, y] = toScreen(camera.pos.x, camera.pos.z);
      const angle = Math.atan2(camera.lookAt.z - camera.pos.z, camera.lookAt.x - camera.pos.x);
      ctx.fillStyle = 'rgba(34,211,238,0.10)'; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.arc(x, y, Math.min(camera.detectRadius * scale, 90), angle - 0.38, angle + 0.38); ctx.closePath(); ctx.fill();
    }
  }

  ctx.strokeStyle = detailed ? '#eddfbb' : 'rgba(56,189,248,0.85)';
  ctx.lineCap = 'round'; ctx.lineWidth = detailed ? 4 : 1.4;
  for (const seg of WALL_SEGMENTS) {
    const [x1, y1] = toScreen(seg.x1, seg.z1), [x2, y2] = toScreen(seg.x2, seg.z2);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  for (const d of DOORS) {
    const [x, y] = toScreen(d.x, d.z);
    const locked = (state.sabotage?.lockedWings?.[d.wing] || 0) > 0;
    if (!detailed && !locked) continue;
    ctx.strokeStyle = locked ? '#fb7185' : '#f6c66e'; ctx.lineWidth = detailed ? 3 : 2;
    ctx.beginPath();
    if (d.orientation === 'h') { ctx.moveTo(x - d.width * scale / 2, y); ctx.lineTo(x + d.width * scale / 2, y); }
    else { ctx.moveTo(x, y - d.width * scale / 2); ctx.lineTo(x, y + d.width * scale / 2); }
    ctx.stroke();
  }

  if (detailed) {
    ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const room of ROOMS) {
      const [x, y] = toScreen(room.labelPos.x, room.indoor ? room.bounds.minZ + 0.8 : room.labelPos.z);
      const label = room.shortName;
      const width = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(5,18,27,0.82)'; ctx.fillRect(x - width / 2, y - 9, width, 18);
      ctx.fillStyle = '#f5f3e9'; ctx.fillText(label, x, y);
    }
  }

  const marker = (x, z, color, radius, shape = 'circle') => {
    const [px, py] = toScreen(x, z);
    ctx.beginPath();
    if (shape === 'diamond') { ctx.moveTo(px, py - radius); ctx.lineTo(px + radius, py); ctx.lineTo(px, py + radius); ctx.lineTo(px - radius, py); ctx.closePath(); }
    else if (shape === 'square') ctx.rect(px - radius, py - radius, radius * 2, radius * 2);
    else ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#102130'; ctx.lineWidth = 1.5; ctx.stroke();
  };
  for (const j of JEWELS) {
    const stolen = state.jewels[j.id]?.stolen;
    if (!stolen || detailed) marker(j.x, j.z, stolen ? '#89939a' : '#ffd06a', detailed ? 5 : 2.5, 'diamond');
  }
  if (me?.role === 'civilian') for (const assigned of me.assignedTasks || []) {
    const task = TASKS.find(t => t.id === assigned.id);
    if (task && !assigned.done) marker(task.x, task.z, '#38bdf8', detailed ? 5 : 3);
  }
  if (me?.role === 'thief') {
    for (const sp of SECRET_PASSAGES) marker(sp.x, sp.z, '#c084fc', detailed ? 5 : 3, 'square');
    for (const ds of DIAMOND_HIDING_SPOTS) marker(ds.x, ds.z, '#fbbf24', detailed ? 5 : 3, 'square');
  }
  marker(EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.z, '#fb5263', detailed ? 5.5 : 3.2);
  if (detailed) {
    for (const cam of CCTV_CAMERAS) marker(cam.pos.x, cam.pos.z, '#36d5e5', 4, 'square');
    ctx.textAlign = 'center'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillStyle = '#f9e9bd';
    ctx.fillText('N ▲', w - 29, 24);
  }
  if (me) marker(me.x, me.z, '#fff064', detailed ? 7 : 4.2);
}
