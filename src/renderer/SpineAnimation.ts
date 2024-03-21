import { SpineRenderer } from './SpineRenderer';
import { AnimationState } from '../spine-core/AnimationState';
import { SkeletonData } from '../spine-core/SkeletonData';
import { AnimationStateData } from '../spine-core/AnimationStateData';

let t = Date.now();

export class SpineAnimation extends SpineRenderer {

  private _state: AnimationState;

  timeScale: number = 1;
  
  get state(): AnimationState {
    return this._state;
  }

  initialize(skeletonData: SkeletonData) {
    super.initialize(skeletonData);
    const animationData = new AnimationStateData(skeletonData);
    this._state = new AnimationState(animationData);
  }

  play(animationName: string, loop: boolean = true) {
    if (!this._state) {
      console.error('Skeleton data is not initialized');
      return;
    }
    this._state.setAnimation(0, animationName, loop);
  }

  hackSeparateSlotTexture() {}

  onUpdate(deltaTime: number) {
    const { skeleton, state } = this;
    deltaTime *= this.timeScale;
    state.update(deltaTime);
    state.apply(skeleton);
    skeleton.updateWorldTransform();
  }
  
  onDestroy() {
    // destroy cache
  }



}