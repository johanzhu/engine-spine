import {
  Engine,
  Entity,
  MeshRenderer,
  SubMesh,
} from 'oasis-engine';
import { Skeleton } from '../spine-core/Skeleton';
import { SkeletonData } from '../spine-core/SkeletonData';
import { RegionAttachment } from '../spine-core/attachments/RegionAttachment';
import { MeshAttachment } from '../spine-core/attachments/MeshAttachment';
import { ClippingAttachment } from '../spine-core/attachments/ClippingAttachment';
import { ArrayLike, Color } from '../spine-core/Utils';
import { SkeletonClipping } from '../spine-core/SkeletonClipping';
import { SpineMesh } from './SpineMesh';
import { SpineRenderSetting } from '../types';

export class MeshGenerator {
  static QUAD_TRIANGLES = [0, 1, 2, 2, 3, 0];
  static VERTEX_SIZE = 8; // 2 2 4 position without z, uv, color
  static VERTEX_STRIDE = 9; // 3 2 4 position with z, uv, color
  static tempColor: Color = new Color();

  private _skeleton: Skeleton;
  private _setting: SpineRenderSetting;
  private _engine: Engine;
  private _entity: Entity;
  private _clipper: SkeletonClipping = new SkeletonClipping();
  private _spineMesh: SpineMesh = new SpineMesh();

  private _vertexCount: number;
  private _accumulateCount: number;
  private _vertices: Float32Array;
  private _verticesWithZ: Float32Array;
  private _indices: Uint16Array;
  private _verticesLength: number;
  private _indicesLength: number;
  private _needResize: boolean = false;
  private _meshRenderer: MeshRenderer;
  private _subMeshInstructions: SubMeshInstruction[] = [];
  readonly separateSlots: string[] = [];

  get mesh() {
    return this._spineMesh.mesh;
  }

  get subMeshInstructions() {
    return this._subMeshInstructions;
  }

  constructor(engine: Engine, entity: Entity) {
    this._engine = engine;
    this._entity = entity;
  }

  initialize(skeletonData: SkeletonData, setting?: SpineRenderSetting) {
    if (!skeletonData) return;

    const meshRenderer = this._entity.getComponent(MeshRenderer);
    if (!meshRenderer) {
      console.warn('You need add MeshRenderer component to entity first');
      return;
    }
    this._meshRenderer = meshRenderer;

    if (setting) {
      this._setting = setting;
    }

    // Prepare buffer by using all attachment data but clippingAttachment
    const { defaultSkin: { attachments } } = skeletonData;
    let vertexCount: number = 0;
    const QUAD_TRIANGLE_LENGTH = MeshGenerator.QUAD_TRIANGLES.length;
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
    this._vertexCount = vertexCount;
    this._prepareBufferData(this._vertexCount);
    const { _spineMesh } = this;
    _spineMesh.initialize(this._engine, this._vertexCount);
    meshRenderer.mesh = _spineMesh.mesh;
  }

  generateSubMeshInstruction(skeleton: Skeleton) {
    this._skeleton = skeleton;
    const subMeshInstructions = this._subMeshInstructions;
    subMeshInstructions.length = 0;
    const drawOrder = skeleton.drawOrder;
    const maxSlotCount = drawOrder.length;
    let start = 0;
    let count = 0;
    for (let slotIndex = 0; slotIndex < maxSlotCount; slotIndex += 1) {
      const slot = drawOrder[slotIndex];
      const slotName = slot.data.name;
      const needSeparate = this.separateSlots.includes(slotName);
      if (needSeparate) {
        if (count > 0) {
          const prev = new SubMeshInstruction('fragment', start, start + count);
          subMeshInstructions.push(prev);
          count = 0;
        }
        const current = new SubMeshInstruction(slotName, slotIndex, slotIndex + 1);
        subMeshInstructions.push(current);
        start = slotIndex + 1;
      } else {
        count += 1;
      }
    }
    if (count > 0) {
      const rest = new SubMeshInstruction('fragment', start, start + count);
      subMeshInstructions.push(rest);
    }
    this._generateSubMeshMaterial(subMeshInstructions);
  }

