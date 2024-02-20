import { SpineRenderer } from './SpineRenderer';
import { AnimationState } from '../spine-core/AnimationState';
import { SkeletonData } from '../spine-core/SkeletonData';
import { AnimationStateData } from '../spine-core/AnimationStateData';
import { MeshRenderer } from '@galacean/engine';

class SpineAnimation extends SpineRenderer {

  private _state: AnimationState;
  private _meshRenderer: MeshRenderer;

  timeScale: number = 1;
  
  get state(): AnimationState {
    return this._state;
  }

  initialize(skeletonData: SkeletonData) {
    super.initialize(skeletonData);
    const animationData = new AnimationStateData(skeletonData);
    this._state = new AnimationState(animationData);
  }

  play() {

  }

  hackSeparateSlotTexture() {}

  onUpdate(deltaTime: number) {
    const { skeleton, state } = this;
    deltaTime *= this.timeScale;
    state.update(deltaTime);
    state.apply(skeleton);
    skeleton.updateWorldTransform();
  }
  
  onLateUpdate() {
    super.onLateUpdate();
  }

  onDestroy() {
    // destroy cache
  }



}