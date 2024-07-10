import {
  Texture2D,
  SubPrimitive,
  Vector3,
} from "@galacean/engine";
import {
  Skeleton,
  SkeletonClipping,
  RegionAttachment,
  MeshAttachment,
  ClippingAttachment,
  ArrayLike,
  Color,
  BlendMode,
  SkeletonData,
  Skin,
} from "@esotericsoftware/spine-core";
import { SpineAnimation } from "./SpineAnimation";
import { AdaptiveTexture } from "./loader/LoaderUtils";
import { MaterialCache } from "./Cache";
import { ReturnablePool } from "./util/ReturnablePool";
import { ClearablePool } from "./util/ClearablePool";


class SubRenderItem {
  subPrimitive: SubPrimitive;
  blendMode: BlendMode;
  texture: any;
  slotName?: string;
}

const maxBoundsValue = Infinity;
const minBoundsValue = -Infinity;

export class SpineGenerator {
  static QUAD_TRIANGLES = [0, 1, 2, 2, 3, 0];
  static VERTEX_SIZE = 8; // 2 2 4 position without z, uv, color
  static VERTEX_STRIDE = 9; // 3 2 4 position with z, uv, color
  static tempDark = new Color();
  static tempColor = new Color();
  static tempVerts = new Array(8);
  static tempBlendMode: BlendMode | null = null;
  static tempTexture: AdaptiveTexture | null = null;
  static subPrimitivePool = new ReturnablePool(SubPrimitive);
  static subRenderItemPool = new ClearablePool(SubRenderItem);

  bounds = {
    min: new Vector3(maxBoundsValue, maxBoundsValue, maxBoundsValue),
    max: new Vector3(minBoundsValue, minBoundsValue, minBoundsValue),
  }

  private _clipper: SkeletonClipping = new SkeletonClipping();
  private _subRenderItems: SubRenderItem[] = [];
  private _separateSlots = new Map();
  private _separateSlotTextureMap: Map<string, Texture2D> = new Map();

  getMaxVertexCount(skeletonData: SkeletonData) {
    let vertexCount = 0;
    const { skins } = skeletonData;
    for (let i = 0; i < skins.length; i += 1) {
      const skin = skins[i];
      const vc = this.getSkinVertexCount(skin);
      vertexCount = Math.max(vertexCount, vc);
    }
    return vertexCount;
  }

