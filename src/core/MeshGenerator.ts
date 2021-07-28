import {
  Engine,
  Entity,
  MeshRenderer,
  SubMesh,
  SetDataOptions,
} from 'oasis-engine';
import { Skeleton } from '../spine-core/Skeleton';
import { SkeletonData } from '../spine-core/SkeletonData';
import { RegionAttachment } from '../spine-core/attachments/RegionAttachment';
import { MeshAttachment } from '../spine-core/attachments/MeshAttachment';
import { ClippingAttachment } from '../spine-core/attachments/ClippingAttachment';
import { Utils, ArrayLike, Color } from '../spine-core/Utils';
import { SkeletonClipping } from '../spine-core/SkeletonClipping';
import { SpineMesh } from './SpineMesh';
import { SpineRenderSetting } from '../types';

export class MeshGenerator {
  static QUAD_TRIANGLES = [0, 1, 2, 2, 3, 0];
  static VERTEX_SIZE = 2 + 2 + 4; // position without z, uv, color
  static VERTEX_STRIDE = 3 + 2 + 4; // position with z, uv, color

  private setting: SpineRenderSetting;
  private engine: Engine;
  private entity: Entity;
  private clipper: SkeletonClipping = new SkeletonClipping();
  private spineMesh: SpineMesh = new SpineMesh();

  private vertexCount: number;
  private vertices: Float32Array;
  private verticesWithZ: Float32Array;
  private indices: Uint16Array;
  private tempColor = new Color();
  private needResize = false;
  readonly separateSlots: string[] = [];

  get mesh() {
    return this.spineMesh.mesh;
  }

  constructor(engine: Engine, entity: Entity) {
    this.engine = engine;
    this.entity = entity;
  }

  initialize(skeletonData: SkeletonData, setting?: SpineRenderSetting) {
    if (!skeletonData) return;

    const meshRenderer = this.entity.getComponent(MeshRenderer);
    if (!meshRenderer) {
      console.warn('You need add MeshRenderer component to entity first');
      return;
    }

    if (setting) {
      this.setting = setting;
    }

    // Prepare buffer by using all attachment data but clippingAttachment
    const { defaultSkin: { attachments } } = skeletonData;
    let vertexCount: number = 0;
    const attachmentsArray = [];
    for (let i = 0, n = attachments.length; i < n; i++) {
      for (let key in attachments[i]) {
        attachmentsArray.push(attachments[i][key]);
      }
    }
    for (let i = 0, n = attachmentsArray.length; i < n; i++) {
      const attachment = attachmentsArray[i];
      if (!attachment) {
        continue;
      } else if (attachment instanceof RegionAttachment) {
        vertexCount += MeshGenerator.QUAD_TRIANGLES.length;
      } else if (attachment instanceof MeshAttachment) {
        let mesh = attachment;
        vertexCount += mesh.triangles.length;
      } else continue;
    }
    this.vertexCount = vertexCount;
    this.prepareBufferData(this.vertexCount);
    this.spineMesh.initialize(this.engine, this.vertexCount);
    meshRenderer.mesh = this.spineMesh.mesh;
  }

