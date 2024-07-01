import { Skeleton, SkeletonData, AnimationState, AnimationStateData, Physics, Vector2 } from "@esotericsoftware/spine-core";
import { MeshGenerator } from "./core/MeshGenerator";
import { SpineRenderSetting } from "./types";
import {
  Renderer,
  Entity,
  ignoreClone,
  Texture2D,
  Material,
  Engine,
  BoundingBox,
  Camera,
  BasicRenderPipeline,
  Mesh,
  ShaderMacro,
  Logger,
} from "@galacean/engine";
import { SpineMaterial } from "./SpineMaterial";

export class SpineAnimation extends Renderer {
  private static _defaultMaterial: Material;
  private static _uvMacro = ShaderMacro.getByName("RENDERER_HAS_UV");
  private static _enableVertexColorMacro = ShaderMacro.getByName("RENDERER_ENABLE_VERTEXCOLOR");
  private static _tempOffset: Vector2 = new Vector2();
  private static _tempSize: Vector2 = new Vector2();
  private static _tempArray: Array<number> = [0, 0];

  static getDefaultMaterial(engine: Engine): Material {
    let defaultMaterial = this._defaultMaterial;
    if (defaultMaterial) {
      if (defaultMaterial.engine === engine) {
        return defaultMaterial.clone();
      } else {
        defaultMaterial.destroy(true);
        defaultMaterial = null;
      }
    }
    defaultMaterial = new SpineMaterial(engine);
    defaultMaterial.isGCIgnored = true;
    this._defaultMaterial = defaultMaterial;
    return defaultMaterial.clone();
  }

  @ignoreClone
  private _skeletonData: SkeletonData;
  @ignoreClone
  protected _skeleton: Skeleton;
  @ignoreClone
  protected _state: AnimationState;
  @ignoreClone
  protected _meshGenerator: MeshGenerator;
  @ignoreClone
  _animationName: string;
  @ignoreClone
  _loop: boolean = false;
  @ignoreClone
  setting: SpineRenderSetting;

  /* @internal */
  @ignoreClone
  _mesh: Mesh;


  get animationName() {
    return this._animationName;
  }

  set animationName(value: string) {
    this._animationName = value;
    if (this.state) {
      if (value) {
        this.state.setAnimation(0, value, this.loop);
      } else {
        this.state.setEmptyAnimation(0, 0);
      }
    }
  }

  get loop() {
    return this._loop;
  }

  set loop(value: boolean) {
    const entry = this.state.getCurrent(0);
    this._loop = value;
    if (entry) {
      entry.loop = value;
    }
  }

  get state() {
    return this._state;
  }

  get skeleton() {
    return this._skeleton;
  }

  get skeletonData() {
    return this._skeletonData;
  }

  constructor(entity: Entity) {
    super(entity);
    this._meshGenerator = new MeshGenerator(this.engine, this);
  }

  initialize(skeletonData: SkeletonData, setting?: SpineRenderSetting) {
    this.setting = setting;
    this._skeletonData = skeletonData;
    this._skeleton = new Skeleton(skeletonData);
    const animationData = new AnimationStateData(skeletonData);
    this._state = new AnimationState(animationData);
    this._meshGenerator.initialize(this._skeletonData, this.setting);
  }

  /**
   * Separate slot by slot name. This will add a new sub mesh, and new materials.
   */
  addSeparateSlot(slotName: string) {
    if (!this._skeleton) {
      console.error("Skeleton not found!");
    }
    const slot = this._skeleton.findSlot(slotName);
    if (slot) {
      this._meshGenerator.addSeparateSlot(slotName);
    } else {
      console.warn(`Slot: ${slotName} not find.`);
    }
  }

  /**
   * Change texture of a separated slot by name.
   */
  hackSeparateSlotTexture(slotName: string, texture: Texture2D) {
    const { separateSlots } = this._meshGenerator;
    if (separateSlots.length === 0) {
      console.warn("You need add separate slot");
      return;
    }
    if (separateSlots.includes(slotName)) {
      this._meshGenerator.addSeparateSlotTexture(slotName, texture);
    } else {
      console.warn(
        `Slot ${slotName} is not separated. You should use addSeparateSlot to separate it`
      );
    }
  }

