import { Material } from '@galacean/engine';
import { Attachment } from '../spine-core/attachments/Attachment';
import { Skeleton } from '../spine-core/Skeleton';

export class SubmeshRenderInstruction {
  skeleton: Skeleton;
  startSlot: number;
  endSlot: number;
  material: Material;
  needSeparate: boolean = false;
  triangleCount: number = 0;
  vertexCount: number = 0;
  preActiveClippingSlotIndex: number;
}

export class SkeletonRenderInstruction {
  static isEqual(instructionA, instructionB) {
    return true;
  }
  immutableTriangles: boolean = false;
  hasActiveClipping: boolean = false;
  vertexCount: number = 0;
  triangleCount: number = 0;
  submeshRenderInstructions: SubmeshRenderInstruction[] = [];
  attachments: Attachment[] = [];
}
