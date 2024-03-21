import { SubMesh, BufferBindFlag, BufferUsage, Buffer, IndexFormat, Engine } from '@galacean/engine';
import { SkeletonRenderInstruction, SubmeshRenderInstruction } from './RenderInstruction';
import { SkeletonClipping } from '../spine-core/SkeletonClipping';
import { ClippingAttachment } from '../spine-core/attachments/ClippingAttachment';
import { RegionAttachment } from '../spine-core/attachments/RegionAttachment';
import { MeshAttachment } from '../spine-core/attachments/MeshAttachment';
import { Color } from '../spine-core/Utils';
import { SpineMesh } from './SpineMesh';

interface RenderSettings {
  zSpacing: number;
  enableClipping: boolean;
  immutableTriangles: boolean;
  usePMA: boolean;
}

export class MeshGenerator {
  static VERTEX_STRIDE = 9; // 3 + 2 + 4
  static QUAD_TRIANGLES = [0, 1, 2, 2, 3, 0];
  static tempColor: Color = new Color();

  private _clipper: SkeletonClipping = new SkeletonClipping();
  private _vertexBufferData: Float32Array;
  private _tempVerts = new Array(8);
  private _subMeshes: SubMesh[] = [];
  private _submeshIndex = 0;
  private _sumVertexCount = 0;

  private _positionBufferData: Float32Array;
  private _colorBufferData: Float32Array;
  private _uvBufferData: Float32Array;
  private _indexBufferData: Uint16Array;

  private _vertexBuffer: Buffer;
  private _indexBuffer: Buffer;

  settings: RenderSettings = {
    zSpacing: 0.1,
    enableClipping: false,
    immutableTriangles: false,
    usePMA: false,
  };

  get subMeshes() {
    return this._subMeshes;
  }

  begin(vertexCount: number, triangleCount: number) {
    this._vertexBufferData = new Float32Array(vertexCount * MeshGenerator.VERTEX_STRIDE);
    this._indexBufferData = new Uint16Array(triangleCount);
    this._subMeshes.length = 0;
    this._submeshIndex = 0;
    this._sumVertexCount = 0;
  }

