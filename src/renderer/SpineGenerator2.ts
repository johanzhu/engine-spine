import {
  ClippingAttachment,
  MeshAttachment,
  RegionAttachment,
  Skeleton,
  SkeletonClipping
} from "@esotericsoftware/spine-core";
import { AttachmentCacheManager } from "./AttachmentCacheManager";
import { RenderInstructionManager, SubmeshInstruction } from "./RenderInstructionManager";
import { SpineAnimationRenderer } from "./SpineAnimationRenderer";
import { PrimitiveBuilder } from "./PrimitiveBuilder";

export interface SpinePrimitiveBuildSettings {
  zSpacing: number;
  premultipliedAlpha: boolean;
  tintBlack: boolean;
}

export class SpineGenerator {
  private readonly _instructionManager: RenderInstructionManager = new RenderInstructionManager();
  private readonly _clipper = new SkeletonClipping();
  private readonly _settings: SpinePrimitiveBuildSettings = {
    zSpacing: 0,
    premultipliedAlpha: false,
    tintBlack: false
  };

  private _lastInstructions: SubmeshInstruction[] = [];

  public buildPrimitive(skeleton: Skeleton, renderer: SpineAnimationRenderer): void {
    const {
      attachmentCacheManager: cache,
      zSpacing,
      premultipliedAlpha,
      tintBlack,
      _vertices: vb,
      _indices: ib
    } = renderer;

    const stride = tintBlack ? 13 : 9;

    this._settings.zSpacing = zSpacing;
    this._settings.premultipliedAlpha = premultipliedAlpha;
    this._settings.tintBlack = tintBlack;

    this._instructionManager.generateInstructions(skeleton);
    const instructions = this._instructionManager.instructions;

    const indexNeedChanged = RenderInstructionManager.compareInstructions(instructions, this._lastInstructions);
    this._lastInstructions = instructions;

    const totalVertexCount = PrimitiveBuilder.computeTotalVertexCount(instructions);
    if (renderer._vertices.length < totalVertexCount * stride) {
      renderer._createAndBindBuffer(totalVertexCount);
    }

    PrimitiveBuilder.buildFromInstructions(skeleton, instructions, vb, ib, this._settings, cache, this._clipper);

    renderer._vertexBuffer.setData(renderer._vertices);
    if (indexNeedChanged) {
      renderer._indexBuffer.setData(renderer._indices);
    }
  }

  public clear(): void {
    this._instructionManager.clear();
    this._clipper.clipEnd();
    this._lastInstructions.length = 0;
  }

  get submeshInstructions(): SubmeshInstruction[] {
    return this._instructionManager.instructions;
  }
}
