import {
  Buffer,
  BufferBindFlag,
  BufferUsage,
  IndexBufferBinding,
  IndexFormat,
  Primitive,
  VertexBufferBinding,
  VertexElement,
  VertexElementFormat
} from "@galacean/engine";
import { SpineAnimationRenderer } from "../src/renderer/SpineAnimationRenderer";
import { SpineGenerator } from "../src/renderer/SpineGenerator";

export class SpineAnimationTrailingRender extends SpineAnimationRenderer {
  isTrailing: boolean = true;
  maxTrailingMount: number = 10;
  fadeFactor: number = 0.95;
  trailings: {
    vertices: Float32Array;
    indices: Uint16Array;
  }[] = [];
  override update(delta: number): void {
    if (this.isTrailing) {
      while (this.trailings.length >= this.maxTrailingMount) {
        this.trailings.shift();
      }
      this.trailings.push({
        vertices: new Float32Array(this._vertices),
        indices: new Uint16Array(this._indices)
      });
      this.trailings.forEach((trailing) => {
        for (let i = 6; i < trailing.vertices.length; i += 9) {
          trailing.vertices[i] *= this.fadeFactor;
        }
      });
    } else {
      //Need GC
      this.trailings = [];
    }
    super.update(delta);
  }
  override _render(context: any): void {
    const { _materials: materials, _engine: engine } = this;
    if (this.isTrailing) {
      for (let i = 0; i < this.trailings.length; i++) {
        const trailing = this.trailings[i];
        const primitive = new Primitive(this._engine);
        primitive.addVertexElement(new VertexElement("POSITION", 0, VertexElementFormat.Vector3, 0));
        primitive.addVertexElement(new VertexElement("COLOR_0", 12, VertexElementFormat.Vector4, 0));
        primitive.addVertexElement(new VertexElement("TEXCOORD_0", 28, VertexElementFormat.Vector2, 0));
        primitive.setVertexBufferBinding(
          0,
          new VertexBufferBinding(
            new Buffer(this._engine, BufferBindFlag.VertexBuffer, trailing.vertices, BufferUsage.Dynamic),
            SpineGenerator.VERTEX_STRIDE * 4
          )
        );
        primitive.setIndexBufferBinding(
          new IndexBufferBinding(
            new Buffer(this._engine, BufferBindFlag.IndexBuffer, trailing.indices, BufferUsage.Dynamic),
            IndexFormat.UInt16
          )
        );
        // @ts-ignore
        const renderElement = engine._renderElementPool.get();
        // @ts-ignore
        renderElement.set(this.priority, this._distanceForSort);
        // @ts-ignore
        const subRenderElementPool = engine._subRenderElementPool;
        //Need Help in SubPrimitive
        if (!this._subPrimitives) continue;
        for (let j = 0, n = this._subPrimitives.length; j < n; j++) {
          let material = materials[i];
          if (!material) {
            continue;
          }
          if (material.destroyed || material.shader.destroyed) {
            // @ts-ignore
            material = this.engine._meshMagentaMaterial;
          }

          const subRenderElement = subRenderElementPool.get();
          subRenderElement.set(this, material, primitive, this._subPrimitives[j]);
          renderElement.addSubRenderElement(subRenderElement);
        }
        // @ts-ignore
        context.camera._renderPipeline.pushRenderElement(context, renderElement);
      }
    }
    super._render(context);
  }
}
