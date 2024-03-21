import { MeshRenderer, Script, Entity, Mesh } from '@galacean/engine';
import { Skeleton } from '../spine-core/Skeleton';
import { SkeletonData } from '../spine-core/SkeletonData';
import { RenderManager } from './RenderManager';
import { SkeletonRenderInstruction } from './RenderInstruction';
import { MeshGenerator } from './MeshGenerator';
import { AnimationState } from '../spine-core/AnimationState';
import { AnimationStateData } from '../spine-core/AnimationStateData'

export class SpineRenderer extends Script {
  protected _skeletonData: SkeletonData; // spine静态数据
  private _skeleton: Skeleton; // Spine 骨架数据
  private _renderManager: RenderManager; // 渲染管理器
  private _currentInstruction = new SkeletonRenderInstruction();
  private _meshGenerator: MeshGenerator = new MeshGenerator();

  public initialFlipX: boolean; // 初始x轴翻转
  public initialFlipY: boolean; // 初始y轴翻转
  public zSpacing: number; // 附件z轴轴向间隙
  public enableClipping: boolean; // 是否开启裁剪功能
  public immutableTriangles: boolean; // 固定三角形序号更新
  public usePMA: boolean; // 是否使用预乘模式
  public useSingleSubmesh: boolean; // 是否使用单一子网格
  public separatorSlots: string[]; // 需要拆分的插槽

  get skeleton() {
    return this._skeleton;
  }

  set skinName(skinName: string) {
    console.log(skinName);
  }

  constructor(entity: Entity) {
    super(entity);
    this._renderManager = new RenderManager(this.engine);
    const meshRenderers = [];
    let meshRenderer: MeshRenderer;
    this.entity.getComponents(MeshRenderer, meshRenderers);
    if (meshRenderers.length === 0) {
      meshRenderer = this.entity.addComponent(MeshRenderer);
    } else {
      meshRenderer = meshRenderers[0];
    }
    meshRenderer.mesh = this._renderManager.getNextMesh();
  }
  
  initialize(skeletonData: SkeletonData) {
    this._skeletonData = skeletonData;
    this._skeleton = new Skeleton(skeletonData);
    this._skeleton.scaleX = this.initialFlipX ? -1 : 1;
    this._skeleton.scaleY = this.initialFlipY ? -1 : 1;
  }

  onLateUpdate() {
    const { _currentInstruction, _skeleton, _meshGenerator, useSingleSubmesh, _renderManager } = this;
    const { submeshRenderInstructions } = _currentInstruction;
    const { defaultSpineMaterial } = _renderManager;
    const currentMesh = this._renderManager.getNextMesh();
    currentMesh.clearSubMesh();
    let updateTriangles;
    useSingleSubmesh
    ? RenderManager.generateSingleSubmeshInstruction(_currentInstruction, _skeleton, defaultSpineMaterial)
    : RenderManager.generateSkeletonRendererInstruction();
    const { settings } = _meshGenerator;
    settings.usePMA = this.usePMA ?? settings.usePMA;
    settings.zSpacing = this.zSpacing ?? settings.zSpacing;
    settings.enableClipping = this.enableClipping ?? settings.enableClipping;
    settings.immutableTriangles = this.immutableTriangles ?? settings.immutableTriangles;
    _meshGenerator.begin(_currentInstruction.vertexCount, _currentInstruction.triangleCount);
    updateTriangles = SkeletonRenderInstruction.isEqual(_currentInstruction, _currentInstruction);
    if (_currentInstruction.hasActiveClipping) {
      useSingleSubmesh
      ? _meshGenerator.addSubMesh(submeshRenderInstructions[0], updateTriangles)
      : _meshGenerator.buildMesh(_currentInstruction, updateTriangles)
    } else {
      _meshGenerator.buildMeshWithoutClip(_currentInstruction);
    }
    const { subMeshes } = _meshGenerator;
    for (let i = 0; i < subMeshes.length; i++) {
      currentMesh.addSubMesh(subMeshes[i]);
    }
    this._renderManager.updateSubMeshMaterials(submeshRenderInstructions);
    const materialNeedsUpdate = _renderManager.hasMaterialsChanged();
    const meshRenderer = this.entity.getComponent(MeshRenderer);
    meshRenderer.mesh = currentMesh;
    if (materialNeedsUpdate) {
      this._renderManager.updateMaterials();
      meshRenderer.setMaterials(_renderManager.getMaterials());
    }
    _meshGenerator.fillBufferData(currentMesh, updateTriangles, this.engine);
  }


  onDestroy() {
    // destroy cache
  }



}