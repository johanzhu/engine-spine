import { SpineMesh } from './SpineMesh';

export class MeshManager {
  doubleBufferedMesh: DoubleBufferedMesh;
  
  initialize() {
    if (!this.doubleBufferedMesh) {
      this.doubleBufferedMesh = new DoubleBufferedMesh();
    }
  }

  getNextMesh() {
    return this.doubleBufferedMesh.getNext();
  }
}

class DoubleBufferedMesh {
  private a: SpineMesh;
  private b: SpineMesh;
  private usingA: boolean;

  constructor() {
    this.a = new SpineMesh();
    this.b = new SpineMesh();
    this.usingA = false;
  }

  public getCurrent(): SpineMesh {
    return this.usingA ? this.a : this.b;
  }

  public getNext(): SpineMesh {
    this.usingA = !this.usingA;
    return this.usingA ? this.a : this.b;
  }
}