  buildMesh() {
    const subMeshInstructions = this._subMeshInstructions;
    const subMeshInstructionLength = subMeshInstructions.length;
    let currentVertexCount = 0;
    this._accumulateCount = 0;
    this._verticesLength = 0;
    this._indicesLength = 0;
    const subMeshes = [];
    for (let i = 0; i < subMeshInstructionLength; i += 1) {
      const { count, start, name } = this.addSubMesh(subMeshInstructions[i]);
      currentVertexCount += count;
      subMeshes.push({ start, count, name });
    }
    if (currentVertexCount > this._vertexCount) {
      this._vertexCount = currentVertexCount;
      this._prepareBufferData(this._vertexCount);
      this._needResize = true;
      return;
    }
    if (this._needResize) {
      this._resizeBuffer();
      this._needResize = true;
    }
    this._generateSubMesh(subMeshes);
    this._uploadBufferData();
  }

  addSubMesh(instruction: SubMeshInstruction) {
    const {
      useClipping = true,
      zSpacing = 0.01,
    } = this._setting || {};
    
    const drawOrder = this._skeleton.drawOrder;
    const { _clipper } = this;
    let vertices: ArrayLike<number> = this._vertices;
    let triangles: Array<number>;
    let uvs: ArrayLike<number>;
    const { startSlotIndex, endSlotIndex, name } = instruction;
    for (let slotIndex = startSlotIndex; slotIndex < endSlotIndex; slotIndex += 1) {
      const slot = drawOrder[slotIndex];
      if (!slot.bone.active) {
        _clipper.clipEndWithSlot(slot);
        continue;
      }
      const attachment = slot.getAttachment();
      let attachmentColor: Color = null;
      let texture = null;
      const z = zSpacing * slotIndex;
      let numFloats = 0;
      let vertexSize = _clipper.isClipping() ? 2 : MeshGenerator.VERTEX_SIZE;
      if (
        attachment instanceof RegionAttachment
      ) {
        let regionAttachment = <RegionAttachment>attachment;
        attachmentColor = regionAttachment.color;
        vertices = this._vertices;
        numFloats = vertexSize * 4;
        regionAttachment.computeWorldVertices(slot.bone, vertices, 0, vertexSize);
        triangles = MeshGenerator.QUAD_TRIANGLES;
        uvs = regionAttachment.uvs;
        texture = regionAttachment.region.renderObject.texture;
      } else if (
        attachment instanceof MeshAttachment
      ) {
        let meshAttachment = <MeshAttachment>attachment;
        attachmentColor = meshAttachment.color;
        vertices = this._vertices;
        numFloats = (meshAttachment.worldVerticesLength >> 1) * vertexSize;
        if (numFloats > vertices.length) {
          vertices = this._vertices = new Float32Array(numFloats);
        }
        meshAttachment.computeWorldVertices(slot, 0, meshAttachment.worldVerticesLength, vertices, 0, vertexSize);
        triangles = meshAttachment.triangles;
        uvs = meshAttachment.uvs;
        texture = meshAttachment.region.renderObject.texture;
      } else if (
        attachment instanceof ClippingAttachment
      ) {
        if (useClipping) {
          let clip = <ClippingAttachment>(attachment);
          _clipper.clipStart(slot, clip);
          continue;
        }
      } else if (useClipping) { // attachment might be null or BoundingBoxAttachment
        _clipper.clipEndWithSlot(slot);
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
        let color = MeshGenerator.tempColor;
        color.set(skeletonColor.r * slotColor.r * attachmentColor.r,
          skeletonColor.g * slotColor.g * attachmentColor.g,
          skeletonColor.b * slotColor.b * attachmentColor.b,
          alpha);

        if (_clipper.isClipping()) {
          _clipper.clipTriangles(vertices, numFloats, triangles, triangles.length, uvs, color, null, false);
          let clippedVertices = _clipper.clippedVertices;
          let clippedTriangles = _clipper.clippedTriangles;
          finalVertices = clippedVertices;
          finalVerticesLength = clippedVertices.length;
          finalIndices = clippedTriangles;
          finalIndicesLength = clippedTriangles.length;
        } else {
          let verts = vertices;
          for (let v = 2, u = 0, n = numFloats; v < n; v += vertexSize, u += 2) {
            verts[v] = color.r;
            verts[v + 1] = color.g;
            verts[v + 2] = color.b;
            verts[v + 3] = color.a;
            verts[v + 4] = uvs[u];
            verts[v + 5] = uvs[u + 1];
          }
          finalVertices = vertices;
          finalVerticesLength = numFloats;
          finalIndices = triangles;
          finalIndicesLength = triangles.length;
        }

        let indexStart = this._verticesLength / MeshGenerator.VERTEX_STRIDE;
        let verticesWithZ = this._verticesWithZ;
        let i = this._verticesLength;
        let j = 0;
        for (; j < finalVerticesLength;) {
          verticesWithZ[i++] = finalVertices[j++];
          verticesWithZ[i++] = finalVertices[j++];
          verticesWithZ[i++] = z;
          verticesWithZ[i++] = finalVertices[j++];
          verticesWithZ[i++] = finalVertices[j++];
          verticesWithZ[i++] = finalVertices[j++];
          verticesWithZ[i++] = finalVertices[j++];
          verticesWithZ[i++] = finalVertices[j++];
          verticesWithZ[i++] = finalVertices[j++];
        }
        this._verticesLength = i;

        let indicesArray = this._indices;
        for (i = this._indicesLength, j = 0; j < finalIndicesLength; i++, j++) {
          indicesArray[i] = finalIndices[j] + indexStart;
        }
        this._indicesLength += finalIndicesLength;
      }

      const materials = this._meshRenderer.getMaterials();
      for (let i = 0; i < materials.length; i += 1) {
        const mtl = materials[i];
        if (!mtl.shaderData.getTexture('u_spriteTexture')) {
          mtl.shaderData.setTexture('u_spriteTexture', texture.texture);
        }
      }

      _clipper.clipEndWithSlot(slot);

    } // slot traverse end
    
    const start = this._accumulateCount;
    this._accumulateCount += this._indicesLength;
    return {
      name,
      start,
      count: this._indicesLength,
    };
  }

