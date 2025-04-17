import { ClippingAttachment, MeshAttachment, RegionAttachment, Skeleton } from "@esotericsoftware/spine-core";
import { Texture2D } from "@galacean/engine";

export interface SubmeshInstruction {
  startSlot: number;
  endSlot: number;
  texture: Texture2D;
  hasClipping: boolean;
  rawVertexCount: number;
  rawTriangleCount: number;
  rawFirstVertexIndex: number;
}

export class RenderInstructionManager {
  private _submeshInstructions: SubmeshInstruction[] = [];

  get instructions(): SubmeshInstruction[] {
    return this._submeshInstructions;
  }

  clear(): void {
    this._submeshInstructions.length = 0;
  }

  generateInstructions(skeleton: Skeleton): void {
    this.clear();
    const drawOrder = skeleton.drawOrder;

    let current: Partial<SubmeshInstruction> = {
      startSlot: 0,
      texture: null,
      hasClipping: false,
      rawTriangleCount: 0,
      rawVertexCount: 0,
      rawFirstVertexIndex: 0
    };

    let vertexCounter = 0;
    let clippingActive = false;

    for (let i = 0; i < drawOrder.length; i++) {
      const slot = drawOrder[i];
      const attachment = slot.getAttachment();

      if (!slot.bone.active) continue;

      if (attachment instanceof ClippingAttachment) {
        current.hasClipping = true;
        clippingActive = true;
        continue;
      }

      if (!(attachment instanceof RegionAttachment || attachment instanceof MeshAttachment)) continue;

      const texture = attachment.region?.texture?.texture as Texture2D;
      if (!texture) continue;

      const vertexCount = attachment instanceof RegionAttachment ? 4 : attachment.worldVerticesLength >> 1;
      const triangleCount = attachment instanceof RegionAttachment ? 6 : attachment.triangles.length;

      const shouldBreak = (current.texture && texture !== current.texture) || clippingActive;

      if (shouldBreak) {
        current.endSlot = i;
        this._submeshInstructions.push(current as SubmeshInstruction);

        current = {
          startSlot: i,
          texture: texture,
          hasClipping: clippingActive,
          rawTriangleCount: 0,
          rawVertexCount: 0,
          rawFirstVertexIndex: vertexCounter
        };
        clippingActive = false;
      }

      current.texture = texture;
      current.rawVertexCount += vertexCount;
      current.rawTriangleCount += triangleCount;
      current.hasClipping ||= clippingActive;
      vertexCounter += vertexCount;
    }

    if (current.texture) {
      current.endSlot = drawOrder.length;
      this._submeshInstructions.push(current as SubmeshInstruction);
    }
  }

  compareWithCache(lastInstructions: SubmeshInstruction[]): boolean {
    const curr = this._submeshInstructions;
    if (curr.length !== lastInstructions.length) return false;

    for (let i = 0; i < curr.length; i++) {
      const a = curr[i];
      const b = lastInstructions[i];
      if (
        a.startSlot !== b.startSlot ||
        a.endSlot !== b.endSlot ||
        a.texture !== b.texture ||
        a.hasClipping !== b.hasClipping ||
        a.rawVertexCount !== b.rawVertexCount ||
        a.rawTriangleCount !== b.rawTriangleCount
      ) {
        return false;
      }
    }

    return true;
  }

  computeTotalVertexCount(): number {
    let total = 0;
    for (let i = 0; i < this._submeshInstructions.length; i++) {
      total += this._submeshInstructions[i].rawVertexCount;
    }
    return total;
  }
}
