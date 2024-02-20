import { Script } from '@galacean/engine';
import { Skeleton } from '../spine-core/Skeleton';
import { SkeletonData } from '../spine-core/SkeletonData';
import { MeshManager } from './MeshManager';
import { MaterialManager } from './MaterialManager';

export class SpineRenderer extends Script {
  protected _skeletonData: SkeletonData; // spine静态数据
  private _skeleton: Skeleton; // Spine 骨架数据
  private _meshManager: MeshManager;
  private _materialManager: MaterialManager;

  public initialFlipX: boolean; // 初始x轴翻转
  public initialFlipY: boolean; // 初始y轴翻转
  public zSpacing: number; // 附件z轴轴向间隙
  public enableClipping: boolean; // 是否开启裁剪功能
  public usePremultipliedAlpha: boolean; // 是否使用预乘模式
  public useSingleSubmesh: boolean; // 是否使用单一子网格
  public separatorSlots: string[]; // 需要拆分的插槽

  get skeleton() {
    return this._skeleton;
  }

  // set skinName() {}
  
  onLateUpdate() {
    

  }

  initialize(skeletonData: SkeletonData) {
    this._skeletonData = skeletonData;


  }

  onDestroy() {
    // destroy cache
  }



}

