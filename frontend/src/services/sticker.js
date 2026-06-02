// Lightweight sticker generator used by Trip History export/share
export async function generateStickerBlob(booking = {}, meta = {}) {
  // Create a simple canvas-based image with basic trip info
  const width = 800;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = meta.bg || '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = meta.color || '#111827';
  ctx.font = '36px sans-serif';
  ctx.fillText(meta.label || 'Trip Ticket', 40, 80);

  // Emoji / icon
  ctx.font = '72px serif';
  ctx.fillText(meta.emoji || '🚌', 40, 170);

  // Trip details
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#444';
  ctx.fillText(`From: ${booking.pickup || 'Unknown'}`, 40, 240);
  ctx.fillText(`To:   ${booking.dropoff || 'Unknown'}`, 40, 280);
  ctx.fillText(`When: ${booking.ts ? new Date(booking.ts).toLocaleString() : '—'}`, 40, 320);
  ctx.fillText(`Fare: ₹${booking.fareAmount || '—'}`, 40, 360);

  // Small footer note
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText('Shared via MoveOnGo', 40, height - 40);

  // Convert canvas to blob
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

export default { generateStickerBlob };