  buildPrimitive(skeleton: Skeleton, renderer: SpineAnimation) {
    const { useClipping = true, zSpacing = 0.01 } = renderer.setting;
    const {
      bounds,
      _clipper,
      _separateSlots,
      _subRenderItems,
      _separateSlotTextureMap,
    } = this;

    bounds.min.set(maxBoundsValue, maxBoundsValue, maxBoundsValue);
    bounds.max.set(minBoundsValue, minBoundsValue, minBoundsValue);

    let verticesLength = 0;
    let indicesLength = 0;
    const drawOrder = skeleton.drawOrder;
    const maxSlotCount = drawOrder.length;
    const {
      engine,
      _indices, 
      _vertices,
      _subPrimitives,
    } = renderer;
    const {
      tempVerts,
      tempTexture,
      tempBlendMode,
      subRenderItemPool, 
      subPrimitivePool,
    } = SpineGenerator;
    _subRenderItems.length = 0;
    subRenderItemPool.clear();
    let vertices = renderer._vertices;
    let triangles: Array<number>;
    let uvs: ArrayLike<number>;
    // 记录当前
    let start = 0;
    let count = 0;
    let blend = BlendMode.Normal;
    let texture = null;
    let primitiveIndex = 0;
    SpineGenerator.tempBlendMode = null;
    SpineGenerator.tempTexture = null;
    for (let slotIndex = 0; slotIndex < maxSlotCount; ++slotIndex) {
      const slot = drawOrder[slotIndex];
      if (!slot.bone.active) {
        _clipper.clipEndWithSlot(slot);
        continue;
      }
      const attachment = slot.getAttachment();
      let attachmentColor: Color = null;
      const z = zSpacing * slotIndex;
      let numFloats = 0;
      const isClipping = _clipper.isClipping();
      let vertexSize = isClipping ? 2 : SpineGenerator.VERTEX_SIZE;

      if (!attachment) {
        if (useClipping) {
          _clipper.clipEndWithSlot(slot);
        }
        continue;
      }

      switch(attachment.constructor) {
        case RegionAttachment:
          const regionAttachment = <RegionAttachment>attachment;
          attachmentColor = regionAttachment.color;
          numFloats = vertexSize * 4;
          regionAttachment.computeWorldVertices(
            slot,
            tempVerts,
            0,
            vertexSize,
          );
          triangles = SpineGenerator.QUAD_TRIANGLES;
          uvs = regionAttachment.uvs;
          texture = regionAttachment.region.texture;
        break;
        case MeshAttachment:
          const meshAttachment = <MeshAttachment>attachment;
          attachmentColor = meshAttachment.color;
          numFloats = (meshAttachment.worldVerticesLength >> 1) * vertexSize;
          if (numFloats > vertices.length) {
            SpineGenerator.tempVerts = new Array(numFloats);
          }
          meshAttachment.computeWorldVertices(
            slot,
            0,
            meshAttachment.worldVerticesLength,
            tempVerts,
            0,
            vertexSize,
          );
          triangles = meshAttachment.triangles;
          uvs = meshAttachment.uvs;
          texture = meshAttachment.region.texture;
        break;
        case ClippingAttachment:
          if (useClipping) {
            let clip = <ClippingAttachment>attachment;
            _clipper.clipStart(slot, clip);
          }
          continue;
        default:
          if (useClipping) {
            _clipper.clipEndWithSlot(slot);
          }
          continue;
      }

      if (texture != null) {
        let finalVertices: ArrayLike<number>;
        let finalVerticesLength: number;
        let finalIndices: ArrayLike<number>;
        let finalIndicesLength: number;

        let skeleton = slot.bone.skeleton;
        let skeletonColor = skeleton.color;
        let slotColor = slot.color;
        let alpha = skeletonColor.a * slotColor.a * attachmentColor.a;
        let color = SpineGenerator.tempColor;
        let dark = SpineGenerator.tempDark;
        color.set(
          skeletonColor.r * slotColor.r * attachmentColor.r,
          skeletonColor.g * slotColor.g * attachmentColor.g,
          skeletonColor.b * slotColor.b * attachmentColor.b,
          alpha,
        );

        if (isClipping) {
          _clipper.clipTriangles(
            tempVerts,
            triangles,
            triangles.length,
            uvs,
            color,
            dark,
            false,
          );
          const clippedVertices = _clipper.clippedVertices;
          const clippedTriangles = _clipper.clippedTriangles;
          finalVertices = clippedVertices;
          finalVerticesLength = clippedVertices.length;
          finalIndices = clippedTriangles;
          finalIndicesLength = clippedTriangles.length;
        } else {
          let verts = tempVerts;
          const { r, g, b, a } = color;
          for (
            let v = 2, u = 0, n = numFloats;
            v < n;
            v += vertexSize, u += 2
          ) {
            verts[v] = r;
            verts[v + 1] = g;
            verts[v + 2] = b;
            verts[v + 3] = a;
            verts[v + 4] = uvs[u];
            verts[v + 5] = uvs[u + 1];
          }
          finalVertices = tempVerts;
          finalVerticesLength = numFloats;
          finalIndices = triangles;
          finalIndicesLength = triangles.length;
        }

        if (finalVerticesLength == 0 || finalIndicesLength == 0) {
					_clipper.clipEndWithSlot(slot);
					continue;
				}

        let indexStart = verticesLength / SpineGenerator.VERTEX_STRIDE;
        let vertices = _vertices;
        let i = verticesLength;
        let j = 0;
        for (; j < finalVerticesLength;) {
          let x = finalVertices[j++];
          let y = finalVertices[j++];
          vertices[i++] = x;
          vertices[i++] = y;
          vertices[i++] = z;
          vertices[i++] = finalVertices[j++];
          vertices[i++] = finalVertices[j++];
          vertices[i++] = finalVertices[j++];
          vertices[i++] = finalVertices[j++];
          vertices[i++] = finalVertices[j++];
          vertices[i++] = finalVertices[j++];
          this.expandByPoint(x, y, z);
        }
        verticesLength = i;

        let indicesArray = _indices;
        for (i = indicesLength, j = 0; j < finalIndicesLength; i++, j++) {
          indicesArray[i] = finalIndices[j] + indexStart;
        }
        indicesLength += finalIndicesLength;

        const slotData = slot.data;
        const slotName = slotData.name;
        blend = slotData.blendMode;
        const blendModeChanged = tempBlendMode !== null &&
        tempBlendMode !== slotData.blendMode;
        const textureChanged = tempTexture !== null && 
        tempTexture !== texture;
        const slotNeedSeparate = _separateSlots.get(slotName);

        if (slotNeedSeparate || blendModeChanged || textureChanged) {
          // Finish accumulated count first
          if (count > 0) {
            const origin = _subPrimitives[primitiveIndex];
            origin && primitiveIndex++;
            const subPrimitive = origin || subPrimitivePool.get();
            subPrimitive.start = start;
            subPrimitive.count = count;
            const renderItem = subRenderItemPool.get();
            renderItem.subPrimitive = subPrimitive;
            renderItem.texture = SpineGenerator.tempTexture;
            renderItem.blendMode = SpineGenerator.tempBlendMode;
            _subRenderItems.push(renderItem);
            start += count;
            count = 0;
          }
          if (slotNeedSeparate) {
            // If separatedTexture exist, set texture params
            const separateTexture = _separateSlotTextureMap.get(slotName);
            if (separateTexture) {
              const oldTexture = texture.texture;
              separateTexture.filterMode = oldTexture.filterMode;
              separateTexture.wrapModeU = oldTexture.wrapModeU;
              separateTexture.wrapModeV = oldTexture.wrapModeV;
            }
            const origin = _subPrimitives[primitiveIndex];
            origin && primitiveIndex++;
            const subPrimitive = origin || subPrimitivePool.get();
            subPrimitive.start = start;
            subPrimitive.count = finalIndicesLength;
            const renderItem = subRenderItemPool.get();
            renderItem.blendMode = blend;
            renderItem.subPrimitive = subPrimitive;
            renderItem.texture = texture;
            renderItem.slotName = slotName;
            _subRenderItems.push(renderItem);
            start += finalIndicesLength;
            count = 0;
          } else {
            count += finalIndicesLength;
          }
        } else {
          count += finalIndicesLength;
        }
        SpineGenerator.tempBlendMode = blend;
        SpineGenerator.tempTexture = texture;
      }

      _clipper.clipEndWithSlot(slot);
    } // slot traverse end

    // add reset sub primitive
    if (count > 0) {
      const origin = _subPrimitives[primitiveIndex];
      origin && primitiveIndex++;
      const subPrimitive = origin || subPrimitivePool.get();
      subPrimitive.start = start;
      subPrimitive.count = count;
      const renderItem = subRenderItemPool.get();
      renderItem.blendMode = blend;
      renderItem.subPrimitive = subPrimitive;
      renderItem.texture = texture;
      _subRenderItems.push(renderItem);
      count = 0;
    }

    _clipper.clipEnd();

    const lastLen = _subPrimitives.length;
    const curLen = _subRenderItems.length;
    if (curLen < lastLen) {
      for (let i = curLen; i < lastLen; i++) {
        const item = _subPrimitives[i];
        subPrimitivePool.return(item);
      }
    }

    renderer._clearSubPrimitives();
    for (let i = 0, l = curLen; i < l; ++i) {
      const item = _subRenderItems[i];
      const { slotName, blendMode, texture } = item;
      renderer._addSubPrimitive(item.subPrimitive);
      let subTexture = texture.texture;
      if (_separateSlotTextureMap.has(slotName)) {
        subTexture = _separateSlotTextureMap.get(slotName);
      }
      const material = MaterialCache.instance.getMaterial(subTexture, engine, blendMode);
      renderer.setMaterial(i, material);
    }
    renderer._vertexBuffer.setData(_vertices);
    renderer._indexBuffer.setData(_indices);
  }

