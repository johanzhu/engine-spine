import { Slot, RegionAttachment, MeshAttachment, Color } from "@esotericsoftware/spine-core";
import { Texture2D } from "@galacean/engine";
import { SpineAnimationRenderer } from "./SpineAnimationRenderer";

export interface AttachmentCacheData {
  id: string;
  vertices: Float32Array;
  uvs: Float32Array;
  indices: number[] | Uint16Array;
  color: Color;
  darkColor?: Color;
  skipRender: boolean;
  texture?: Texture2D;
}

export class AttachmentCacheManager {
  private _cache: Record<string, Record<string, AttachmentCacheData>> = {};
  private _renderer: SpineAnimationRenderer;

  constructor(renderer: SpineAnimationRenderer) {
    this._renderer = renderer;
  }

  public get(slotIndex: number, name: string): AttachmentCacheData | undefined {
    return this._cache[slotIndex]?.[name];
  }

  public ensure(
    slotIndex: number,
    name: string,
    vertexCount: number,
    uvCount: number,
    indices: number[] | Uint16Array
  ): AttachmentCacheData {
    const slotCache = (this._cache[slotIndex] ||= {});

    if (!slotCache[name]) {
      slotCache[name] = {
        id: `${slotIndex}-${name}`,
        vertices: new Float32Array(vertexCount),
        uvs: new Float32Array(uvCount),
        indices,
        color: new Color(1, 1, 1, 1),
        skipRender: false
      };
    }

    return slotCache[name];
  }

  public updateCache(slot: Slot, attachment: RegionAttachment | MeshAttachment): AttachmentCacheData {
    const slotIndex = slot.data.index;
    const name = attachment.name;
    const vertexCount = attachment instanceof RegionAttachment ? 8 : attachment.worldVerticesLength;
    const uvCount = attachment.uvs.length;
    const indices = attachment instanceof RegionAttachment ? [0, 1, 2, 2, 3, 0] : attachment.triangles;

    const cache = this.ensure(slotIndex, name, vertexCount, uvCount, indices);

    if (attachment instanceof RegionAttachment) {
      attachment.computeWorldVertices(slot, cache.vertices, 0, 2);
    } else {
      attachment.computeWorldVertices(slot, 0, attachment.worldVerticesLength, cache.vertices, 0, 2);
    }

    if (cache.uvs.length < uvCount) {
      cache.uvs = new Float32Array(uvCount);
    }
    cache.uvs.set(attachment.uvs);

    const skeletonColor = slot.bone.skeleton.color;
    const slotColor = slot.color;
    const attachmentColor = attachment.color;
    cache.color.set(
      skeletonColor.r * slotColor.r * attachmentColor.r,
      skeletonColor.g * slotColor.g * attachmentColor.g,
      skeletonColor.b * slotColor.b * attachmentColor.b,
      skeletonColor.a * slotColor.a * attachmentColor.a
    );

    // 处理 darkColor（用于两色染色）
    if (this._renderer.tintBlack) {
      if (!cache.darkColor) {
        cache.darkColor = new Color();
      }

      if (slot.darkColor) {
        cache.darkColor.setFromColor(slot.darkColor);
      } else {
        cache.darkColor.set(0, 0, 0, 1);
      }
    }

    const texture = attachment.region?.texture?.texture as Texture2D;
    if (texture && cache.texture !== texture) {
      cache.texture = texture;
    }

    cache.skipRender = false;

    return cache;
  }

  public clear(): void {
    this._cache = {};
  }
}
