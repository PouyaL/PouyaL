// Exports the origami train diorama to origami-train.glb for import into Spline
// (Spline: File → Import → select the .glb).
// Usage: npm install && npm run export
import { writeFileSync } from 'node:fs';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildScene } from './scene.js';

// GLTFExporter reads Blobs through FileReader, which Node does not ship.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => { this.result = buf; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

const { root } = buildScene();
root.updateMatrixWorld(true);
const glb = await new GLTFExporter().parseAsync(root, { binary: true });
writeFileSync(new URL('./origami-train.glb', import.meta.url), Buffer.from(glb));
console.log(`origami-train.glb written (${(glb.byteLength / 1024).toFixed(0)} KB)`);
