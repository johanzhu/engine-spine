import {
  ClippingAttachment,
  MeshAttachment,
  RegionAttachment,
  Skeleton,
  SkeletonClipping
} from "@esotericsoftware/spine-core";
import { AttachmentCacheManager } from "./AttachmentCacheManager";
import { SubmeshInstruction } from "./RenderInstructionCollector";
import { SpineAnimationRenderer } from "./SpineAnimationRenderer";

export interface SpinePrimitiveBuildSettings {
  zSpacing: number;
  premultipliedAlpha: boolean;
  tintBlack: boolean;
}

/**
 * 构建 Spine 缓冲数据的构建器。
 */
export class PrimitiveBuilder {
  private static _clipper = new SkeletonClipping();

  public static buildFromInstructions(
    skeleton: Skeleton,
    instructions: SubmeshInstruction[],
    vertexBuffer: Float32Array,
    indexBuffer: Uint16Array | null,
    settings: SpinePrimitiveBuildSettings,
    cache: AttachmentCacheManager,
    renderer: SpineAnimationRenderer
  ): number {
    const clipper = PrimitiveBuilder._clipper;
    clipper.clipEnd();

    let vertexOffset = 0;
    let indexOffset = 0;
    const stride = settings.tintBlack ? 13 : 9;

    for (const instr of instructions) {
      const drawOrder = skeleton.drawOrder;

      if (instr.hasClipping) {
        const clipSlot = drawOrder[instr.startSlot];
        const clipAttachment = clipSlot.getAttachment() as ClippingAttachment;
        clipper.clipStart(clipSlot, clipAttachment);
      }

      for (let i = instr.startSlot; i < instr.endSlot; i++) {
        const slot = drawOrder[i];
        if (!slot.bone.active) continue;

        const attachment = slot.getAttachment();
        if (!(attachment instanceof RegionAttachment || attachment instanceof MeshAttachment)) continue;

        const cacheData = cache.updateCache(slot, attachment);
        let vertices = cacheData.vertices;
        let uvs = cacheData.uvs;
        let indices = cacheData.indices;

        if (instr.hasClipping && clipper.isClipping()) {
          clipper.clipTriangles(
            vertices,
            indices,
            indices.length,
            uvs,
            cacheData.color,
            cacheData.darkColor ?? new Color(0, 0, 0, 1),
            settings.tintBlack
          );
          vertices = new Float32Array(clipper.clippedVertices);
          uvs = new Float32Array(clipper.clippedUVs);
          indices = new Uint16Array(clipper.clippedTriangles);
        }

        const vertexCount = vertices.length / 2;
        const z = i * settings.zSpacing;
        const color = cacheData.color;

        for (let j = 0; j < vertexCount; j++) {
          const x = vertices[j * 2];
          const y = vertices[j * 2 + 1];
          const u = uvs[j * 2];
          const v = uvs[j * 2 + 1];
          const offset = (vertexOffset + j) * stride;
          vertexBuffer[offset] = x;
          vertexBuffer[offset + 1] = y;
          vertexBuffer[offset + 2] = z;
          vertexBuffer[offset + 3] = u;
          vertexBuffer[offset + 4] = v;
          vertexBuffer[offset + 5] = color.r;
          vertexBuffer[offset + 6] = color.g;
          vertexBuffer[offset + 7] = color.b;
          vertexBuffer[offset + 8] = color.a;

          if (settings.tintBlack && cacheData.darkColor) {
            const dark = cacheData.darkColor;
            vertexBuffer[offset + 9] = dark.r;
            vertexBuffer[offset + 10] = dark.g;
            vertexBuffer[offset + 11] = dark.b;
            vertexBuffer[offset + 12] = dark.a;
          }
        }

        if (indexBuffer) {
          for (let j = 0; j < indices.length; j++) {
            indexBuffer[indexOffset++] = vertexOffset + indices[j];
          }
        }

        vertexOffset += vertexCount;
        clipper.clipEnd();
      }

      if (instr.hasClipping) {
        clipper.clipEnd();
      }
    }

    return vertexOffset;
  }

  public static computeTotalVertexCount(instructions: SubmeshInstruction[]): number {
    let total = 0;
    for (let i = 0; i < instructions.length; i++) {
      total += instructions[i].rawVertexCount;
    }
    return total;
  }
}