  addSeparateSlot(slotName: string) {
    this.separateSlots.push(slotName);
  }

  private _generateSubMesh(subMeshes) {
    const { mesh } = this._spineMesh;
    console.log(subMeshes[subMeshes.length - 1]);
    mesh.clearSubMesh();
    for (let i = 0; i < subMeshes.length; i += 1) {
      const { start, count } = subMeshes[i];
      const subMesh = new SubMesh(start, count);
      mesh.addSubMesh(subMesh);
    }
  }

  private _generateSubMeshMaterial(subMeshInstructions: SubMeshInstruction[]) {
    const meshRenderer = this._meshRenderer;
    const materials = meshRenderer.getMaterials();
    const defaultMaterialName = 'spine_default_material';
    const defaultMaterial = materials.find(material => material.name === defaultMaterialName);
    for (let i = 0; i < subMeshInstructions.length; i += 1) {
      const { name } = subMeshInstructions[i];
      const material = meshRenderer.getMaterial(i);
      const newMaterial = this._engine._spriteDefaultMaterial.clone();
      if (material) {
        // auto correct material
        if (name !== 'fragment' && material.name === defaultMaterialName) {
          newMaterial.name = name;
          meshRenderer.setMaterial(i, newMaterial);
        } else if (name === 'fragment' && material.name !== defaultMaterialName) {
          meshRenderer.setMaterial(i, defaultMaterial);
        }
      } else {
        // add new material
        const isFragment = name === 'fragment';
        const mtl = isFragment ? newMaterial : newMaterial;
        mtl.name = isFragment ? defaultMaterialName : name;
        meshRenderer.setMaterial(i, mtl);
      }
    }
  }


  private _prepareBufferData(vertexCount: number) {
    this._vertices = new Float32Array(vertexCount * MeshGenerator.VERTEX_SIZE);
    this._verticesWithZ = new Float32Array(vertexCount * MeshGenerator.VERTEX_STRIDE);
    this._indices = new Uint16Array(vertexCount);
  }

  private _resizeBuffer() {
    const spineMesh = this._spineMesh;
    // #1
    spineMesh.vertexBuffer.resize(this._verticesWithZ.byteLength);
    spineMesh.indexBuffer.resize(this._indices.byteLength);
    // #2 https://github.com/oasis-engine/engine/issues/376
    // this.spineMesh.changeBuffer(this.engine, this.vertexCount);
  }

  private _uploadBufferData() {
    const spineMesh = this._spineMesh;
    spineMesh.vertexBuffer.setData(this._verticesWithZ);
    spineMesh.indexBuffer.setData(this._indices);
  }
}

class SubMeshInstruction {
  name: string;
  startSlotIndex: number;
  endSlotIndex: number;
  constructor(name?: string, startSlotIndex?: number, endSlotIndex?: number, isClipping?: boolean) {
    this.name = name || 'default';
    this.startSlotIndex = startSlotIndex !== undefined ? startSlotIndex : -1;
    this.endSlotIndex = endSlotIndex || 0;
  }
}