  /**
   * @internal
   */
  override update(delta: number): void {
    if (!this._skeleton || !this._state) return;
    const state = this._state;
    const skeleton = this._skeleton;
    state.update(delta);
    state.apply(skeleton);
    skeleton.update(delta);
    skeleton.updateWorldTransform(Physics.update);
  }

  /**
   * @internal
   */
  // @ts-ignore
  override _prepareRender(context: any): void {
    if (!this._mesh) {
      Logger.error("Spine mesh doesn't exist, please call initialize first");
      return;
    }
    if (this._mesh.destroyed) {
      Logger.error("Spine mesh is destroyed, please call initialize to reset");
      return;
    }
    if (this._skeleton) {
      this._meshGenerator.buildMesh(this._skeleton);
    }
    // @ts-ignore
    super._prepareRender(context);
  }

  /**
   * @internal
   */
  // @ts-ignore
  protected override _render(context: any): void {
    const mesh = this._mesh;
    if (this._dirtyUpdateFlag & SpineAnimationUpdateFlags.VertexElementMacro) {
      const shaderData = this.shaderData;
      // @ts-ignore
      const vertexElements = mesh._primitive.vertexElements;

      shaderData.disableMacro(SpineAnimation._uvMacro);
      shaderData.disableMacro(SpineAnimation._enableVertexColorMacro);

      for (let i = 0, n = vertexElements.length; i < n; i++) {
        switch (vertexElements[i].attribute) {
          case "TEXCOORD_0":
            shaderData.enableMacro(SpineAnimation._uvMacro);
            break;
          case "COLOR_0":
            shaderData.enableMacro(SpineAnimation._enableVertexColorMacro);
            break;
        }
      }
      this._dirtyUpdateFlag &= ~SpineAnimationUpdateFlags.VertexElementMacro;
    }

    const { _materials: materials, _engine: engine } = this;
    const subMeshes = mesh.subMeshes;
    // @ts-ignore
    const renderElement = engine._renderElementPool.get();
    // @ts-ignore
    renderElement.set(this.priority, this._distanceForSort);
    // @ts-ignore
    const subRenderElementPool = engine._subRenderElementPool;
    for (let i = 0, n = subMeshes.length; i < n; i++) {
      let material = materials[i];
      if (!material) {
        continue;
      }
      if (material.destroyed || material.shader.destroyed) {
        // @ts-ignore
        material = this.engine._meshMagentaMaterial;
      }

      const subRenderElement = subRenderElementPool.get();
      // @ts-ignore
      subRenderElement.set(this, material, mesh._primitive, subMeshes[i]);
      renderElement.addSubRenderElement(subRenderElement);
    }
    // @ts-ignore
    context.camera._renderPipeline.pushRenderElement(context, renderElement);
  }

  /**
   * @internal
   */
  // @ts-ignore
  protected override _updateBounds(worldBounds: BoundingBox): void {
    const bounds = worldBounds;
    const offset = SpineAnimation._tempOffset;
    const size = SpineAnimation._tempSize;
    const temp = SpineAnimation._tempArray;
    const zSpacing = this.setting?.zSpacing || 0.01;
    const skeleton = this._skeleton;
    skeleton.getBounds(offset, size, temp);
    const { x, y } = offset;
    bounds.min.set(x, y, 0);
    bounds.max.set(x + size.x, y + size.y, skeleton.drawOrder.length * zSpacing);
    BoundingBox.transform(
      bounds,
      this.entity.transform.worldMatrix,
      bounds,
    );
  }

  /**
   * @internal
   */
  // @ts-ignore
  override _cloneTo(target: SpineAnimation, srcRoot: Entity, targetRoot: Entity): void {
    // @ts-ignore
    super._cloneTo(target, srcRoot, targetRoot);
    target.initialize(this._skeletonData);
    const _cloneSetting = { ...this.setting };
    target.setting = _cloneSetting;
  }

  /**
   * @internal
   */
  protected override _onDestroy(): void {
    const mesh = this._mesh;
    if (mesh) {
      mesh.destroyed || this._addResourceReferCount(mesh, -1);
      this._mesh = null;
    }
    this._skeletonData = null;
    this._skeleton = null;
    this._meshGenerator = null;
    this.setting = null;
    super._onDestroy();
  }
}

/**
 * @remarks Extends `RendererUpdateFlag`.
 */
enum SpineAnimationUpdateFlags {
  /** VertexElementMacro. */
  VertexElementMacro = 0x2,
}