  buildMesh(skeleton: Skeleton) {
    if (!skeleton) {
      return;
    }

    const {
      useClipping = true,
      zSpacing = 0.01,
    } = this.setting || {};

    let verticesLength = 0;
    let indicesLength = 0;
    
    const meshRenderer = this.entity.getComponent(MeshRenderer);
    const drawOrder = skeleton.drawOrder;
    const clipper = this.clipper;
    const seperateSubMesh = [];
    const restSubMesh = [];
    let vertices: ArrayLike<number> = this.vertices;
    let triangles: Array<number> = [];
    let uvs: ArrayLike<number> = [];
    let dark = new Color();
    let start = 0;
    let count = 0;
    for (let slotIndex = 0; slotIndex < drawOrder.length; slotIndex += 1) {
      const slot = drawOrder[slotIndex];
      const attachment = slot.getAttachment();
      let attachmentColor: Color = new Color();
      let texture = null;
      const z = zSpacing * slotIndex;
      let numFloats = 0;
      let vertexSize = clipper.isClipping() ? 2 : MeshGenerator.VERTEX_SIZE;
      if (
        attachment instanceof RegionAttachment
      ) {
        let regionAttachment = <RegionAttachment>attachment;
        attachmentColor = regionAttachment.color;
        vertices = this.vertices;
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
        vertices = this.vertices;
        numFloats = (meshAttachment.worldVerticesLength >> 1) * vertexSize;
        if (numFloats > vertices.length) {
          // vertices = this.vertices = Utils.newFloatArray(numFloats);
        }
        meshAttachment.computeWorldVertices(slot, 0, meshAttachment.worldVerticesLength, vertices, 0, vertexSize);
        triangles = meshAttachment.triangles;
        uvs = meshAttachment.uvs;
        texture = meshAttachment.region.renderObject.texture;
      }  else if (
        attachment instanceof ClippingAttachment
      ) {
        if (useClipping) {
          let clip = <ClippingAttachment>(attachment);
					clipper.clipStart(slot, clip);
					continue;
        }
      } else continue;

      if (texture != null) {
        let finalVertices: ArrayLike<number>;
        let finalVerticesLength: number;
        let finalIndices: ArrayLike<number>;
        let finalIndicesLength: number;

        let skeleton = slot.bone.skeleton;
        let skeletonColor = skeleton.color;
        let slotColor = slot.color;
        let alpha = skeletonColor.a * slotColor.a * attachmentColor.a;
        let color = this.tempColor;
        color.set(skeletonColor.r * slotColor.r * attachmentColor.r,
            skeletonColor.g * slotColor.g * attachmentColor.g,
            skeletonColor.b * slotColor.b * attachmentColor.b,
            alpha);

        if (clipper.isClipping()) {
          clipper.clipTriangles(vertices, numFloats, triangles, triangles.length, uvs, color, dark, false);
          let clippedVertices = clipper.clippedVertices;
          let clippedTriangles = clipper.clippedTriangles;
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

        if (finalVerticesLength == 0 || finalIndicesLength == 0) {
          continue;
        }
        
        let indexStart = verticesLength / MeshGenerator.VERTEX_STRIDE;
        let verticesWithZ = this.verticesWithZ;
        let i = verticesLength;
        let j = 0;
        for (; j < finalVerticesLength; ) {
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
        verticesLength = i;

        let indicesArray = this.indices;
        for (i = indicesLength, j = 0; j < finalIndicesLength; i++, j++) {
          indicesArray[i] = finalIndices[j] + indexStart;
        }

        // add submesh
        const slotName = slot.data.name;
        const needSeparate = this.separateSlots.includes(slotName);

        if (needSeparate) {
          const subMesh = new SubMesh(indicesLength, finalIndicesLength);
          seperateSubMesh.push(subMesh);
          if (count > 0) {
            const prevSubMesh = new SubMesh(start, count);
            restSubMesh.push(prevSubMesh);
            count = 0;
          }
          start = indicesLength + finalIndicesLength;
        } else {
          count += finalIndicesLength;
        }
        
        indicesLength += finalIndicesLength;

        const materials = meshRenderer.getMaterials();
        for (let i = 0; i < materials.length; i += 1) {
          const mtl = materials[i];
          if (!mtl.shaderData.getTexture('u_spriteTexture')) {
            mtl.shaderData.setTexture('u_spriteTexture', texture.texture);
          }
        }

      }

      clipper.clipEndWithSlot(slot);

    } // slot traverse end

    clipper.clipEnd();

    // add reset sub mesh
    if (count > 0) {
      const subMesh = new SubMesh(start, count);
      restSubMesh.push(subMesh);
      count = 0;
    }

    // update buffer when vertex count change
    if (indicesLength > 0 && indicesLength !== this.vertexCount) {
      if (indicesLength > this.vertexCount) {
        this.vertexCount = indicesLength;
        this.prepareBufferData(this.vertexCount);
        this.needResize = true;
        return;
      }
    }
    

    // update subMesh
    this.spineMesh.mesh.clearSubMesh();
    const subMeshes = seperateSubMesh.concat(restSubMesh);
    for (let i = 0; i < subMeshes.length; i += 1) {
      this.spineMesh.mesh.addSubMesh(subMeshes[i]);
    }


    if (this.needResize) {
      // #1
      this.spineMesh.vertexBuffer.resize(this.verticesWithZ.byteLength);
      this.spineMesh.indexBuffer.resize(this.indices.byteLength);
      // #2 https://github.com/oasis-engine/engine/issues/376
      // this.spineMesh.changeBuffer(this.engine, this.vertexCount);
      this.needResize = false;
    }
    this.spineMesh.vertexBuffer.setData(this.verticesWithZ);
    this.spineMesh.indexBuffer.setData(this.indices);
  }

  addSeparateSlot(slotName: string) {
    this.separateSlots.push(slotName);
  }

  private prepareBufferData(vertexCount: number) {
    this.vertices = new Float32Array(vertexCount * MeshGenerator.VERTEX_SIZE);
    this.verticesWithZ = new Float32Array(vertexCount * MeshGenerator.VERTEX_STRIDE);
    this.indices = new Uint16Array(vertexCount);
  }
}