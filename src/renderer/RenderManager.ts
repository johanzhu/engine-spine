import { Engine, Material } from '@galacean/engine';
import { SpineMesh } from './SpineMesh';
import { SkeletonRenderInstruction, SubmeshRenderInstruction } from './RenderInstruction';
import { Skeleton } from '../spine-core/Skeleton';
import { RegionAttachment } from '../spine-core/attachments/RegionAttachment';
import { MeshAttachment } from '../spine-core/attachments/MeshAttachment';
import { ClippingAttachment } from '../spine-core/attachments/ClippingAttachment';
import { AdaptiveTexture } from '../loader/AssetUtility';
import { SpineMaterial } from '../SpineMaterial';

export class RenderManager {
  // Called every frame
  static generateSingleSubmeshInstruction(inputInstruction: SkeletonRenderInstruction, skeleton: Skeleton, material: Material) {
    inputInstruction.attachments.length = 0;
    inputInstruction.submeshRenderInstructions.length = 0;
    const drawOrder = skeleton.drawOrder;
    const drawOrderCount = drawOrder.length;
    const submeshRenderInstruction = new SubmeshRenderInstruction();
    const currentAttachments = inputInstruction.attachments;
    submeshRenderInstruction.skeleton = skeleton;
    submeshRenderInstruction.startSlot = 0;
    submeshRenderInstruction.endSlot = drawOrderCount;
    submeshRenderInstruction.material = material;
    let adaptiveTexture: AdaptiveTexture;
    let hasActiveClipping = false;
    let totalVertexCount = 0;
    let totalTriangleCount = 0;
    for (let slotIndex = 0; slotIndex < drawOrderCount; slotIndex += 1) {
      const slot = drawOrder[slotIndex];
      if (!slot.bone.active) {
        currentAttachments[slotIndex] = null;
        continue;
      }

      const attachment = slot.attachment;
      currentAttachments[slotIndex] = attachment;
      let attachmentTriangleCount: number = 0;
			let attachmentVertexCount: number = 0;

      if (attachment instanceof RegionAttachment) {
        attachmentVertexCount = 4;
        attachmentTriangleCount = 6;
        adaptiveTexture = attachment.region.renderObject.texture;
      } else if (attachment instanceof MeshAttachment) {
        attachmentVertexCount = attachment.worldVerticesLength >> 1;
        attachmentTriangleCount = attachment.triangles.length;
        adaptiveTexture = attachment.region.renderObject.texture;
      } else if (attachment instanceof ClippingAttachment) {
        hasActiveClipping = true;
      }
      submeshRenderInstruction.triangleCount += attachmentTriangleCount;
      submeshRenderInstruction.vertexCount += attachmentVertexCount;
      totalVertexCount += attachmentVertexCount;
      totalTriangleCount += attachmentTriangleCount;
    }

    submeshRenderInstruction.material = material;
    material.shaderData.setTexture("material_SpineTexture", adaptiveTexture.texture);
    inputInstruction.hasActiveClipping = hasActiveClipping;
    inputInstruction.vertexCount = totalVertexCount;
    inputInstruction.triangleCount = totalTriangleCount;

    inputInstruction.submeshRenderInstructions[0] = submeshRenderInstruction;
  }

  // Called every frame
  static generateSkeletonRendererInstruction() {
    
  }

  private _engine: Engine;
  private _doubleBufferedMesh: DoubleBufferedMesh;
  private _materials: Material[] = [];
  private _submeshMaterials: Material[] = [];
  private _defaultSpineMaterial: Material;

  get defaultSpineMaterial() {
    return this._defaultSpineMaterial;
  }

  constructor(engine: Engine) {
    this._engine = engine;
    this._doubleBufferedMesh = new DoubleBufferedMesh(engine);
    this._defaultSpineMaterial = new SpineMaterial(engine);
  }

  getNextMesh() {
    return this._doubleBufferedMesh.getNextMesh();
  }

  getMaterials() {
    return this._materials;
  }

  updateMaterials() {
    this._materials = [...this._submeshMaterials];
  }

  updateSubMeshMaterials(instructions: SubmeshRenderInstruction[]) {
    const { _submeshMaterials } = this;
    const newSize = instructions.length;
    if (newSize > _submeshMaterials.length) {
      _submeshMaterials.length = newSize;
    }
    for (let i = 0; i < newSize; i++) {
      _submeshMaterials[i] = instructions[i].material;
    }
  }

  hasMaterialsChanged() {
    const { _materials, _submeshMaterials } = this;
    if (_materials.length !== _submeshMaterials.length) {
      return true;
    }
    for (let i = 0; i < _materials.length; i++) {
      if (_materials[i].instanceId !== _submeshMaterials[i].instanceId) {
        return true;
      }
    }
    return false;
  }

}

class DoubleBufferedMesh {
  private a: SpineMesh;
  private b: SpineMesh;
  private usingA: boolean;

  constructor(engine: Engine) {
    this.a = new SpineMesh(engine);
    this.b = new SpineMesh(engine);
    this.usingA = false;
  }

  public getNextMesh(): SpineMesh {
    // this.usingA = !this.usingA;
    // return this.usingA ? this.a : this.b;
    return this.a;
  }
}