  addSeparateSlot(slotName: string) {
    this._separateSlots.set(slotName, slotName);
  }

  addSeparateSlotTexture(slotName: string, texture: Texture2D) {
    this._separateSlotTextureMap.set(slotName, texture);
  }

  private expandByPoint(x: number, y: number, z: number) {
    const { bounds: { min, max } } = this;
    min.x = Math.min(min.x, x);
    min.y = Math.min(min.y, y);
    min.z = Math.min(min.z, z);
    max.x = Math.max(max.x, x);
    max.y = Math.max(max.y, y);
    max.z = Math.max(max.z, z);
  }

  private getSkinVertexCount(skin: Skin) {
    const { attachments } = skin;
    let vertexCount: number = 0;
    const QUAD_TRIANGLE_LENGTH = SpineGenerator.QUAD_TRIANGLES.length;
    for (let i = 0, n = attachments.length; i < n; i++) {
      const slotAttachment = attachments[i];
      for (let key in slotAttachment) {
        const attachment = slotAttachment[key];
        if (!attachment) {
          continue;
        } else if (attachment instanceof RegionAttachment) {
          vertexCount += QUAD_TRIANGLE_LENGTH;
        } else if (attachment instanceof MeshAttachment) {
          let mesh = attachment;
          vertexCount += mesh.triangles.length;
        } else continue;
      }
    }
    return vertexCount; 
  }

}