  addSubMesh(instruction: SubmeshRenderInstruction, updateTriangles: boolean) {
    const {
      _subMeshes, 
      _submeshIndex,
      _clipper,
      _vertexBufferData,
      _indexBufferData,
      _sumVertexCount,
      _tempVerts,
    } = this;
    const {
      zSpacing,
      enableClipping,
      immutableTriangles,
      usePMA,
    } = this.settings;
    const newSubMeshCount = _submeshIndex + 1;
    if (_subMeshes.length < newSubMeshCount) {
      _subMeshes.length = newSubMeshCount;
    }
    let subMesh: SubMesh;
    if (!_subMeshes[_submeshIndex]) {
      _subMeshes[_submeshIndex] = new SubMesh();
    }
    subMesh = _subMeshes[_submeshIndex];
    subMesh.start = _sumVertexCount;

    const { skeleton: { drawOrder, color: skeletonColor }, startSlot, endSlot } = instruction;
    if (enableClipping && instruction.preActiveClippingSlotIndex > 0) {
      const slot = drawOrder[instruction.preActiveClippingSlotIndex];
		  _clipper.clipStart(slot, (slot.attachment as ClippingAttachment));
    }

    let verticesLength = 0;
    let indicesLength = 0;
    for (let slotIndex = startSlot; slotIndex < endSlot; slotIndex += 1) {
      const slot = drawOrder[slotIndex];
      if (!slot.bone.active) {
        _clipper.clipEndWithSlot(slot);
      }
      const { attachment } = slot;
      const z = zSpacing * slotIndex;
      let attachmentColor: Color = new Color();
      let attachmentTriangleIndices: number[];
      let attachmentVertexCount: number;
      let attachmentIndexCount: number;
      let attachmentUvs: ArrayLike<number>;
      let totalVertexDataSize: number;
      let vertexSize = _clipper.isClipping() ? 2 : MeshGenerator.VERTEX_STRIDE - 1;
      if (attachment instanceof RegionAttachment) {
        const regionAttachment = <RegionAttachment>attachment;
        regionAttachment.computeWorldVertices(
          slot.bone,
          _tempVerts,
          0,
          vertexSize,
        );
        totalVertexDataSize = vertexSize * 4;
        const { uvs, color } = regionAttachment;
        attachmentUvs = uvs;
        attachmentTriangleIndices = MeshGenerator.QUAD_TRIANGLES;
        attachmentVertexCount = 4;
				attachmentIndexCount = 6;
        attachmentColor = color;
      } else if (attachment instanceof MeshAttachment) {
        const meshAttachment = <MeshAttachment>attachment;
        const meshVerticesLength = meshAttachment.worldVerticesLength;
        totalVertexDataSize = (meshVerticesLength >> 1) * vertexSize;
        if (totalVertexDataSize > _vertexBufferData.length) {
          this._tempVerts = new Array(totalVertexDataSize);
        }
        meshAttachment.computeWorldVertices(
          slot,
          0,
          meshAttachment.worldVerticesLength,
          _tempVerts,
          0,
          vertexSize,
        );
        const { uvs, color } = meshAttachment;
        attachmentUvs = uvs;
        attachmentTriangleIndices = meshAttachment.triangles;
        attachmentVertexCount = meshVerticesLength >> 1;
        attachmentIndexCount = attachmentTriangleIndices.length;
        attachmentColor = color;
      } else if (attachment instanceof ClippingAttachment) {
        if (enableClipping) {
          const clippingAttachment = <ClippingAttachment>attachment;
          if (clippingAttachment != null) {
            _clipper.clipStart(slot, clippingAttachment);
            continue;
          }
        }
      } else {
        // attachment might be null or BoundingBoxAttachment
        if (enableClipping) {
          _clipper.clipEndWithSlot(slot);
        }
        continue;
      }

      if (attachmentTriangleIndices) {
        let finalColor = MeshGenerator.tempColor;
        const slotColor = slot.color;
        const alpha = skeletonColor.a * slotColor.a * attachmentColor.a;
        if (usePMA) {
          finalColor.a = alpha;
          finalColor.r = skeletonColor.r * slotColor.r * attachmentColor.r * alpha;
          finalColor.g = skeletonColor.g * slotColor.g * attachmentColor.g * alpha;
          finalColor.b = skeletonColor.b * slotColor.b * attachmentColor.b * alpha;
        } else {
          finalColor.a = alpha;
          finalColor.r = skeletonColor.r * slotColor.r * attachmentColor.r;
          finalColor.g = skeletonColor.g * slotColor.g * attachmentColor.g;
          finalColor.b = skeletonColor.b * slotColor.b * attachmentColor.b;
        }

        let finalVertices: ArrayLike<number>;
        let finalVerticesLength: number;
        let finalIndices: ArrayLike<number>;
        let finalIndicesLength: number;
        if (enableClipping && _clipper.isClipping()) {
          _clipper.clipTriangles(
            _tempVerts,
            totalVertexDataSize,
            attachmentTriangleIndices,
            attachmentTriangleIndices.length,
            attachmentUvs,
            attachmentColor,
            null,
            false,
          );
          const clippedVertices = _clipper.clippedVertices;
          const clippedTriangles = _clipper.clippedTriangles;
          finalVertices = clippedVertices;
          finalVerticesLength = clippedVertices.length;
          finalIndices = clippedTriangles;
          finalIndicesLength = clippedTriangles.length;
        } else {
          let v = verticesLength;
          let j = 0;
          let u = 0;
          let n = totalVertexDataSize;
          for (; j < n; j += vertexSize, u += 2, v += vertexSize + 1) {
            _vertexBufferData[v] = _tempVerts[j];
            _vertexBufferData[v + 1] = _tempVerts[j + 1];
            _vertexBufferData[v + 2] = z; // positionz
            _vertexBufferData[v + 3] = finalColor.r;
            _vertexBufferData[v + 4] = finalColor.g;
            _vertexBufferData[v + 5] = finalColor.b;
            _vertexBufferData[v + 6] = finalColor.a;
            _vertexBufferData[v + 7] = attachmentUvs[u];
            _vertexBufferData[v + 8] = attachmentUvs[u + 1];
          }
          finalVertices = _vertexBufferData;
          finalVerticesLength = totalVertexDataSize;
          finalIndices = attachmentTriangleIndices;
          finalIndicesLength = attachmentTriangleIndices.length;
        }
        if (updateTriangles) {
          const indexStart = verticesLength / MeshGenerator.VERTEX_STRIDE;
          for (let i = indicesLength, j = 0; j < finalIndicesLength; i++, j++) {
            _indexBufferData[i] = finalIndices[j] + indexStart;
          }
        }
        this._sumVertexCount += finalIndicesLength;
        verticesLength += (finalVerticesLength / vertexSize) * MeshGenerator.VERTEX_STRIDE;
        indicesLength += finalIndicesLength;
      }
      
      _clipper.clipEndWithSlot(slot);
    }  // slot traverse end

    _clipper.clipEnd();
    subMesh.count = indicesLength;


  }

  buildMesh(instruction: SkeletonRenderInstruction, updateTriangles: boolean) {
    for (let i = 0; i < instruction.submeshRenderInstructions.length; i += 1) {
      const submeshInstruction = instruction.submeshRenderInstructions[i];
      this.addSubMesh(submeshInstruction, updateTriangles);
    }
  }

  buildMeshWithoutClip(instruction: SkeletonRenderInstruction) {
    
  }


  fillBufferData(spineMesh: SpineMesh, updateTriangles: boolean, engine: Engine) {
    if (spineMesh.vertexBufferBindings.length === 0) {
      this._vertexBuffer = new Buffer(
        engine,
        BufferBindFlag.VertexBuffer,
        this._vertexBufferData,
        BufferUsage.Dynamic,
      );
      spineMesh.setVertexBufferBinding(this._vertexBuffer, MeshGenerator.VERTEX_STRIDE * 4);
    } else {
      this._vertexBuffer.setData(this._vertexBufferData);
    }

    if (!spineMesh.indexBufferBinding) {
      this._indexBuffer = new Buffer(
        engine,
        BufferBindFlag.IndexBuffer,
        this._indexBufferData,
        BufferUsage.Dynamic
      );
      spineMesh.setIndexBufferBinding(this._indexBuffer, IndexFormat.UInt16);
    } else if (updateTriangles) {
      this._indexBuffer.setData(this._indexBufferData);
    }
    
  }


}