import {
  BufferMesh,
  Engine,
  VertexElement,
  VertexElementFormat,
} from '@galacean/engine';

export class SpineMesh extends BufferMesh {
  constructor(engine: Engine) {
    super(engine);
    const vertexElements = [
      new VertexElement('POSITION', 0, VertexElementFormat.Vector3, 0),
      new VertexElement('COLOR_0', 12, VertexElementFormat.Vector4, 0),
      new VertexElement('TEXCOORD_0', 28, VertexElementFormat.Vector2, 0),
    ];
    this.setVertexElements(vertexElements);
  }
}
