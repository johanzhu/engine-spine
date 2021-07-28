import { Skeleton } from './spine-core/Skeleton';
import { SkeletonData } from './spine-core/SkeletonData';
import { AnimationState } from './spine-core/AnimationState';
import { AnimationStateData } from './spine-core/AnimationStateData';
import { MeshGenerator } from './core/MeshGenerator';
import { SpineRenderSetting } from './types';
import { Vector2 } from './spine-core/Utils';
import {
  Script,
  Entity,
  Texture2D,
  ignoreClone,
  MeshRenderer,
} from 'oasis-engine';

export class SpineAnimation extends Script {
  @ignoreClone
  private _skeletonData: SkeletonData;
  @ignoreClone
  private _skeleton: Skeleton;
  @ignoreClone
  private _state: AnimationState;
  @ignoreClone
  protected _meshGenerator: MeshGenerator;
  @ignoreClone
  setting: SpineRenderSetting;

  autoUpdate: boolean = true;
  autoUpdateBounds: boolean = true;

  get skeletonData() {
    return this._skeletonData;
  }

  get skeleton() {
    return this._skeleton;
  }

  get state() {
    return this._state;
  }

  get mesh() {
    return this._meshGenerator.mesh;
  }

  set scale(v: number) {
    if (this._skeleton) {
      this._skeleton.scaleX = v;
      this._skeleton.scaleY = v;
    }
  }

  constructor(entity: Entity) {
    super(entity);
    this._meshGenerator = new MeshGenerator(this.engine, entity);
  }

  setSkeletonData(skeletonData: SkeletonData, setting?: SpineRenderSetting) {
    if (!skeletonData) {
      console.error('SkeletonData is undefined');
    };
    this.setting = setting;
    this._skeletonData = skeletonData;
    this._skeleton = new Skeleton(skeletonData);
    console.log(this._skeleton, skeletonData);
    const animationData = new AnimationStateData(skeletonData);
    this._state = new AnimationState(animationData);
    this._meshGenerator.initialize(skeletonData, this.setting);
  }

  addSeparateSlot(slotName: string) {
    if (!this.skeleton) {
      console.error('Skeleton not found!');
    }
    const meshRenderer = this.entity.getComponent(MeshRenderer);
    if (!meshRenderer) {
      console.warn('You need add MeshRenderer component to entity first');
    }
    const slot = this.skeleton.findSlot(slotName);
    if (slot) {
      this._meshGenerator.addSeparateSlot(slotName);
      const mtl = this.engine._spriteDefaultMaterial.clone();
      const { materialCount } = meshRenderer;
      // add default material for new sub mesh
      // split will generate two material
      meshRenderer.setMaterial(materialCount, mtl);
      meshRenderer.setMaterial(materialCount + 1, mtl);
    } else {
      console.warn(`Slot: ${slotName} not find.`);
    }
  }

  hackSeparateSlotTexture(slotName: string, texture: Texture2D) {
    const { separateSlots } = this._meshGenerator;
    if (separateSlots.length === 0) {
      console.warn('You need add separate slot');
      return;
    }
    if (separateSlots.includes(slotName)) {
      const meshRenderer = this.entity.getComponent(MeshRenderer);
      const subMeshIndex = separateSlots.findIndex(item => item === slotName);
      const mtl = meshRenderer.getMaterial(subMeshIndex);
      mtl.shaderData.setTexture('u_spriteTexture', texture);
    } else {
      console.warn(`Slot ${slotName} is not separated. You should use addSeparateSlot to separate it`);
    }
  }

  disposeCurrentSkeleton() {
    this._skeletonData = undefined;
    // TODO
  }

  onUpdate(delta: number) {
    if (this.autoUpdate) {
      this.updateState(delta * 0.001);
    }
  }

  updateState(deltaTime: number) {
    if (!this._skeleton || !this._state) return;
    const state = this._state;
    const skeleton = this._skeleton;

    state.update(deltaTime);
    state.apply(skeleton);
    skeleton.updateWorldTransform();

    this.updateGeometry();
  }

  updateGeometry() {
    if (!this._skeleton) return;
    this._meshGenerator.buildMesh(this._skeleton);
    if (this.autoUpdateBounds) {
      this.updateBounds();
    }
  }

  updateBounds() {
    if (!this._skeleton) return;
    const { mesh: { bounds } } = this._meshGenerator;
    const offset = new Vector2();
    const size = new Vector2();
    const temp = [0, 0];
    const zSpacing = this.setting?.zSpacing || 0.01;
    const skeleton = this._skeleton;
    skeleton.getBounds(offset, size, temp);
    const drawOrder = skeleton.drawOrder;
    bounds.min.setValue(offset.x, offset.y, 0);
    bounds.max.setValue(offset.x + size.x, offset.y + size.y, drawOrder.length * zSpacing);
  }

  /**
   * spine animation custom clone
   */
  _cloneTo(target: SpineAnimation) {
    target.setSkeletonData(this.skeletonData);
    const _cloneSetting = {...this.setting};
    target.setting = _cloneSetting;
  }
}